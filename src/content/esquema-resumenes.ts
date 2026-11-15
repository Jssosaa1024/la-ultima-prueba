import { z } from 'astro/zod';

/**
 * Esquema del resumen de aprendizaje de cada sala (punto 15 del hito 1): lo que muestran los
 * finales sobre cada máquina.
 *
 * Todo final muestra los cinco temas, cuáles se resolvieron sin pistas y cómo funcionaba cada
 * máquina (`docs/salas-y-puzzles.md`, «Ningún final castiga»). Este archivo trae el texto;
 * qué salas se resolvieron lo calcula `game/aprendizaje.ts`.
 *
 * Reglas de escritura (las revisa `tests/unit/aprendizaje.test.ts`):
 * - Se escribe para un estudiante que acaba de jugar: una o dos frases, en pasado, sobre lo
 *   que hacía la máquina. Puede nombrar el concepto: el juego ya terminó.
 * - Español de Colombia: coma decimal, «×» para multiplicar.
 */

export const SALAS_RESUMEN = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;

export const esquemaResumen = z.strictObject({
  /** Id de la sala (el mismo de `game/partida.ts`). */
  id: z.enum(SALAS_RESUMEN),
  /** El tema, corto, como lo diría un profe en el tablero. */
  tema: z.string().trim().min(1).max(40),
  /** La máquina de la sala, como se llama en el juego. */
  maquina: z.string().trim().min(1).max(40),
  /** Cómo funcionaba la máquina, en una o dos frases. */
  resumen: z
    .string()
    .trim()
    .min(1)
    .max(260)
    .refine((t) => (t.match(/[.!?](\s|$)/g) ?? []).length <= 2, 'una o dos frases'),
});

export type ResumenSala = z.infer<typeof esquemaResumen>;
