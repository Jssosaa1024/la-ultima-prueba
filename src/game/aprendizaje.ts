import { numeroDeSala, SALAS, salaResuelta, type Partida, type SalaId } from './partida';
import type { EstadoPistas } from './pistas';

/**
 * Qué salas se resolvieron y cuáles sin pistas, para el resumen de aprendizaje de los finales
 * (punto 15 del hito 1).
 *
 * Todo final muestra las cinco salas, aunque no se hayan resuelto (`docs/salas-y-puzzles.md`,
 * «Ningún final castiga»). Una sala cuenta «sin pistas» si se resolvió sin abrir ninguna: que
 * el juego haya ofrecido una pista no cuenta, solo abrirla. Las pistas abiertas en una etapa
 * cuentan para toda la sala, porque siguen disponibles en las etapas siguientes (`pistas.ts`).
 *
 * Regla pura: recibe la partida y las pistas de cada sala (lo mismo que se guarda en
 * `guardado.ts`) y no toca el contenido. Los textos de cada sala están en
 * `src/content/resumenes.json`.
 */

/** Cómo terminó la sala: resuelta sin abrir pistas, resuelta con pistas o sin resolver. */
export type ResultadoSala = 'sin_pistas' | 'con_pistas' | 'sin_resolver';

export interface SalaDelResumen {
  sala: SalaId;
  /** 1 a 5. */
  numero: number;
  resultado: ResultadoSala;
  /** Etapas resueltas, de 0 a 3. */
  etapas: number;
  /** Pistas que el jugador abrió en esa sala, de 0 a 3. */
  pistasVistas: number;
}

export interface ResumenDeAprendizaje {
  /** Las cinco salas, en el orden del recorrido. */
  salas: SalaDelResumen[];
  resueltas: number;
  resueltasSinPistas: number;
}

/** Pistas abiertas en una sala; un valor raro (de un guardado editado) cuenta como ninguna. */
function vistas(e: EstadoPistas | undefined): number {
  const n = e?.vistas;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? Math.min(n, 3) : 0;
}

export function resumenDeAprendizaje(
  p: Partida,
  pistas: Readonly<Partial<Record<SalaId, EstadoPistas>>>,
): ResumenDeAprendizaje {
  const salas = SALAS.map((sala): SalaDelResumen => {
    const pistasVistas = vistas(pistas[sala]);
    const resultado: ResultadoSala = !salaResuelta(p, sala)
      ? 'sin_resolver'
      : pistasVistas === 0
        ? 'sin_pistas'
        : 'con_pistas';
    return { sala, numero: numeroDeSala(sala), resultado, etapas: p.etapas[sala], pistasVistas };
  });
  return {
    salas,
    resueltas: salas.filter((s) => s.resultado !== 'sin_resolver').length,
    resueltasSinPistas: salas.filter((s) => s.resultado === 'sin_pistas').length,
  };
}
