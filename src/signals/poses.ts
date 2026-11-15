import { signal } from '@preact/signals';
import type { Directo } from '../game/coop/mensajes';

/**
 * Poses del cooperativo (T82). El motor y el controlador cooperativo no se conocen: se pasan
 * las poses por aquí.
 *
 * - `poseParaEnviar` la escribe el motor (a 4 Hz en movimiento, más una al detenerse) y el
 *   controlador cooperativo la envía por `dir`.
 * - `poseRecibida` la escribe el controlador con cada pose válida de otro jugador (ya pasó por
 *   la validación de `net/protocolo.ts`); el motor la guarda para interpolar.
 */
export type PoseRed = Extract<Directo, { t: 'pose' }>['p'];

export const poseParaEnviar = signal<PoseRed | null>(null);

export interface PoseRecibida {
  de: string;
  pose: PoseRed;
  /** `performance.now()` al llegar. */
  en: number;
}

export const poseRecibida = signal<PoseRecibida | null>(null);

/**
 * La última pose de cada jugador. Quien está quieto no vuelve a enviar: si su pose llegó antes
 * de que el motor estuviera listo para dibujarlo, el motor la toma de aquí.
 */
export const ultimasPoses = new Map<string, PoseRecibida>();

/** Lo llama el controlador cooperativo con cada pose de otro jugador. */
export function recibirPose(de: string, pose: PoseRed): void {
  const r = { de, pose, en: performance.now() };
  ultimasPoses.set(de, r);
  poseRecibida.value = r;
}

/** Al salir de la partida. */
export function reiniciarPoses(): void {
  ultimasPoses.clear();
  poseRecibida.value = null;
  poseParaEnviar.value = null;
}
