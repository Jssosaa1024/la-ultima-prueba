/**
 * Analítica sin cookies ni datos personales (T98): qué se cuenta. Lógica pura, sin red.
 *
 * Solo contadores agregados de una lista cerrada. Ningún evento lleva id de jugador, código de
 * partida, alias, IP, navegador ni texto libre: solo qué pasó, en qué modo y, si aplica, la
 * sala o el rango de duración. La misma lista está en la función SQL
 * (`supabase/migrations/20261116120000_analitica.sql`); si cambia aquí, cambia allá.
 */

export const EVENTOS_ANALITICA = [
  'partida_iniciada',
  'sala_resuelta',
  'partida_terminada',
] as const;
export type EventoAnalitica = (typeof EVENTOS_ANALITICA)[number];

export const MODOS_ANALITICA = ['solo', 'grupo'] as const;
export type ModoAnalitica = (typeof MODOS_ANALITICA)[number];

export const SALAS_ANALITICA = ['s1', 's2', 's3', 's4', 's5'] as const;

/** Rangos de duración de la partida, en minutos de reloj activo (el reloj es de 40). */
export const RANGOS_DURACION = ['0-10', '10-20', '20-30', '30-40'] as const;
export type RangoDuracion = (typeof RANGOS_DURACION)[number];

/** Lo único que sale del navegador. */
export interface Conteo {
  evento: EventoAnalitica;
  modo: ModoAnalitica;
  /** '' para `partida_iniciada`, la sala para `sala_resuelta`, el rango para el final. */
  detalle: string;
}

/** Rango de una duración en ms (negativos cuentan como 0; más de 40 min, en el último). */
export function rangoDuracion(ms: number): RangoDuracion {
  const minutos = Number.isFinite(ms) ? Math.max(0, ms) / 60_000 : 0;
  if (minutos < 10) return '0-10';
  if (minutos < 20) return '10-20';
  if (minutos < 30) return '20-30';
  return '30-40';
}

/** La sala corta (`s1`…`s5`) de un id de sala (`s1-cooperativa`), o `null`. */
export function salaCorta(id: string): string | null {
  const corta = id.slice(0, 2);
  return (SALAS_ANALITICA as readonly string[]).includes(corta) && /^s\d(-|$)/.test(id)
    ? corta
    : null;
}

/** El conteo cumple la lista cerrada (lo mismo que revisa la función SQL). */
export function esConteo(x: unknown): x is Conteo {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  if (Object.keys(c).sort().join() !== 'detalle,evento,modo') return false;
  if (!(MODOS_ANALITICA as readonly unknown[]).includes(c['modo'])) return false;
  const detalle = c['detalle'];
  switch (c['evento']) {
    case 'partida_iniciada':
      return detalle === '';
    case 'sala_resuelta':
      return (SALAS_ANALITICA as readonly unknown[]).includes(detalle);
    case 'partida_terminada':
      return (RANGOS_DURACION as readonly unknown[]).includes(detalle);
    default:
      return false;
  }
}
