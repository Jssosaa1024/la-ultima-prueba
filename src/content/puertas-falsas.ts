import type { FrasePuertaFalsa } from './esquema-puertas-falsas';
import datos from './puertas-falsas.json';

/**
 * Las frases de las puertas falsas del pasillo (`docs/pasillos.md`). El JSON se valida en cada
 * build (`src/content.config.ts`) y en `tests/unit/puertas-falsas.test.ts`; aquí solo se
 * declara su tipo, sin cargar zod en el bundle del juego.
 */
export const FRASES_PUERTAS_FALSAS = datos as unknown as readonly FrasePuertaFalsa[];

export type { FrasePuertaFalsa };

/**
 * La frase de una puerta falsa por su id (el campo `falsa` del objeto), o `null` si no existe.
 * Trae `texto` (lo que sale en pantalla) o `voz` (el id de la línea de La Voz que suena con su
 * subtítulo). El id puede venir de la red: solo se busca, nunca se muestra tal cual.
 */
export function frasePuertaFalsa(id: string): FrasePuertaFalsa | null {
  return FRASES_PUERTAS_FALSAS.find((f) => f.id === id) ?? null;
}
