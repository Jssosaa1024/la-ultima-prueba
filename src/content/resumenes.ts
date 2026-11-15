import { numeroDeSala, type SalaId } from '../game/partida';
import type { ResumenSala } from './esquema-resumenes';
import { puzzleDeSala } from './puzzles';
import datos from './resumenes.json';

/**
 * Resumen de aprendizaje de cada sala para los finales: el tema, la máquina y cómo funcionaba.
 *
 * El JSON se valida con el esquema en cada build (`src/content.config.ts`) y en
 * `tests/unit/aprendizaje.test.ts`; por eso aquí solo se declara su tipo, sin cargar zod en
 * el bundle del juego. Qué salas se resolvieron lo dice `game/aprendizaje.ts`.
 */
export const RESUMENES = datos as unknown as readonly ResumenSala[];

export interface TextoResumen extends ResumenSala {
  /** El nombre del concepto, el mismo que escribe el cuaderno al resolver. */
  concepto: string;
}

/** El texto de una sala, con el concepto que nombra el cuaderno. Siempre existe. */
export function textoResumen(sala: SalaId): TextoResumen {
  const r = RESUMENES.find((x) => x.id === sala);
  const concepto = puzzleDeSala(numeroDeSala(sala))?.cuaderno.concepto;
  if (!r || !concepto) throw new Error(`Falta el resumen de ${sala}`);
  return { ...r, concepto };
}
