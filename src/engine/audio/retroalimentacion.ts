/**
 * Sonido de acierto o de error en cada etapa (corrección del 25 de noviembre).
 *
 * Cuando una máquina responde (signal `resultado`), o cuando una máquina en vivo queda quieta
 * en un estado que no resuelve la etapa (signal `falloEnVivo`), se pide un sonido. No suena
 * enseguida: espera a que la máquina 3D termine de moverse (la impresión, la corrida con su
 * campana, las sombras, la mano de la urna) y deja una pausa corta. Si la etapa ganó el sello
 * de la sala, el arpegio del sello suena después del acierto, con otra pausa, para no chocar.
 *
 * El motor llama a `actualizar` en cada cuadro con lo que dice la animación de la sala
 * (`animando`). Los sonidos se piden con `sonar`, así que pasan por el canal de efectos y
 * respetan su volumen. No importa Web Audio: se prueba con un reloj falso.
 */
import { effect } from '@preact/signals';
import { falloEnVivo, resultado } from '../../signals/mecanismo';
import type { NombreEfecto } from './sintesis';

/** Mínimo desde la respuesta: la animación arranca en el mismo cuadro o en el siguiente. */
export const ESPERA_MINIMA_S = 0.15;
/** La máquina debe estar quieta este tiempo antes del sonido: la pausa después de moverse. */
export const QUIETA_S = 0.3;
/** Si la animación no termina (otra sala, un error), el sonido no espera más que esto. */
export const ESPERA_MAXIMA_S = 12;
/** Desde que empieza el acierto hasta el arpegio del sello: el acierto dura unos 0,4 s. */
export const PAUSA_HASTA_EL_SELLO_S = 0.9;

export type Retro = 'acierto' | 'error';

export interface Retroalimentacion {
  /** Pide el sonido de una respuesta. Una respuesta nueva reemplaza a la que esperaba. */
  pedir(efecto: Retro, sello: boolean): void;
  /** Avanza el reloj. `animando`: la máquina de la sala todavía se mueve. */
  actualizar(dt: number, animando: boolean): void;
  /** Hay un sonido o un sello por sonar (para las pruebas). */
  readonly esperando: boolean;
}

export function crearRetroalimentacion(sonar: (efecto: NombreEfecto) => void): Retroalimentacion {
  let pendiente: { efecto: Retro; sello: boolean; t: number; quieta: number } | null = null;
  /** Segundos que faltan para el arpegio del sello, o `null`. */
  let selloEn: number | null = null;

  return {
    pedir(efecto, sello) {
      pendiente = { efecto, sello, t: 0, quieta: 0 };
    },
    actualizar(dt, animando) {
      if (selloEn !== null) {
        selloEn -= dt;
        if (selloEn <= 0) {
          selloEn = null;
          sonar('sello');
        }
      }
      if (!pendiente) return;
      pendiente.t += dt;
      pendiente.quieta = animando ? 0 : pendiente.quieta + dt;
      const listo =
        (pendiente.t >= ESPERA_MINIMA_S && pendiente.quieta >= QUIETA_S) ||
        pendiente.t >= ESPERA_MAXIMA_S;
      if (!listo) return;
      sonar(pendiente.efecto);
      if (pendiente.sello) selloEn = PAUSA_HASTA_EL_SELLO_S;
      pendiente = null;
    },
    get esperando() {
      return pendiente !== null || selloEn !== null;
    },
  };
}

/**
 * Pide los sonidos con lo que responden las máquinas. Lo que ya había respondido al empezar a
 * escuchar no suena: pasó antes. Devuelve la función para dejar de escuchar.
 */
export function escucharRetroalimentacion(retro: Retroalimentacion): () => void {
  let ultimo = resultado.peek()?.n ?? 0;
  let fallos = falloEnVivo.peek();
  const dejarResultado = effect(() => {
    const r = resultado.value;
    if (!r || r.n === ultimo) return;
    ultimo = r.n;
    retro.pedir(r.resuelta ? 'acierto' : 'error', r.sello);
  });
  const dejarFallos = effect(() => {
    const n = falloEnVivo.value;
    if (n === fallos) return;
    fallos = n;
    retro.pedir('error', false);
  });
  return () => {
    dejarResultado();
    dejarFallos();
  };
}
