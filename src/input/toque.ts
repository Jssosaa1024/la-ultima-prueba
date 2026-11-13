/**
 * Distinguir un toque de un arrastre (T18). Sin DOM, para probarlo con tests.
 *
 * Un toque es un dedo que baja y sube rápido sin moverse casi: selecciona el objeto que
 * está debajo. Si se movió o tardó, era mirar o caminar, y no selecciona nada.
 */

/** Movimiento máximo, en píxeles CSS, para que siga siendo un toque. */
export const MOVIMIENTO_MAX_TOQUE = 12;
/** Duración máxima de un toque, en milisegundos. */
export const DURACION_MAX_TOQUE = 350;

export interface Pulsacion {
  x: number;
  y: number;
  tiempo: number;
}

export function esToque(inicio: Pulsacion, fin: Pulsacion, recorrido: number): boolean {
  return (
    fin.tiempo - inicio.tiempo <= DURACION_MAX_TOQUE &&
    recorrido <= MOVIMIENTO_MAX_TOQUE &&
    Math.hypot(fin.x - inicio.x, fin.y - inicio.y) <= MOVIMIENTO_MAX_TOQUE
  );
}
