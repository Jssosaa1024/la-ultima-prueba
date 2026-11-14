import type { Puzzle } from '../../content/esquema';

/**
 * Lo que el cuaderno escribe solo al resolver (T38). Puro: se prueba sin navegador.
 *
 * Por cada etapa resuelta, lo que pasó en ella (el texto `aja` del puzzle). El nombre del
 * concepto y su explicación (`cuaderno` del puzzle) aparecen solo cuando la sala completa
 * está resuelta: el concepto se nombra después de haberlo descubierto, nunca antes.
 */
export interface Descubrimiento {
  /** Id del puzzle. */
  id: string;
  /** Número de la sala (1 a 5). */
  sala: number;
  /** Nombre de la máquina. */
  titulo: string;
  /** Lo que pasó en cada etapa resuelta, en orden. */
  etapas: string[];
  /** Solo con la sala resuelta: cómo se llama lo descubierto y su explicación. */
  concepto: { nombre: string; texto: string } | null;
}

/**
 * @param avance Etapas resueltas por sala (0 a 3), por id de sala (`s1-cooperativa`…).
 */
export function descubrimientos(
  avance: Readonly<Record<string, number>>,
  puzzles: readonly Puzzle[],
): Descubrimiento[] {
  const lista: Descubrimiento[] = [];
  for (const puzzle of puzzles) {
    const clave = Object.keys(avance).find((sala) => sala.startsWith(`s${puzzle.sala}-`));
    const resueltas = Math.min(clave ? (avance[clave] ?? 0) : 0, puzzle.etapas.length);
    if (resueltas <= 0) continue;
    lista.push({
      id: puzzle.id,
      sala: puzzle.sala,
      titulo: puzzle.titulo,
      etapas: puzzle.etapas.slice(0, resueltas).map((e) => e.aja),
      concepto:
        resueltas === puzzle.etapas.length
          ? { nombre: puzzle.cuaderno.concepto, texto: puzzle.cuaderno.texto }
          : null,
    });
  }
  return lista;
}

/** Lo que el cuaderno anota al resolver una etapa: lo que pasó y, con el sello, el concepto. */
export function anotacionDeEtapa(
  puzzle: Puzzle,
  etapa: number,
  sello: boolean,
): { paso: string; concepto: { nombre: string; texto: string } | null } | null {
  const datos = puzzle.etapas[etapa];
  if (!datos) return null;
  return {
    paso: datos.aja,
    concepto: sello ? { nombre: puzzle.cuaderno.concepto, texto: puzzle.cuaderno.texto } : null,
  };
}
