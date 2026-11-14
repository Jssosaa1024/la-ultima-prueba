import type { Respuestas } from '../game/respuestas';
import datos from './respuestas.json';

/**
 * Hashes del estado resuelto de cada etapa (T23). El archivo JSON lo escribe
 * `npm run hash-answers`; no se edita a mano. Se usa con `estaResuelta` de `game/respuestas`.
 */
export const RESPUESTAS = datos as Respuestas;
