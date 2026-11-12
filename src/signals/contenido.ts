import { signal } from '@preact/signals';

/**
 * Contenido legible de los objetos con datos (T35): lo que se ve en la vista de inspección 2D.
 *
 * Lo llenará el cargador de contenido (`src/content/salas/`, T21–T22) al entrar a cada sala.
 * Mientras tanto, `signals/ejemplo.ts` pone fichas de ejemplo. El texto viene siempre del
 * bundle, nunca de la red, y se muestra con JSX normal (escapado).
 */

/** Un bloque de la ficha. Cada tipo se dibuja con HTML semántico (párrafo, tabla, lista). */
export type BloqueFicha =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'tabla'; titulo: string; columnas: readonly string[]; filas: readonly string[][] }
  | { tipo: 'lista'; items: readonly string[] }
  /** Algo escrito a mano o al margen: se ve distinto, pero se lee igual. */
  | { tipo: 'nota'; texto: string };

export interface Ficha {
  titulo: string;
  /** Qué es el objeto, en una frase. */
  descripcion?: string;
  bloques: readonly BloqueFicha[];
}

/** Fichas por id de objeto. */
export const fichas = signal<Readonly<Record<string, Ficha>>>({});
