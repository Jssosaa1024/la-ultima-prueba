/** Curvas de animación comunes a las máquinas de las salas. Puras: se prueban sin navegador. */

/** De 0 a 1, suave al empezar y al terminar. Fuera de ese rango se queda en el borde. */
export function suave(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Valor entre `a` y `b` según `f` (0 = a, 1 = b). */
export const mezclar = (a: number, b: number, f: number): number => a + (b - a) * f;

/**
 * Algo que va y vuelve una vez (una palanca que baja y sube): 0 al empezar, 1 cuando va el
 * 40 % del tiempo y 0 otra vez al terminar. Fuera de la duración vale 0.
 */
export function idaYVuelta(t: number, duracion: number): number {
  if (t <= 0 || t >= duracion) return 0;
  const mitad = duracion * 0.4;
  return t < mitad ? suave(t / mitad) : 1 - suave((t - mitad) / (duracion - mitad));
}
