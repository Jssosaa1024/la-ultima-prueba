/**
 * Cámara en primera persona (T14): giro horizontal (yaw) y vertical (pitch).
 * Matemática pura, sin Three, para probarla con tests; `aplicarACamara` la pasa al objeto 3D.
 */

/** Límite vertical: casi mirar al piso o al techo, sin dar la vuelta. */
export const PITCH_MAX = (80 * Math.PI) / 180;

/** Radianes por píxel CSS arrastrado en pantalla táctil: un arrastre de 360 px gira ~93°. */
export const SENSIBILIDAD_TACTIL = 0.0045;

export interface Orientacion {
  /** Giro horizontal en radianes; 0 mira hacia −Z. */
  yaw: number;
  /** Giro vertical en radianes; positivo mira hacia arriba. */
  pitch: number;
}

/** Aplica un arrastre (dx, dy en píxeles CSS). Arrastrar a la derecha gira a la derecha. */
export function girar(
  o: Orientacion,
  dx: number,
  dy: number,
  sensibilidad = SENSIBILIDAD_TACTIL,
): Orientacion {
  const vuelta = Math.PI * 2;
  let yaw = (o.yaw - dx * sensibilidad) % vuelta;
  if (yaw > Math.PI) yaw -= vuelta;
  if (yaw < -Math.PI) yaw += vuelta;
  const pitch = Math.min(PITCH_MAX, Math.max(-PITCH_MAX, o.pitch - dy * sensibilidad));
  return { yaw, pitch };
}

/** Dirección «adelante» en el piso (x, z) para un yaw dado. */
export function adelante(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Lo mínimo de una cámara de Three que se usa aquí. */
export interface CamaraRotable {
  rotation: { order: string; set(x: number, y: number, z: number): unknown };
}

export function aplicarACamara(camara: CamaraRotable, o: Orientacion): void {
  // YXZ: primero el giro horizontal y luego el vertical, como una cabeza.
  camara.rotation.order = 'YXZ';
  camara.rotation.set(o.pitch, o.yaw, 0);
}
