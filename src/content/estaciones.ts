/**
 * Las estaciones de la sala 2 (corrección del 25 de noviembre): una máquina por etapa. Cada
 * estación tiene su tanque A (y, desde la segunda, su tanque B), su tablero con la perilla y su
 * palanca, y solo resuelve su etapa. Los ids están en `salas.json`; la palanca de cada una es
 * el `intento.objeto` de su etapa en `puzzles/s2-tanques.json`.
 *
 * Sin imports: lo usan el controlador, el motor y las pruebas.
 */

export interface Estacion {
  /** Etapa que resuelve (0 = presentar, 1 = torcer, 2 = dominar). */
  etapa: number;
  tanqueA: string;
  tanqueB: string | null;
  tablero: string;
  palanca: string;
}

export const ESTACIONES: readonly Estacion[] = [1, 2, 3].map((n) => ({
  etapa: n - 1,
  tanqueA: `s2-tanque-a-${n}`,
  tanqueB: n === 1 ? null : `s2-tanque-b-${n}`,
  tablero: `s2-tablero-${n}`,
  palanca: `s2-palanca-${n}`,
}));

/** Las piezas de una estación, para buscarlas en la sala o encuadrarlas. */
export function piezasDeEstacion(e: Estacion): string[] {
  return [e.tanqueA, ...(e.tanqueB ? [e.tanqueB] : []), e.tablero, e.palanca];
}

/** La estación a la que pertenece un objeto, o `null` si no es de ninguna. */
export function estacionDeObjeto(objeto: string): Estacion | null {
  return ESTACIONES.find((e) => piezasDeEstacion(e).includes(objeto)) ?? null;
}
