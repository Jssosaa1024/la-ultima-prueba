import { signal } from '@preact/signals';

/**
 * Joystick virtual que el HUD dibuja (T15). Lo escribe engine/ una vez por cuadro, solo si
 * cambió; lo lee ui/. Coordenadas en píxeles CSS desde la esquina superior izquierda del canvas.
 *
 * - `base`: donde el dedo tocó; ahí va el círculo grande.
 * - `perilla`: desplazamiento de la perilla desde la base, ya recortado al radio.
 * - `radio`: radio del círculo grande, en píxeles CSS.
 */
export interface JoystickVisible {
  baseX: number;
  baseY: number;
  perillaX: number;
  perillaY: number;
  radio: number;
}

/** `null` cuando ningún dedo usa el joystick: el HUD no lo dibuja. */
export const joystick = signal<JoystickVisible | null>(null);

/**
 * `true` mientras el ratón está bloqueado en la escena (escritorio, T19). El HUD puede dibujar
 * una mira en el centro y recordar «Esc para soltar el ratón». Lo escribe engine/.
 */
export const punteroBloqueado = signal(false);
