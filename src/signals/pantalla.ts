import { signal } from '@preact/signals';

/** Tamaño del área de juego. Lo escribe engine/, lo lee ui/. */
export interface Pantalla {
  /** Ancho en píxeles CSS. */
  ancho: number;
  /** Alto en píxeles CSS. */
  alto: number;
  /** devicePixelRatio que reporta el equipo. */
  dprEquipo: number;
  /** Pixel ratio usado para el canvas (máx. 1,25, ver especificación). */
  dprUsado: number;
}

export const pantalla = signal<Pantalla>({ ancho: 0, alto: 0, dprEquipo: 1, dprUsado: 1 });

/**
 * Escala dinámica de resolución (T13), de 0,5 a 1,0 sobre el DPR limitado. La escribe el
 * motor según los fps medidos; `engine/pantalla.ts` la aplica al tamaño del búfer del canvas.
 */
export const escalaResolucion = signal(1);
