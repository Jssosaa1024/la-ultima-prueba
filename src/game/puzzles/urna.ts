import type { EstadoDe, EtapaDe } from '../../content/esquema';
import { esEntero, esObjeto, evaluacion, soloClaves, type Evaluacion } from './tipos.ts';

/**
 * Sala 5 · La urna. Se sacan dos fichas sin devolver: cada pareja de fichas es un resultado
 * igual de probable. Contar parejas iguales y distintas da la probabilidad.
 */

type Etapa = EtapaDe<'urna'>;
type Estado = EstadoDe<'urna'>;

const parejasDe = (n: number): number => (n * (n - 1)) / 2;

/** Parejas posibles: del mismo color y de colores distintos (lo que dibuja «ver parejas»). */
export function parejas(azules: number, amarillas: number): { iguales: number; distintas: number } {
  return { iguales: parejasDe(azules) + parejasDe(amarillas), distintas: azules * amarillas };
}

/** Probabilidad de sacar dos del mismo color, o null si hay menos de dos fichas. */
export function probabilidadMismoColor(azules: number, amarillas: number): number | null {
  const { iguales, distintas } = parejas(azules, amarillas);
  const total = iguales + distintas;
  return total === 0 ? null : iguales / total;
}

/**
 * Condiciones `fichas` (la urna tiene el total que pide la placa) y `juego` (siempre gana
 * el jugador, o hay tantas parejas iguales como distintas).
 */
export function evaluarUrna(etapa: Etapa, estado: Estado): Evaluacion {
  const { iguales, distintas } = parejas(estado.azules, estado.amarillas);
  const juego =
    etapa.exito.juego === 'siempre_gana'
      ? iguales > 0 && distintas === 0
      : iguales > 0 && iguales === distintas;
  return evaluacion({ fichas: estado.azules + estado.amarillas === etapa.exito.fichas, juego });
}

/** Revisa un estado que llega de fuera: fichas enteras y dentro de lo que dan los dispensadores. */
export function esEstadoUrna(etapa: Etapa, x: unknown): x is Estado {
  if (!esObjeto(x) || !soloClaves(x, ['azules', 'amarillas'])) return false;
  const max = etapa.controles.max_por_color;
  return [x['azules'], x['amarillas']].every((v) => esEntero(v) && v >= 0 && v <= max);
}
