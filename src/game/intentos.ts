import type { Puzzle } from '../content/esquema';
import { esEstadoCarritos, evaluar, librosEnPila } from './puzzles';

/**
 * Qué cuenta como «intento» (T27b), para las pistas por intentos de `pistas.ts`.
 *
 * Cada etapa trae su regla en el JSON (`intento`):
 * - `accionar`: la máquina solo responde cuando se acciona un objeto. Sala 1, bajar la
 *   palanca; sala 2, arrancar una corrida; sala 3 (etapa de la polea), soltar la polea;
 *   sala 5, tirar de la manija de la caja fuerte.
 * - `reposo`: la máquina responde en vivo y no hay nada que accionar. Sala 4 (lámparas) y
 *   las dos primeras etapas de la sala 3 (sensores). El intento se cuenta cuando, después de
 *   un cambio, el jugador deja la máquina quieta `MS_MIRAR` (3 s): es lo que tarda en mirar lo
 *   que pasó. La etapa se resuelve aparte, con los segundos de la regla (5 s).
 *
 *   Correcciones del 25 de noviembre: antes el intento esperaba los mismos 5 s que la
 *   resolución. Jugando de verdad nadie deja los carritos quietos tanto rato entre un libro y
 *   otro, así que en la sala 4 casi nunca se contaba un intento y las pistas solo llegaban a
 *   los dos minutos de una misma etapa.
 *
 * En los dos casos solo cuenta un estado «fallido»: válido, completo y que no resuelve la
 * etapa. Quien arma el panel llama a `intentoAlAccionar` o a `avanzarReposo` y, si devuelven
 * un intento, a `registrarIntento` de `pistas.ts`.
 */

export type ReglaIntento = Puzzle['etapas'][number]['intento'];

export function reglaDeIntento(puzzle: Puzzle, etapa: number): ReglaIntento | null {
  return puzzle.etapas[etapa]?.intento ?? null;
}

/**
 * Verdadero si la máquina puede mostrar un resultado con ese estado y no es el buscado.
 * En los carritos, además, la pila debe estar vacía: con libros sin repartir el jugador
 * todavía está armando el reparto.
 */
export function estadoFallido(puzzle: Puzzle, etapa: number, estado: unknown): boolean {
  const resultado = evaluar(puzzle, etapa, estado);
  if (!resultado || resultado.resuelta) return false;
  if (puzzle.mecanismo === 'carritos') {
    const e = puzzle.etapas[etapa];
    return e !== undefined && esEstadoCarritos(e, estado) && librosEnPila(e, estado) === 0;
  }
  return true;
}

/** Etapas de tipo `accionar`: ¿accionar ese objeto con ese estado cuenta como intento? */
export function intentoAlAccionar(
  puzzle: Puzzle,
  etapa: number,
  objeto: string,
  estado: unknown,
): boolean {
  const regla = reglaDeIntento(puzzle, etapa);
  return (
    regla?.tipo === 'accionar' && regla.objeto === objeto && estadoFallido(puzzle, etapa, estado)
  );
}

/** Reloj activo con la máquina quieta para que un estado fallido cuente como intento. */
export const MS_MIRAR = 3000;

/** Etapas de tipo `reposo`: cuánto lleva quieta la máquina desde el último cambio. */
export interface Reposo {
  /** Milisegundos de reloj activo sin cambios en el mecanismo. */
  msQuieto: number;
  /** Falso si no ha habido cambios o si este reposo ya se revisó (cumplió los segundos). */
  pendiente: boolean;
  /** Verdadero si este estado ya contó como intento (o ya se miró y no era fallido). */
  mirado: boolean;
}

/** Al empezar una etapa: sin cambios, nada que contar. */
export const REPOSO_INICIAL: Readonly<Reposo> = { msQuieto: 0, pendiente: false, mirado: true };

/** Llamar cada vez que el jugador cambia el mecanismo (mueve un libro, un poste, la muesca). */
export const alCambiarEstado = (): Reposo => ({ msQuieto: 0, pendiente: true, mirado: false });

/** Milisegundos que faltan para lo próximo que hará el reposo (contar intento o revisar), o null. */
export function msParaReposo(puzzle: Puzzle, etapa: number, reposo: Reposo): number | null {
  const regla = reglaDeIntento(puzzle, etapa);
  if (regla?.tipo !== 'reposo' || !reposo.pendiente) return null;
  const meta = reposo.mirado ? regla.segundos * 1000 : Math.min(MS_MIRAR, regla.segundos * 1000);
  return Math.max(0, meta - reposo.msQuieto);
}

/**
 * Suma tiempo de reloj activo (en pausa no se llama). Cuando la máquina lleva `MS_MIRAR` sin
 * cambios, `intento` es verdadero una sola vez si el estado es fallido. Cuando completa los
 * segundos de la regla, `pendiente` pasa a falso: quien llama revisa si el estado resuelve la
 * etapa. El mismo estado no vuelve a contar hasta que el jugador cambie algo.
 */
export function avanzarReposo(
  puzzle: Puzzle,
  etapa: number,
  estado: unknown,
  reposo: Reposo,
  ms: number,
): { reposo: Reposo; intento: boolean } {
  const regla = reglaDeIntento(puzzle, etapa);
  if (regla?.tipo !== 'reposo' || !reposo.pendiente || !Number.isFinite(ms) || ms <= 0) {
    return { reposo, intento: false };
  }
  const msQuieto = reposo.msQuieto + ms;
  const mira = !reposo.mirado && msQuieto >= Math.min(MS_MIRAR, regla.segundos * 1000);
  return {
    reposo: {
      msQuieto,
      pendiente: msQuieto < regla.segundos * 1000,
      mirado: reposo.mirado || mira,
    },
    intento: mira && estadoFallido(puzzle, etapa, estado),
  };
}
