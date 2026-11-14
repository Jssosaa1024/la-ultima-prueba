import type { Puzzle } from '../../content/esquema';
import { esEstadoCarritos, evaluarCarritos } from './carritos.ts';
import { esEstadoEtiquetadora, evaluarEtiquetadora } from './etiquetadora.ts';
import { esEstadoReflector, evaluarReflector } from './reflector.ts';
import { esEstadoTanques, evaluarTanques } from './tanques.ts';
import type { Evaluacion } from './tipos.ts';
import { esEstadoUrna, evaluarUrna } from './urna.ts';

/**
 * Reglas de los cinco puzzles (T26): una función pura por puzzle que recibe la etapa y el
 * estado del mecanismo y dice qué condiciones se cumplen. Las usan el panel de cada sala (por
 * ejemplo, para encender las lámparas de la biblioteca en vivo), el modo individual y el
 * anfitrión del cooperativo.
 */

export type { Condiciones, Evaluacion } from './tipos.ts';
export { precioImpreso } from './etiquetadora.ts';
export { duracionCorridaS, nivelEn } from './tanques.ts';
export { RAZON_SOMBRA, sombra } from './reflector.ts';
export { estadisticas, librosEnPila, type Estadisticas } from './carritos.ts';
export { parejas, probabilidadMismoColor } from './urna.ts';
export {
  evaluarCarritos,
  evaluarEtiquetadora,
  evaluarReflector,
  evaluarTanques,
  evaluarUrna,
  esEstadoCarritos,
  esEstadoEtiquetadora,
  esEstadoReflector,
  esEstadoTanques,
  esEstadoUrna,
};

/**
 * Evalúa un estado de cualquier puzzle. El estado se revisa primero, porque puede venir de la
 * red o de localStorage: si no es válido para esa etapa, devuelve null.
 */
export function evaluar(puzzle: Puzzle, etapa: number, estado: unknown): Evaluacion | null {
  switch (puzzle.mecanismo) {
    case 'etiquetadora': {
      const e = puzzle.etapas[etapa];
      return e && esEstadoEtiquetadora(e, estado) ? evaluarEtiquetadora(e, estado) : null;
    }
    case 'tanques': {
      const e = puzzle.etapas[etapa];
      return e && esEstadoTanques(e, estado) ? evaluarTanques(e, estado) : null;
    }
    case 'reflector': {
      const e = puzzle.etapas[etapa];
      return e && esEstadoReflector(e, estado) ? evaluarReflector(e, estado) : null;
    }
    case 'carritos': {
      const e = puzzle.etapas[etapa];
      return e && esEstadoCarritos(e, estado) ? evaluarCarritos(e, estado) : null;
    }
    case 'urna': {
      const e = puzzle.etapas[etapa];
      return e && esEstadoUrna(e, estado) ? evaluarUrna(e, estado) : null;
    }
  }
}

/**
 * Verdadero si el estado tiene la forma que permiten los controles de la etapa. No mira la
 * condición de éxito ni la solución: lo usa el validador por hashes (T23).
 */
export function esEstadoDeEtapa(puzzle: Puzzle, etapa: number, estado: unknown): boolean {
  switch (puzzle.mecanismo) {
    case 'etiquetadora': {
      const e = puzzle.etapas[etapa];
      return e !== undefined && esEstadoEtiquetadora(e, estado);
    }
    case 'tanques': {
      const e = puzzle.etapas[etapa];
      return e !== undefined && esEstadoTanques(e, estado);
    }
    case 'reflector': {
      const e = puzzle.etapas[etapa];
      return e !== undefined && esEstadoReflector(e, estado);
    }
    case 'carritos': {
      const e = puzzle.etapas[etapa];
      return e !== undefined && esEstadoCarritos(e, estado);
    }
    case 'urna': {
      const e = puzzle.etapas[etapa];
      return e !== undefined && esEstadoUrna(e, estado);
    }
  }
}

/** Verdadero si el estado es válido para esa etapa del puzzle (por ejemplo, al reanudar). */
export const esEstadoValido = (puzzle: Puzzle, etapa: number, estado: unknown): boolean =>
  evaluar(puzzle, etapa, estado) !== null;
