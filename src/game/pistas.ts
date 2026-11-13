import type { Puzzle } from '../content/esquema';

/**
 * Pistas graduales (T27). Cada puzzle tiene tres pistas; cada una se ofrece cuando el
 * jugador lleva cierto tiempo activo en la etapa actual (`tras_segundos`) o cierta cantidad
 * de intentos fallidos en ella (`tras_intentos`), lo que pase primero. Siempre en orden: la
 * 2 nunca antes de la 1.
 *
 * Una pista ofrecida sigue disponible en las etapas siguientes del mismo puzzle. Abrirla es
 * decisión del jugador: el final muestra qué salas se resolvieron sin abrir ninguna.
 */

type Pistas = Puzzle['pistas'];

export interface EstadoPistas {
  /** Milisegundos de reloj activo en la etapa actual (el reloj en pausa no cuenta). */
  msEnEtapa: number;
  /** Intentos fallidos en la etapa actual. */
  intentosEnEtapa: number;
  /** Cuántas pistas se han ofrecido en este puzzle (0 a 3). */
  ofrecidas: number;
  /** Cuántas pistas abrió el jugador (0 a 3), siempre en orden. */
  vistas: number;
}

export const PISTAS_INICIALES: Readonly<EstadoPistas> = {
  msEnEtapa: 0,
  intentosEnEtapa: 0,
  ofrecidas: 0,
  vistas: 0,
};

/** Cuántas pistas corresponden con ese tiempo e intentos en la etapa (0 a 3). */
export function nivelPorAvance(pistas: Pistas, ms: number, intentos: number): number {
  let nivel = 0;
  for (const p of pistas) {
    const porTiempo = ms >= p.tras_segundos * 1000;
    const porIntentos = p.tras_intentos !== undefined && intentos >= p.tras_intentos;
    if (!porTiempo && !porIntentos) break;
    nivel++;
  }
  return nivel;
}

function actualizar(e: EstadoPistas, pistas: Pistas, cambios: Partial<EstadoPistas>): EstadoPistas {
  const siguiente = { ...e, ...cambios };
  const ofrecidas = Math.max(
    e.ofrecidas,
    nivelPorAvance(pistas, siguiente.msEnEtapa, siguiente.intentosEnEtapa),
  );
  return { ...siguiente, ofrecidas };
}

/** Suma tiempo activo en la etapa. Valores negativos o no finitos se ignoran. */
export function avanzarTiempo(e: EstadoPistas, pistas: Pistas, ms: number): EstadoPistas {
  if (!Number.isFinite(ms) || ms <= 0) return e;
  return actualizar(e, pistas, { msEnEtapa: e.msEnEtapa + ms });
}

/** Cuenta un intento que no resolvió la etapa (la máquina mostró lo que pasó). */
export function registrarIntento(e: EstadoPistas, pistas: Pistas): EstadoPistas {
  return actualizar(e, pistas, { intentosEnEtapa: e.intentosEnEtapa + 1 });
}

/** Al pasar a la siguiente etapa, el tiempo y los intentos vuelven a cero; lo ofrecido queda. */
export function nuevaEtapa(e: EstadoPistas): EstadoPistas {
  return { ...e, msEnEtapa: 0, intentosEnEtapa: 0 };
}

/** Abre la siguiente pista, si ya se ofreció. Si no hay ninguna nueva, lo devuelve igual. */
export function verPista(e: EstadoPistas): EstadoPistas {
  if (e.vistas >= e.ofrecidas) return e;
  return { ...e, vistas: e.vistas + 1 };
}

/** Hay una pista ofrecida que el jugador aún no abre (para mostrar el aviso en el HUD). */
export const hayPistaNueva = (e: EstadoPistas): boolean => e.vistas < e.ofrecidas;

/** Textos de las pistas que el jugador ya abrió, en orden. */
export const pistasVistas = (pistas: Pistas, e: EstadoPistas): string[] =>
  pistas.slice(0, e.vistas).map((p) => p.texto);

/** Segundos que faltan para que se ofrezca la siguiente pista por tiempo, o null si no hay más. */
export function segundosParaSiguiente(pistas: Pistas, e: EstadoPistas): number | null {
  const siguiente = pistas[e.ofrecidas];
  if (!siguiente) return null;
  return Math.max(0, Math.ceil(siguiente.tras_segundos - e.msEnEtapa / 1000));
}
