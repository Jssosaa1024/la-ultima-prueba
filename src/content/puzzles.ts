import type { Puzzle } from './esquema';
import s1 from './puzzles/s1-etiquetadora.json';
import s2 from './puzzles/s2-tanques.json';
import s3 from './puzzles/s3-reflector.json';
import s4 from './puzzles/s4-carritos.json';
import s5 from './puzzles/s5-urna.json';

/**
 * Los cinco puzzles para el juego, en el orden de las salas (T22).
 *
 * Los JSON se validan con el esquema en cada build (`src/content.config.ts`) y en
 * `tests/unit/puzzles.test.ts`; por eso aquí solo se declara su tipo, sin cargar zod en el
 * bundle del juego.
 */
export const PUZZLES = [s1, s2, s3, s4, s5] as unknown as readonly Puzzle[];

/** Puzzle de una sala (1 a 5). */
export function puzzleDeSala(sala: number): Puzzle | undefined {
  return PUZZLES.find((p) => p.sala === sala);
}
