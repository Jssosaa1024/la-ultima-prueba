import type { LineaGuion, MomentoGuion, SalaGuion } from './esquema-guion';
import datos from './guion.json';

/**
 * El guion de La Voz (T34a): cada línea con su id, texto, sala, momento y duración estimada.
 *
 * El JSON se valida con el esquema en cada build (`src/content.config.ts`) y en
 * `tests/unit/guion.test.ts`; por eso aquí solo se declara su tipo, sin cargar zod en el
 * bundle del juego. Los subtítulos (T34) buscan el texto por id, y el audio de La Voz se
 * llamará igual que el id (`<id>.m4a`).
 */
export const GUION = datos as unknown as readonly LineaGuion[];

/** La línea con ese id, o `null` si no existe (por ejemplo, un id que llega por la red). */
export function lineaPorId(id: string): LineaGuion | null {
  return GUION.find((l) => l.id === id) ?? null;
}

/**
 * Las líneas de un momento. Con `sala`, solo las de esa sala; las líneas `cualquiera`
 * (espera y fallo) se incluyen en todas.
 */
export function lineasDe(momento: MomentoGuion, sala?: SalaGuion): LineaGuion[] {
  return GUION.filter(
    (l) =>
      l.momento === momento && (sala === undefined || l.sala === sala || l.sala === 'cualquiera'),
  );
}
