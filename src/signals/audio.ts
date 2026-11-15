import { signal } from '@preact/signals';

/**
 * Audio del juego (T43). Lo escribe engine/ (el módulo de audio). Los volúmenes que elige el
 * jugador están en `signals/ajustes.ts` (T39).
 */

/**
 * Si el navegador ya deja sonar el audio. En iPhone (y en Chrome) el audio solo arranca
 * después del primer toque del jugador.
 */
export const audioDesbloqueado = signal(false);
