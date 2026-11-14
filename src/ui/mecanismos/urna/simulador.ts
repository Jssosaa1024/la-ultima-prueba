/**
 * Simulador de la sala 5 (T70): saca dos fichas sin devolver, muchas veces, y cuenta cuántas
 * parejas salieron del mismo color. Puro, con el azar por parámetro, para probarlo.
 *
 * Es una herramienta del jugador para mirar qué pasa con su urna: no cuenta como intento ni
 * decide si la etapa está resuelta (eso lo hacen las reglas de `game/puzzles/urna.ts`).
 */

export interface ResultadoSimulacion {
  /** Extracciones hechas. */
  veces: number;
  /** Parejas del mismo color: gana el jugador. */
  iguales: number;
  /** Parejas de distinto color: gana La Voz. */
  distintas: number;
}

/** Extracciones que hace el simulador cada vez. */
export const EXTRACCIONES = 100;

/**
 * @param azar Número al azar en [0, 1), como `Math.random`.
 * @returns `null` si en la urna hay menos de dos fichas: no se puede sacar una pareja.
 */
export function simular(
  azules: number,
  amarillas: number,
  veces: number = EXTRACCIONES,
  azar: () => number = Math.random,
): ResultadoSimulacion | null {
  const total = azules + amarillas;
  if (total < 2 || veces <= 0) return null;
  let iguales = 0;
  for (let i = 0; i < veces; i++) {
    // Primera ficha: azul con probabilidad azules / total.
    const primeraAzul = azar() * total < azules;
    // Segunda, sin devolver la primera: queda una menos de ese color.
    const azulesQuedan = azules - (primeraAzul ? 1 : 0);
    const segundaAzul = azar() * (total - 1) < azulesQuedan;
    if (primeraAzul === segundaAzul) iguales++;
  }
  return { veces, iguales, distintas: veces - iguales };
}

/** Una pareja de fichas: cada ficha es azul (`a`) o amarilla (`m`). */
export type Pareja = readonly ['a' | 'm', 'a' | 'm'];

/**
 * Todas las parejas que se pueden sacar de la urna, cada una una sola vez: es lo que dibuja
 * «ver parejas». Primero las del mismo color y después las de distinto color.
 */
export function listaDeParejas(
  azules: number,
  amarillas: number,
): { iguales: Pareja[]; distintas: Pareja[] } {
  const fichas: ('a' | 'm')[] = [
    ...Array.from({ length: azules }, () => 'a' as const),
    ...Array.from({ length: amarillas }, () => 'm' as const),
  ];
  const iguales: Pareja[] = [];
  const distintas: Pareja[] = [];
  for (let i = 0; i < fichas.length; i++) {
    for (let j = i + 1; j < fichas.length; j++) {
      const a = fichas[i];
      const b = fichas[j];
      if (!a || !b) continue;
      (a === b ? iguales : distintas).push([a, b]);
    }
  }
  return { iguales, distintas };
}
