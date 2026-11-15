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
 * En un celular sostenido en vertical el juego no se juega (T41b): la interfaz tapa la
 * escena con un aviso para girar el teléfono, el reloj se pausa y el motor no dibuja.
 * Lo escribe engine/ (pantalla.ts); lo leen ui/ y el controlador de la partida.
 */
export const girarTelefono = signal(false);

/**
 * Escala dinámica de resolución (T13), de 0,5 a 1,0 sobre el DPR limitado. La escribe el
 * motor según los fps medidos; `engine/pantalla.ts` la aplica al tamaño del búfer del canvas.
 */
export const escalaResolucion = signal(1);

/**
 * Pixel ratio fijo para la prueba de estrés del panel `?debug=1` (T11p y T11q): si no es
 * `null`, manda sobre el DPR limitado y la escala dinámica. Lo escribe `src/debug/`.
 */
export const pixelRatioForzado = signal<number | null>(null);
