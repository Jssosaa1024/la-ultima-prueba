/**
 * Matemática del joystick virtual (T15), sin DOM, para probarla con tests.
 *
 * El joystick es flotante: su base aparece donde el dedo toca la mitad izquierda, así el
 * jugador no tiene que apuntar a un círculo fijo. Arrastrar hacia arriba camina hacia adelante.
 */

/** Distancia en píxeles CSS para llegar a velocidad máxima. */
export const RADIO_JOYSTICK = 56;
/** Fracción del radio que se ignora, para que un dedo quieto no haga caminar. */
export const ZONA_MUERTA = 0.12;

export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Convierte el desplazamiento del dedo (dx a la derecha, dy hacia abajo, en px CSS) en un
 * vector de movimiento: `x` lateral (+ derecha), `y` hacia adelante (+ adelante), con largo
 * máximo 1 y sin la zona muerta.
 */
export function vectorJoystick(
  dx: number,
  dy: number,
  radio = RADIO_JOYSTICK,
  zonaMuerta = ZONA_MUERTA,
): Vector2D {
  const largo = Math.hypot(dx, dy) / radio;
  if (largo <= zonaMuerta) return { x: 0, y: 0 };
  const util = Math.min(1, (largo - zonaMuerta) / (1 - zonaMuerta));
  const escala = util / largo / radio;
  return { x: dx * escala, y: -dy * escala };
}

/** Recorta el desplazamiento del dedo al radio, para dibujar la perilla dentro de la base. */
export function perilla(dx: number, dy: number, radio = RADIO_JOYSTICK): Vector2D {
  const largo = Math.hypot(dx, dy);
  if (largo <= radio) return { x: dx, y: dy };
  return { x: (dx / largo) * radio, y: (dy / largo) * radio };
}
