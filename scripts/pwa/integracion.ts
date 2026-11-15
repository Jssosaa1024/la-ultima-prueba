import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * Genera `dist/sw.js` al terminar el build (T94). Va como integración de Astro para que
 * funcione con `astro build` y con `npm run build` (Cloudflare, `verify` y las e2e).
 */

/** Lo que el service worker recibe de cada build. */
export interface DatosSW {
  version: string;
  /** Rutas que se guardan al instalar. */
  nucleo: string[];
  /** Archivos de `/assets/` de este build (para borrar de la caché los que ya no existen). */
  salas: string[];
}

/** Páginas y archivos sueltos del núcleo, además de todo `/_astro/`. */
export const NUCLEO_FIJO = [
  '/',
  '/jugar/',
  '/manifest.webmanifest',
  '/iconos/icono-180.png',
  '/iconos/icono-192.png',
  '/iconos/icono-512.png',
] as const;

const PLANTILLA = fileURLToPath(new URL('./sw.js', import.meta.url));

/** Todos los archivos bajo `dir`, como rutas del sitio (`/_astro/x.js`). */
async function listar(raiz: string, sub: string): Promise<string[]> {
  let entradas;
  try {
    entradas = await readdir(path.join(raiz, sub), { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entradas
    .filter((e) => e.isFile())
    .map(
      (e) => '/' + path.relative(raiz, path.join(e.parentPath, e.name)).split(path.sep).join('/'),
    )
    .sort();
}

/** Ruta del sitio → archivo en `dist/` (`/jugar/` es `jugar/index.html`). */
const archivoDe = (raiz: string, ruta: string): string =>
  path.join(raiz, ruta.endsWith('/') ? ruta + 'index.html' : ruta);

/**
 * Datos del build en `raiz`. La versión es el hash del contenido del núcleo y de la
 * plantilla: si nada cambió, el service worker es el mismo byte a byte y el navegador no
 * instala nada nuevo.
 */
export async function datosDelBuild(raiz: string, plantilla: string): Promise<DatosSW> {
  const nucleo = [...NUCLEO_FIJO, ...(await listar(raiz, '_astro'))];
  const hash = createHash('sha256').update(plantilla);
  for (const ruta of nucleo) {
    hash.update(ruta);
    hash.update(await readFile(archivoDe(raiz, ruta)));
  }
  const salas = await listar(raiz, 'assets');
  for (const ruta of salas) hash.update(ruta);
  return { version: hash.digest('hex').slice(0, 12), nucleo, salas };
}

/** El texto de `sw.js`: los datos del build en la primera línea y luego la plantilla. */
export const textoSW = (datos: DatosSW, plantilla: string): string =>
  `self.__SW__ = ${JSON.stringify(datos)};\n${plantilla}`;

export async function escribirSW(raiz: string): Promise<DatosSW> {
  const plantilla = await readFile(PLANTILLA, 'utf8');
  const datos = await datosDelBuild(raiz, plantilla);
  await writeFile(path.join(raiz, 'sw.js'), textoSW(datos, plantilla));
  return datos;
}

export default function serviceWorker(): AstroIntegration {
  return {
    name: 'la-ultima-prueba:service-worker',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const datos = await escribirSW(fileURLToPath(dir));
        logger.info(`sw.js ${datos.version}: ${datos.nucleo.length} archivos en el núcleo`);
      },
    },
  };
}
