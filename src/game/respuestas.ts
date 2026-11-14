import type { Mecanismo, Puzzle } from '../content/esquema';
import { esEstadoDeEtapa, evaluar } from './puzzles/index.ts';
import { estadosPosibles } from './puzzles/estados.ts';
import { esObjeto } from './puzzles/tipos.ts';
import { sha256 } from './sha256.ts';

/**
 * Hash del estado resuelto de cada etapa (T23).
 *
 * `hash-answers` recorre todos los estados que se pueden armar en una etapa, se queda con los
 * que la resuelven y guarda el hash de cada uno en `src/content/respuestas.json`. Con esa
 * lista, `estaResuelta` dice si un estado resuelve la etapa sin conocer la solución: solo
 * compara hashes. Funciona porque todos los controles son discretos.
 *
 * El hash se calcula sobre una forma canónica del estado, para que dos estados que la máquina
 * trata igual den lo mismo: el orden de los rodillos y el orden de los días no importan.
 */

/** Caracteres hexadecimales que se guardan de cada SHA-256 (64 bits). */
export const LARGO_HASH = 16;
export const ALGORITMO = `sha256-${LARGO_HASH}`;

export interface RespuestasDePuzzle {
  /** `version` del puzzle con la que se calcularon los hashes. */
  version: number;
  /** Por etapa, los hashes de todos los estados que la resuelven, en orden alfabético. */
  etapas: string[][];
}

export interface Respuestas {
  version: 1;
  algoritmo: string;
  puzzles: Record<string, RespuestasDePuzzle>;
}

const numeros = (x: unknown): number[] =>
  Array.isArray(x) ? x.filter((v): v is number => typeof v === 'number') : [];

/** JSON con las claves en orden alfabético: el mismo objeto siempre da el mismo texto. */
function jsonEstable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(jsonEstable).join(',')}]`;
  if (esObjeto(x)) {
    const claves = Object.keys(x).sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${jsonEstable(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x) ?? 'null';
}

/** Forma canónica de un estado: igual para todos los estados que la máquina no distingue. */
export function canonico(mecanismo: Mecanismo, estado: unknown): string {
  if (!esObjeto(estado)) return jsonEstable(estado);
  const orden = (a: number, b: number): number => a - b;
  if (mecanismo === 'etiquetadora') {
    return jsonEstable({ ...estado, rodillos: numeros(estado['rodillos']).sort(orden) });
  }
  if (mecanismo === 'carritos') {
    return jsonEstable({ ...estado, carritos: numeros(estado['carritos']).sort(orden) });
  }
  return jsonEstable(estado);
}

/** Hash de un estado en una etapa. El puzzle, su versión y la etapa van dentro del hash. */
export function hashDeEstado(puzzle: Puzzle, etapa: number, estado: unknown): string {
  const sal = `${puzzle.id}@${puzzle.version}#${etapa}|`;
  return sha256(sal + canonico(puzzle.mecanismo, estado)).slice(0, LARGO_HASH);
}

/** Hashes de todos los estados que resuelven cada etapa de un puzzle (lo usa `hash-answers`). */
export function respuestasDePuzzle(puzzle: Puzzle): RespuestasDePuzzle {
  const etapas = puzzle.etapas.map((_, i) => {
    const hashes = new Set<string>();
    for (const estado of estadosPosibles(puzzle, i)) {
      if (evaluar(puzzle, i, estado)?.resuelta) hashes.add(hashDeEstado(puzzle, i, estado));
    }
    return [...hashes].sort();
  });
  return { version: puzzle.version, etapas };
}

/** El archivo completo de respuestas para una lista de puzzles. */
export function generarRespuestas(puzzles: readonly Puzzle[]): Respuestas {
  const porId: Record<string, RespuestasDePuzzle> = {};
  for (const p of [...puzzles].sort((a, b) => a.sala - b.sala)) {
    porId[p.id] = respuestasDePuzzle(p);
  }
  return { version: 1, algoritmo: ALGORITMO, puzzles: porId };
}

/**
 * Validador: ¿este estado resuelve la etapa, según los hashes?
 *
 * Devuelve `null` si no se puede saber: el estado no es válido para la etapa (puede venir de la
 * red o de `localStorage`), o los hashes no son de esta versión del puzzle (hay que volver a
 * correr `npm run hash-answers`).
 */
export function estaResuelta(
  respuestas: Respuestas,
  puzzle: Puzzle,
  etapa: number,
  estado: unknown,
): boolean | null {
  if (respuestas.algoritmo !== ALGORITMO) return null;
  const guardadas = Object.hasOwn(respuestas.puzzles, puzzle.id)
    ? respuestas.puzzles[puzzle.id]
    : undefined;
  const hashes = guardadas?.etapas[etapa];
  if (!guardadas || guardadas.version !== puzzle.version || !hashes) return null;
  if (!esEstadoDeEtapa(puzzle, etapa, estado)) return null;
  return hashes.includes(hashDeEstado(puzzle, etapa, estado));
}
