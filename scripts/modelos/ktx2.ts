/**
 * Paso KTX2 de la etapa común (T07).
 *
 * Cada textura del modelo se pasa por `ktx create` (KTX-Software 4.4.0 o superior):
 * - ETC1S (Basis-LZ) para color, lightmap y el resto de mapas: es lo más liviano.
 * - UASTC + Zstandard solo para mapas normales: ETC1S los deja con bloques visibles.
 * - Ningún lado pasa de 1024 px y cada lado queda en potencia de 2, con mipmaps.
 *
 * El texto de la salida de `ktx` nunca se pone en HTML: solo se imprime en la terminal.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ImageUtils, Material } from '@gltf-transform/core';
import type { Document, Texture } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { getTextureColorSpace, listTextureSlots } from '@gltf-transform/functions';

const ejecutar = promisify(execFile);

/** La especificación pide KTX-Software 4.4.0 o superior en la máquina de build. */
export const VERSION_MINIMA_KTX = '4.4.0';
/** Lado máximo de una textura en el celular. */
export const TAMANO_MAXIMO = 1024;

export type ModoKtx2 = 'etc1s' | 'uastc';

export interface VersionKtx {
  mayor: number;
  menor: number;
  parche: number;
  /** Sufijo de versión preliminar, por ejemplo `rc2~3`; `null` en una versión estable. */
  preliminar: string | null;
  texto: string;
}

export interface OpcionesKtx2 {
  /** Lado máximo en píxeles; debe ser potencia de 2. Por defecto, 1024. */
  tamanoMaximo?: number;
  /** Ejecutable de KTX-Software. Por defecto, `ktx` en el PATH. */
  comando?: string;
}

export interface InformeTextura {
  nombre: string;
  modo: ModoKtx2;
  antes: { ancho: number; alto: number; bytes: number };
  despues: { ancho: number; alto: number; bytes: number };
}

/** Lee la versión de la salida de `ktx --version` (ej.: `ktx version: v5.0.0-rc2~3`). */
export function leerVersionKtx(salida: string): VersionKtx | null {
  const coincidencia = /v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.~-]+))?/.exec(salida);
  if (!coincidencia) return null;
  const [texto, mayor, menor, parche, preliminar] = coincidencia;
  return {
    mayor: Number(mayor),
    menor: Number(menor),
    parche: Number(parche),
    preliminar: preliminar ?? null,
    texto,
  };
}

/** `true` si la versión es igual o posterior a la mínima. Una preliminar de la mínima no alcanza. */
export function versionSuficiente(version: VersionKtx, minima = VERSION_MINIMA_KTX): boolean {
  const min = leerVersionKtx(minima);
  if (!min) throw new Error(`Versión mínima inválida: ${minima}`);
  const a = [version.mayor, version.menor, version.parche];
  const b = [min.mayor, min.menor, min.parche];
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return version.preliminar === null;
}

const comprobaciones = new Map<string, Promise<VersionKtx>>();

/** Comprueba una sola vez por proceso que `ktx` existe y es 4.4.0 o superior. */
export function comprobarKtx(comando = 'ktx'): Promise<VersionKtx> {
  let comprobacion = comprobaciones.get(comando);
  if (!comprobacion) {
    comprobacion = (async () => {
      let salida: string;
      try {
        salida = (await ejecutar(comando, ['--version'])).stdout;
      } catch (error) {
        throw new Error(
          `No encontré "${comando}". Instala KTX-Software ${VERSION_MINIMA_KTX} o superior ` +
            '(https://github.com/KhronosGroup/KTX-Software/releases) y abre una terminal nueva.',
          { cause: error },
        );
      }
      const version = leerVersionKtx(salida);
      if (!version || !versionSuficiente(version)) {
        throw new Error(
          `"${comando}" informa "${salida.trim()}"; el pipeline necesita KTX-Software ` +
            `${VERSION_MINIMA_KTX} o superior.`,
        );
      }
      return version;
    })();
    comprobaciones.set(comando, comprobacion);
  }
  return comprobacion;
}

const esPotenciaDe2 = (n: number): boolean => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

/**
 * Tamaño final: se reduce para que el lado mayor no pase del máximo (sin deformar)
 * y luego cada lado se lleva a la potencia de 2 más cercana, entre 1 y el máximo.
 */
export function tamanoDestino(
  ancho: number,
  alto: number,
  maximo = TAMANO_MAXIMO,
): { ancho: number; alto: number } {
  if (!esPotenciaDe2(maximo)) throw new Error(`El tamaño máximo debe ser potencia de 2: ${maximo}`);
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  const ajustar = (lado: number): number =>
    Math.min(maximo, 2 ** Math.round(Math.log2(Math.max(1, lado * escala))));
  return { ancho: ajustar(ancho), alto: ajustar(alto) };
}

/** UASTC solo si la textura se usa como mapa normal; todo lo demás va en ETC1S. */
export function modoDeTextura(ranuras: readonly string[]): ModoKtx2 {
  return ranuras.includes('normalTexture') ? 'uastc' : 'etc1s';
}

/** `true` si la imagen PNG trae canal alfa (RGBA, gris + alfa o paleta con tRNS). */
export function pngTieneAlfa(imagen: Uint8Array): boolean {
  // Firma (8) + largo (4) + "IHDR" (4) + ancho (4) + alto (4) + profundidad (1) → tipo de color en 25.
  const tipoColor = imagen[25];
  if (tipoColor === 4 || tipoColor === 6) return true;
  if (tipoColor !== 3) return false;
  const texto = Buffer.from(imagen.buffer, imagen.byteOffset, imagen.byteLength);
  return texto.includes('tRNS', 33, 'latin1');
}

export interface ParametrosKtx {
  modo: ModoKtx2;
  /** Color (sRGB) o datos (lineal). */
  srgb: boolean;
  alfa: boolean;
  ancho: number;
  alto: number;
  entrada: string;
  salida: string;
}

/** Argumentos de `ktx create`. Se pasan como lista, sin shell. */
export function argumentosKtx(p: ParametrosKtx): string[] {
  const canales = p.alfa ? 'R8G8B8A8' : 'R8G8B8';
  const argumentos = [
    'create',
    '--format',
    `${canales}_${p.srgb ? 'SRGB' : 'UNORM'}`,
    // Se declara la curva para que ktx no convierta los valores de la imagen.
    '--assign-tf',
    p.srgb ? 'srgb' : 'linear',
    '--width',
    String(p.ancho),
    '--height',
    String(p.alto),
    '--generate-mipmap',
  ];
  if (p.modo === 'etc1s') {
    argumentos.push('--encode', 'basis-lz', '--clevel', '1', '--qlevel', '128');
  } else {
    argumentos.push(
      '--encode',
      'uastc',
      '--uastc-quality',
      '2',
      '--uastc-rdo',
      // Rango sugerido por KTX-Software para mapas normales: 0,25 a 0,75.
      '--uastc-rdo-l',
      '0.5',
      '--zstd',
      '18',
    );
  }
  argumentos.push(p.entrada, p.salida);
  return argumentos;
}

/** El alfa solo importa en el color base de un material con transparencia o recorte. */
function necesitaAlfa(textura: Texture): boolean {
  return textura
    .listParents()
    .some(
      (padre) =>
        padre instanceof Material &&
        padre.getBaseColorTexture() === textura &&
        padre.getAlphaMode() !== 'OPAQUE',
    );
}

const EXTENSIONES: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg' };

/** Convierte a KTX2 todas las texturas PNG y JPEG del documento, en el sitio. */
export async function comprimirTexturas(
  documento: Document,
  opciones: OpcionesKtx2 = {},
): Promise<InformeTextura[]> {
  const { tamanoMaximo = TAMANO_MAXIMO, comando = 'ktx' } = opciones;
  const texturas = documento
    .getRoot()
    .listTextures()
    .filter((t) => t.getMimeType() !== 'image/ktx2' && t.getImage());
  if (texturas.length === 0) return [];

  await comprobarKtx(comando);
  const carpeta = await mkdtemp(path.join(tmpdir(), 'lup-ktx2-'));
  const informe: InformeTextura[] = [];

  try {
    for (const [i, textura] of texturas.entries()) {
      const nombre = textura.getName() || textura.getURI() || `textura-${i}`;
      const imagen = textura.getImage();
      const mime = textura.getMimeType();
      const extension = EXTENSIONES[mime];
      if (!imagen || !extension) {
        throw new Error(
          `La textura "${nombre}" es ${mime || 'de tipo desconocido'}; usa PNG o JPEG.`,
        );
      }
      const tamano = ImageUtils.getSize(imagen, mime);
      if (!tamano) throw new Error(`No pude leer el tamaño de la textura "${nombre}".`);
      const [ancho, alto] = tamano;

      const modo = modoDeTextura(listTextureSlots(textura));
      const destino = tamanoDestino(ancho, alto, tamanoMaximo);
      const entrada = path.join(carpeta, `${i}${extension}`);
      const salida = path.join(carpeta, `${i}.ktx2`);
      await writeFile(entrada, imagen);

      const argumentos = argumentosKtx({
        modo,
        // Los mapas normales siempre son datos, aunque otra ranura diga lo contrario.
        srgb: modo === 'etc1s' && getTextureColorSpace(textura) === 'srgb',
        alfa:
          modo === 'etc1s' && mime === 'image/png' && pngTieneAlfa(imagen) && necesitaAlfa(textura),
        ...destino,
        entrada,
        salida,
      });
      try {
        await ejecutar(comando, argumentos, { maxBuffer: 16 * 1024 * 1024 });
      } catch (error) {
        const detalle = (error as { stderr?: string }).stderr?.trim() || String(error);
        throw new Error(`ktx falló con la textura "${nombre}":\n${detalle}`, { cause: error });
      }

      const ktx2 = new Uint8Array(await readFile(salida));
      textura.setImage(ktx2).setMimeType('image/ktx2');
      const uri = textura.getURI();
      if (uri) textura.setURI(uri.replace(/\.[^./\\]*$/, '') + '.ktx2');

      informe.push({
        nombre,
        modo,
        antes: { ancho, alto, bytes: imagen.byteLength },
        despues: { ...destino, bytes: ktx2.byteLength },
      });
    }
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }

  documento.createExtension(KHRTextureBasisu).setRequired(true);
  return informe;
}
