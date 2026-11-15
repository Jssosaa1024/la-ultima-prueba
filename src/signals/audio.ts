import { signal } from '@preact/signals';

/**
 * Audio del juego (T43). Lo escribe engine/ (el módulo de audio) y, más adelante, la pantalla
 * de ajustes (T39) escribirá los volúmenes.
 */

/** Volúmenes de 0 a 1. `general` multiplica a los otros tres. */
export interface Volumenes {
  general: number;
  /** La Voz y las grabaciones. */
  voz: number;
  /** El fondo de cada sala, en bucle. */
  ambiente: number;
  /** Máquinas, sellos y la rectoría. */
  efectos: number;
}

/** De entrada el ambiente va por debajo de la voz, para que ella siempre se entienda. */
export const VOLUMENES_INICIALES: Readonly<Volumenes> = {
  general: 1,
  voz: 1,
  ambiente: 0.35,
  efectos: 0.7,
};

export const volumenes = signal<Readonly<Volumenes>>(VOLUMENES_INICIALES);

/**
 * Si el navegador ya deja sonar el audio. En iPhone (y en Chrome) el audio solo arranca
 * después del primer toque del jugador.
 */
export const audioDesbloqueado = signal(false);
