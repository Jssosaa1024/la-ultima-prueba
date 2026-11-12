/**
 * Caminar en el piso según la mirada (T15). Matemática pura, sin Three.
 */
import { adelante } from './camara';

/** Velocidad al empujar el joystick hasta el borde, en metros por segundo. */
export const VELOCIDAD = 2;

/**
 * Cuánto se mueve el jugador en el piso (x, z) en `dt` segundos.
 * `moverY` es hacia adelante (donde mira) y `moverX` hacia la derecha; ambos de −1 a 1.
 */
export function desplazamiento(
  yaw: number,
  moverX: number,
  moverY: number,
  dt: number,
  velocidad = VELOCIDAD,
): { x: number; z: number } {
  // En diagonal no se camina más rápido que de frente.
  const largo = Math.hypot(moverX, moverY);
  const escala = largo > 1 ? 1 / largo : 1;
  const f = adelante(yaw);
  const derecha = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const paso = velocidad * dt * escala;
  return {
    x: (f.x * moverY + derecha.x * moverX) * paso,
    z: (f.z * moverY + derecha.z * moverX) * paso,
  };
}
