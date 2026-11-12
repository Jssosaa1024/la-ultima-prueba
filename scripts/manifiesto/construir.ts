/**
 * Manifiesto de assets (T08): hash, bytes y triángulos por sala.
 *
 * Lee la salida del pipeline en `public/assets/`:
 *   salas/<sala>/<nombre>.<hash>.<ext>   modelos e imágenes (caché inmutable, ver public/_headers)
 *   audio/<idioma>/<sala>/<archivo>      audio de la sala
 * y escribe `public/assets/manifest.json`, que el juego usa para saber qué archivo pedir
 * y que `check-budget` (T09) compara con el presupuesto.
 *
 * El manifiesto no lleva fechas: con los mismos archivos sale idéntico, byte a byte.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { crearIO, medir } from '../modelos/etapa-comun.ts';
import { medirImagen, medirTexturas } from './texturas.ts';
import type { TexturaMedida } from './texturas.ts';

export const VERSION_MANIFIESTO = 1;
/** Caracteres del hash que van en el nombre del archivo. */
export const LARGO_HASH = 8;

export interface ArchivoSala {
  /** Ruta relativa a `public/assets/`, con `/`. */
  archivo: string;
  /** SHA-256 completo del contenido, en hexadecimal. */
  sha256: string;
  bytes: number;
  /** Solo en modelos .glb. */
  triangulos?: number;
  drawCalls?: number;
  /** Texturas de un modelo, o la imagen misma si es un .ktx2 suelto (T09). */
  texturas?: TexturaMedida[];
}

export interface ArchivoAudio {
  archivo: string;
  idioma: string;
  sha256: string;
  bytes: number;
}

export interface Sala {
  archivos: ArchivoSala[];
  audio: ArchivoAudio[];
  totales: {
    /** Descarga de modelos e imágenes de la sala. */
    bytes: number;
    bytesAudio: number;
    triangulos: number;
    drawCalls: number;
    /** Memoria estimada de todas las texturas en GPU, con mipmaps (T09). */
    bytesGpu: number;
  };
}

export interface Manifiesto {
  version: number;
  salas: Record<string, Sala>;
}

export interface Cambio {
  de: string;
  a: string;
}

/** `escena.1a2b3c4d.glb` → `{ base: 'escena', hash: '1a2b3c4d', ext: '.glb' }`. */
export function separarHash(nombre: string): { base: string; hash: string | null; ext: string } {
  const ext = path.extname(nombre);
  const sinExt = nombre.slice(0, nombre.length - ext.length);
  const coincidencia = new RegExp(`^(.+)\\.([0-9a-f]{${LARGO_HASH}})$`).exec(sinExt);
  if (coincidencia?.[1] && coincidencia[2]) {
    return { base: coincidencia[1], hash: coincidencia[2], ext };
  }
  return { base: sinExt, hash: null, ext };
}

export function nombreConHash(base: string, sha256: string, ext: string): string {
  return `${base}.${sha256.slice(0, LARGO_HASH)}${ext}`;
}

/** Imágenes sueltas en una sala: cuentan como texturas en GPU. */
const MIME_IMAGEN: Record<string, string> = {
  '.ktx2': 'image/ktx2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const sha256De = (datos: Uint8Array): string => createHash('sha256').update(datos).digest('hex');
const aPosix = (ruta: string): string => ruta.split(path.sep).join('/');
const porNombre = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

async function existe(ruta: string): Promise<boolean> {
  return stat(ruta).then(
    () => true,
    () => false,
  );
}

async function carpetas(ruta: string): Promise<string[]> {
  if (!(await existe(ruta))) return [];
  const entradas = await readdir(ruta, { withFileTypes: true });
  return entradas
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(porNombre);
}

/** Archivos dentro de `ruta` (también en subcarpetas), relativos a ella y ordenados. */
async function archivosDe(ruta: string): Promise<string[]> {
  if (!(await existe(ruta))) return [];
  const entradas = await readdir(ruta, { recursive: true, withFileTypes: true });
  return entradas
    .filter((e) => e.isFile())
    .map((e) => path.relative(ruta, path.join(e.parentPath, e.name)))
    .sort(porNombre);
}

/**
 * Pone el hash del contenido en el nombre de cada archivo de `salas/<sala>/`.
 *
 * - `escena.glb` (salida nueva de optimize-models) pasa a `escena.<hash>.glb`, y se borran
 *   las versiones anteriores (`escena.<otro-hash>.glb`).
 * - Un único `escena.<hash>.glb` cuyo hash no coincide con el contenido se renombra.
 * - Si hay varias versiones con hash y ninguna nueva, no se toca nada: no se sabe cuál vale,
 *   y `generarManifiesto` lo informa como problema.
 */
export async function ponerHashEnNombres(
  raiz: string,
): Promise<{ renombrados: Cambio[]; eliminados: string[] }> {
  const renombrados: Cambio[] = [];
  const eliminados: string[] = [];
  const salas = path.join(raiz, 'salas');
  const relativa = (ruta: string): string => aPosix(path.relative(raiz, ruta));

  for (const sala of await carpetas(salas)) {
    const carpeta = path.join(salas, sala);

    // Agrupa las versiones de cada archivo por su nombre sin hash.
    const grupos = new Map<string, { nuevo?: string; conHash: string[] }>();
    for (const relativo of await archivosDe(carpeta)) {
      const { base, hash, ext } = separarHash(path.basename(relativo));
      const clave = path.join(path.dirname(relativo), `${base}${ext}`);
      const grupo = grupos.get(clave) ?? { conHash: [] };
      if (hash === null) grupo.nuevo = relativo;
      else grupo.conHash.push(relativo);
      grupos.set(clave, grupo);
    }

    for (const [clave, { nuevo, conHash }] of grupos) {
      const elegido = nuevo ?? (conHash.length === 1 ? conHash[0] : undefined);
      if (!elegido) continue;
      const origen = path.join(carpeta, elegido);
      const { base, ext } = separarHash(path.basename(clave));
      const destino = path.join(
        path.dirname(origen),
        nombreConHash(base, sha256De(await readFile(origen)), ext),
      );
      if (nuevo) {
        for (const viejo of conHash) {
          const ruta = path.join(carpeta, viejo);
          await rm(ruta);
          if (ruta !== destino) eliminados.push(relativa(ruta));
        }
      }
      if (origen !== destino) {
        await rename(origen, destino);
        renombrados.push({ de: relativa(origen), a: relativa(destino) });
      }
    }
  }
  return { renombrados, eliminados };
}

/**
 * Lee `public/assets/` y arma el manifiesto. No cambia nada en disco.
 * `problemas` lista lo que impide publicar: archivos sin hash o con un hash que no coincide,
 * dos versiones del mismo archivo, modelos que no se pueden leer o audio fuera de lugar.
 */
export async function generarManifiesto(
  raiz: string,
): Promise<{ manifiesto: Manifiesto; problemas: string[] }> {
  const problemas: string[] = [];
  const salas: Record<string, Sala> = {};
  const sala = (id: string): Sala =>
    (salas[id] ??= {
      archivos: [],
      audio: [],
      totales: { bytes: 0, bytesAudio: 0, triangulos: 0, drawCalls: 0, bytesGpu: 0 },
    });
  const io = await crearIO();

  const raizSalas = path.join(raiz, 'salas');
  for (const id of await carpetas(raizSalas)) {
    const carpeta = path.join(raizSalas, id);
    const vistos = new Map<string, string>();
    sala(id);

    for (const relativo of await archivosDe(carpeta)) {
      const ruta = path.join(carpeta, relativo);
      const archivo = aPosix(path.relative(raiz, ruta));
      const datos = await readFile(ruta);
      const sha256 = sha256De(datos);
      const { base, hash, ext } = separarHash(path.basename(relativo));

      if (hash === null) {
        problemas.push(`${archivo}: falta el hash en el nombre (corre npm run build-manifest)`);
      } else if (!sha256.startsWith(hash)) {
        problemas.push(`${archivo}: el hash del nombre no coincide con el contenido`);
      }
      const clave = path.join(path.dirname(relativo), `${base}${ext}`);
      const otro = vistos.get(clave);
      if (otro) problemas.push(`${archivo}: hay dos versiones del mismo archivo (${otro})`);
      vistos.set(clave, archivo);

      const entrada: ArchivoSala = { archivo, sha256, bytes: datos.byteLength };
      const mimeImagen = MIME_IMAGEN[ext.toLowerCase()];
      if (ext.toLowerCase() === '.glb') {
        try {
          const documento = await io.readBinary(new Uint8Array(datos));
          const { triangulos, drawCalls } = medir(documento);
          entrada.triangulos = triangulos;
          entrada.drawCalls = drawCalls;
          entrada.texturas = medirTexturas(documento);
        } catch (error) {
          problemas.push(`${archivo}: no se pudo leer el modelo (${String(error)})`);
        }
      } else if (mimeImagen) {
        const imagen = medirImagen(base, new Uint8Array(datos), mimeImagen);
        if (imagen) entrada.texturas = [imagen];
        else problemas.push(`${archivo}: no se pudo leer la imagen`);
      }
      const s = sala(id);
      s.archivos.push(entrada);
      s.totales.bytes += entrada.bytes;
      s.totales.triangulos += entrada.triangulos ?? 0;
      s.totales.drawCalls += entrada.drawCalls ?? 0;
      s.totales.bytesGpu += (entrada.texturas ?? []).reduce((suma, t) => suma + t.bytesGpu, 0);
    }
  }

  const raizAudio = path.join(raiz, 'audio');
  for (const relativo of await archivosDe(raizAudio)) {
    const archivo = aPosix(path.join('audio', relativo));
    const partes = aPosix(relativo).split('/');
    const [idioma, id] = partes;
    if (partes.length < 3 || !idioma || !id) {
      problemas.push(`${archivo}: el audio va en audio/<idioma>/<sala>/`);
      continue;
    }
    const datos = await readFile(path.join(raizAudio, relativo));
    const s = sala(id);
    s.audio.push({ archivo, idioma, sha256: sha256De(datos), bytes: datos.byteLength });
    s.totales.bytesAudio += datos.byteLength;
  }

  const ordenadas: Record<string, Sala> = {};
  for (const id of Object.keys(salas).sort(porNombre)) {
    const s = salas[id];
    if (s) ordenadas[id] = s;
  }
  return { manifiesto: { version: VERSION_MANIFIESTO, salas: ordenadas }, problemas };
}

export function serializar(manifiesto: Manifiesto): string {
  return `${JSON.stringify(manifiesto, null, 2)}\n`;
}
