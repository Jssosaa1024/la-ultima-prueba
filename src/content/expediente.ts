import { ETAPAS_POR_SALA } from '../game/partida';
import type { PruebaExpediente } from './esquema-expediente';
import datos from './expediente.json';

/**
 * El expediente de 1991 (`docs/historia.md`): la prueba que trae el sello de cada sala. El
 * JSON se valida en cada build (`src/content.config.ts`) y en `tests/unit/expediente.test.ts`;
 * aquí solo se declara su tipo, sin cargar zod en el bundle del juego.
 */
export const EXPEDIENTE = datos as unknown as readonly PruebaExpediente[];

export type { PruebaExpediente };

/**
 * Las pruebas que el jugador ya tiene, en orden: las de las salas con sello. Puro.
 *
 * @param avance Etapas resueltas por sala (0 a 3), por id de sala.
 * @param etapasPorSala Cuántas etapas tiene cada sala; con todas resueltas, hay sello.
 */
export function pruebasConSello(
  avance: Readonly<Record<string, number>>,
  etapasPorSala = ETAPAS_POR_SALA,
): PruebaExpediente[] {
  return EXPEDIENTE.filter((p) => (avance[p.id] ?? 0) >= etapasPorSala).sort(
    (a, b) => a.numero - b.numero,
  );
}
