import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import type { Respuestas } from '../../src/game/respuestas.ts';

/** El archivo que escribe `hash-answers`; su ruta decide las opciones de Prettier. */
export const ARCHIVO_RESPUESTAS = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'src',
  'content',
  'respuestas.json',
);

/**
 * Texto de `src/content/respuestas.json`, con el formato de Prettier del proyecto para que
 * `npm run format:check` lo acepte tal como lo escribe el script.
 */
export async function serializarRespuestas(r: Respuestas): Promise<string> {
  const opciones = await resolveConfig(ARCHIVO_RESPUESTAS);
  return format(JSON.stringify(r), { ...opciones, parser: 'json' });
}
