/**
 * Lectura de lo que revisa `check-credits` (T11h): el manifiesto `art/credits.json`, los
 * archivos publicados y las capturas de `art/evidencia/`. Todo con rutas relativas a la raíz
 * del repositorio y separadas con `/`, como se anotan en el manifiesto.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const MANIFIESTO_CREDITOS = 'art/credits.json';
export const CARPETA_EVIDENCIA = 'art/evidencia';
/** Lo que necesita entrada en el manifiesto: modelos, texturas e imágenes de las salas y el audio. */
export const CARPETAS_PUBLICADAS = ['public/assets/salas', 'public/assets/audio'] as const;

/** Archivos de una carpeta y sus subcarpetas, relativos a `raiz`; vacío si no existe. */
async function archivosEn(raiz: string, carpeta: string): Promise<string[]> {
  const entradas = await readdir(path.join(raiz, carpeta), {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  return entradas
    .filter((e) => e.isFile())
    .map((e) => path.relative(raiz, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

export async function listarPublicados(raiz: string): Promise<string[]> {
  const listas = await Promise.all(CARPETAS_PUBLICADAS.map((c) => archivosEn(raiz, c)));
  // Los archivos ocultos (.gitkeep, .DS_Store) no se publican como assets.
  return listas.flat().filter((a) => !path.posix.basename(a).startsWith('.'));
}

export async function listarEvidencias(raiz: string): Promise<Set<string>> {
  return new Set(await archivosEn(raiz, CARPETA_EVIDENCIA));
}

/** El manifiesto como JSON sin revisar, o `null` si no existe o no es JSON. */
export async function leerManifiestoCreditos(raiz: string): Promise<unknown> {
  const texto = await readFile(path.join(raiz, MANIFIESTO_CREDITOS), 'utf8').catch(() => null);
  if (texto === null) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}
