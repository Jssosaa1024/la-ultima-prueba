import { esConteo, type Conteo } from '../game/analitica';
import { entornoDelBuild, hayVariables, type EntornoRed } from './index';

/**
 * Envía los contadores de la analítica (T98) a Supabase: una llamada a la función
 * `contar_evento`, que solo suma 1 a un contador del día. Sin variables de Supabase no hace
 * nada.
 *
 * - Sin cookies (`credentials: 'omit'`) y sin decir desde qué página (`no-referrer`): la URL
 *   puede llevar `?codigo=` y no debe salir.
 * - Solo la clave pública (anon o publishable). Nada de sesión: no hace falta saber quién es.
 * - `keepalive`, para que el conteo del final llegue aunque se cierre la pestaña.
 * - Si falla, no pasa nada: el juego no depende de esto y no se reintenta.
 */

export type Contar = (c: Conteo) => void;

type Fetch = (url: string, init: RequestInit) => Promise<unknown>;

export function crearContador(
  entorno: EntornoRed = entornoDelBuild(),
  enviar: Fetch = (url, init) => fetch(url, init),
): Contar {
  if (!hayVariables(entorno)) return () => {};
  const url = `${entorno.url}/rest/v1/rpc/contar_evento`;
  const clave = entorno.clave ?? '';
  const cabeceras: Record<string, string> = { apikey: clave, 'Content-Type': 'application/json' };
  // La clave anon de siempre es un JWT y va también como `Authorization`; la `sb_publishable_`
  // no es un JWT y no debe ir ahí.
  if (clave.startsWith('eyJ')) cabeceras['Authorization'] = `Bearer ${clave}`;
  return (c) => {
    if (!esConteo(c)) return;
    try {
      void Promise.resolve(
        enviar(url, {
          method: 'POST',
          headers: cabeceras,
          body: JSON.stringify({ evento: c.evento, modo: c.modo, detalle: c.detalle }),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          keepalive: true,
        }),
      ).catch(() => undefined);
    } catch {
      // Sin red o sin fetch: no se cuenta.
    }
  };
}
