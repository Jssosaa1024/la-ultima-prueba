import { TransportePestanas } from './pestanas';
import type { Transporte } from './transporte';

/**
 * Punto de entrada del módulo `net` (T80, T79). El juego pide un transporte aquí y no sabe
 * cuál le tocó.
 *
 * - `supabase`: Supabase Realtime, cuando `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`
 *   están y son válidas.
 * - `pestanas`: BroadcastChannel entre pestañas del mismo navegador, para las e2e. Solo si
 *   faltan las variables de Supabase o con el parámetro de prueba `?red=pestanas`.
 *
 * Sin variables, el modo individual funciona igual y el cooperativo solo sirve entre pestañas
 * del mismo navegador: la interfaz debe mostrar `AVISO_SIN_SUPABASE`.
 */

export type ModoRed = 'supabase' | 'pestanas';

export interface EntornoRed {
  url?: string | undefined;
  clave?: string | undefined;
}

/** Valor exacto del parámetro de prueba; cualquier otro valor se ignora. */
const PARAMETRO_PRUEBA = 'pestanas';

/** URL de un proyecto de Supabase: `https://<ref>.supabase.co`. */
const RE_URL = /^https:\/\/[a-z0-9-]{3,64}\.supabase\.co$/;
/** Clave pública: el JWT anon o una clave `sb_publishable_…`. */
const RE_CLAVE = /^[A-Za-z0-9._-]{20,1000}$/;

/** Las variables solo cuentan si tienen la forma esperada. */
export function hayVariables(entorno: EntornoRed): boolean {
  return (
    typeof entorno.url === 'string' &&
    RE_URL.test(entorno.url) &&
    typeof entorno.clave === 'string' &&
    RE_CLAVE.test(entorno.clave)
  );
}

/** Las variables de este build (Vite reemplaza `import.meta.env` al construir). */
export function entornoDelBuild(): EntornoRed {
  return {
    url: import.meta.env.PUBLIC_SUPABASE_URL,
    clave: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** Decide qué transporte usar. `busqueda` es `location.search` (no confiable: se compara exacto). */
export function elegirRed(entorno: EntornoRed, busqueda: string): ModoRed {
  const prueba = new URLSearchParams(busqueda).get('red') === PARAMETRO_PRUEBA;
  return hayVariables(entorno) && !prueba ? 'supabase' : 'pestanas';
}

/** Texto para la interfaz cuando el cooperativo en línea no está configurado. */
export const AVISO_SIN_SUPABASE =
  'El cooperativo en línea todavía no está disponible. Por ahora solo funciona entre pestañas de este mismo navegador.';

/**
 * Transporte para el modo elegido. Supabase se carga aparte (`import()`), así la librería no
 * pesa en el modo individual.
 */
export async function crearTransporte(
  modo: ModoRed,
  entorno: EntornoRed = entornoDelBuild(),
): Promise<Transporte> {
  if (modo === 'supabase' && hayVariables(entorno)) {
    const { TransporteSupabase } = await import('./supabase');
    return new TransporteSupabase({ url: entorno.url ?? '', clave: entorno.clave ?? '' });
  }
  return new TransportePestanas();
}

export type { Transporte } from './transporte';
export { ClienteCoop } from './cliente';
export { jugadorDelNavegador } from './identidad';
export * from './protocolo';
