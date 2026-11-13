/**
 * Reloj de la partida (T25): 40 minutos activos con pausa.
 *
 * No tiene ticks: guarda cuánto quedaba en el instante `desde` y si estaba en pausa, igual
 * que el evento `reloj` del protocolo cooperativo y el signal `reloj` de
 * `src/signals/partida.ts`. Quien lo usa pasa la hora actual (`ahora`, en ms de un reloj
 * monótono como `performance.now()`), así que todo se prueba sin esperar.
 */

/** 40 minutos activos. */
export const DURACION_MS = 40 * 60 * 1000;

export interface Reloj {
  /** Milisegundos que quedaban en el instante `desde`. */
  restanteMs: number;
  pausado: boolean;
  /** Instante (ms) en que se tomó `restanteMs`. */
  desde: number;
}

/** Reloj nuevo, en pausa y con los 40 minutos completos. */
export function crearReloj(duracionMs = DURACION_MS, ahora = 0): Reloj {
  return { restanteMs: Math.max(0, duracionMs), pausado: true, desde: ahora };
}

/** Milisegundos que quedan en el instante `ahora`, nunca negativos. */
export function restante(r: Reloj, ahora: number): number {
  const ms = r.pausado ? r.restanteMs : r.restanteMs - Math.max(0, ahora - r.desde);
  return Math.max(0, ms);
}

/** Milisegundos activos ya jugados en el instante `ahora`. */
export function transcurrido(r: Reloj, ahora: number, duracionMs = DURACION_MS): number {
  return Math.max(0, duracionMs - restante(r, ahora));
}

export const agotado = (r: Reloj, ahora: number): boolean => restante(r, ahora) === 0;

/** Pausa el reloj y congela lo que queda. Si ya estaba en pausa, lo devuelve igual. */
export function pausar(r: Reloj, ahora: number): Reloj {
  if (r.pausado) return r;
  return { restanteMs: restante(r, ahora), pausado: true, desde: ahora };
}

/** Arranca o reanuda el reloj. Si ya corría o se agotó, lo devuelve igual. */
export function reanudar(r: Reloj, ahora: number): Reloj {
  if (!r.pausado || r.restanteMs === 0) return r;
  return { ...r, pausado: false, desde: ahora };
}

/**
 * Lo que queda, en minutos y segundos para mostrar (`mm:ss`). Redondea hacia arriba para
 * que «00:00» solo aparezca cuando de verdad se acabó el tiempo.
 */
export function formatoRestante(r: Reloj, ahora: number): string {
  const s = Math.ceil(restante(r, ahora) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
