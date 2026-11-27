import { z } from 'astro/zod';
import { esquemaBloque } from './esquema-fichas';

/**
 * Esquema del expediente de 1991 (`docs/historia.md`): la prueba que trae el sello de cada
 * sala. Al ganar el sello, su prueba aparece en el cuaderno, en «Expediente 1991».
 *
 * `src/content/expediente.json` trae una prueba por sala, en orden. Usa los mismos bloques que
 * las fichas de inspección (texto, nota, lista y tabla) para que el cuaderno las dibuje igual.
 *
 * Reglas de escritura (las revisa `tests/unit/expediente.test.ts`):
 * - La prueba se ve después de resolver la sala: puede nombrar la idea matemática, pero sin
 *   cuentas paso a paso.
 * - El estudiante de 1991 es siempre «E. C., 10-B». Su nombre solo aparece en los finales y
 *   en los créditos: es el giro de la historia.
 * - Sin burlas ni villanos: el jurado se equivocó por apuro.
 */

export const SALAS_EXPEDIENTE = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;

const texto = (max: number) => z.string().trim().min(1).max(max);

export const esquemaPrueba = z.strictObject({
  /** La sala cuyo sello trae esta prueba (el mismo id de `game/partida.ts`). */
  id: z.enum(SALAS_EXPEDIENTE),
  /** 1 a 5, el orden de las salas. */
  numero: z.number().int().min(1).max(5),
  /** Qué es, corto: «El recibo». */
  titulo: texto(40),
  /** Lo que dijo el jurado en 1991, entre comillas angulares. */
  acusacion: texto(160),
  /** El documento, como se ve. */
  bloques: z.array(esquemaBloque).min(1).max(5),
  /** Lo que prueba, en una frase. */
  prueba: texto(200),
});

export type PruebaExpediente = z.infer<typeof esquemaPrueba>;
