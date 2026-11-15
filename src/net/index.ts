import { TransportePestanas } from './pestanas';
import type { Transporte } from './transporte';

/**
 * Punto de entrada del módulo `net` (T80). El juego pide un transporte aquí y no sabe cuál
 * le tocó.
 *
 * - `supabase`: Supabase Realtime (T79), cuando están `PUBLIC_SUPABASE_URL` y
 *   `PUBLIC_SUPABASE_ANON_KEY`.
 * - `pestanas`: BroadcastChannel entre pestañas del mismo navegador, para las e2e. Solo si
 *   faltan las variables de Supabase o con el parámetro de prueba `?red=pestanas`.
 */

export type ModoRed = 'supabase' | 'pestanas';

export interface EntornoRed {
  url?: string | undefined;
  clave?: string | undefined;
}

/** Valor exacto del parámetro de prueba; cualquier otro valor se ignora. */
const PARAMETRO_PRUEBA = 'pestanas';

/** Decide qué transporte usar. `busqueda` es `location.search` (no confiable: se compara exacto). */
export function elegirRed(entorno: EntornoRed, busqueda: string): ModoRed {
  const prueba = new URLSearchParams(busqueda).get('red') === PARAMETRO_PRUEBA;
  const hayVariables = Boolean(entorno.url && entorno.clave);
  return hayVariables && !prueba ? 'supabase' : 'pestanas';
}

/** Transporte para el modo elegido. Supabase llega con T79; mientras, se usa el de pestañas. */
export function crearTransporte(modo: ModoRed): Transporte {
  switch (modo) {
    case 'pestanas':
    case 'supabase':
      return new TransportePestanas();
  }
}

export type { Transporte } from './transporte';
export * from './protocolo';
