/**
 * Los rectángulos de piso de una sala con tramos de pasillo (`docs/pasillos.md`). Va aparte del
 * esquema (`esquema-salas.ts`), como `lugares.ts`, para que el motor lo use sin meter zod en el
 * bundle del juego (zod prueba `Function('')` al cargar y la CSP lo reporta).
 */

/** Un rectángulo de piso: de `x[0]` a `x[1]` y de `z[0]` a `z[1]`, en metros. */
export interface Rectangulo {
  x: readonly [number, number];
  z: readonly [number, number];
}

/** El rectángulo de la sala (centrado en el origen) y después sus tramos, en el mismo orden. */
export function rectangulosDe(sala: {
  ancho: number;
  fondo: number;
  tramos?: readonly Rectangulo[] | undefined;
}): Rectangulo[] {
  const { ancho: w, fondo: f } = sala;
  return [{ x: [-w / 2, w / 2], z: [-f / 2, f / 2] }, ...(sala.tramos ?? [])];
}
