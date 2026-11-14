/**
 * Ayudas comunes de las animaciones de las máquinas (T58).
 */
import type { Mesh } from 'three';

/** Avance suave hacia una meta: rápido al principio y sin pasarse. */
export function acercar(actual: number, meta: number, dt: number, rapidez = 8): number {
  const d = meta - actual;
  if (Math.abs(d) < 0.001) return meta;
  return actual + d * Math.min(1, dt * rapidez);
}

/**
 * Las mallas de adorno (sombras, luces de sensor, libros) no se tocan ni tapan lo que hay
 * debajo: el rayo de la interacción las atraviesa.
 */
export function sinRayo<T extends Mesh>(malla: T): T {
  malla.raycast = () => undefined;
  return malla;
}
