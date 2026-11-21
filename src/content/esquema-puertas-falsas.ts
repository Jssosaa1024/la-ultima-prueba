import { z } from 'astro/zod';
import { ID_FRASE } from './esquema-salas';

/**
 * Esquema de las frases de las puertas falsas del pasillo (`docs/pasillos.md`).
 *
 * Cada puerta falsa de `salas.json` lleva `falsa: <id>`. Al tocarla suena el picaporte y sale
 * su frase: un texto corto (`texto`) o una línea de La Voz (`voz`, el id de una línea de
 * `guion.json` con el momento `puerta_falsa`), nunca las dos. Ninguna frase da pistas de los
 * puzzles ni se burla de nadie.
 *
 * Lo usa `src/content.config.ts` para validar el JSON en cada build. El juego importa solo los
 * TIPOS (`src/content/puertas-falsas.ts`).
 */

/** Una frase cabe en el aviso del HUD: unas 14 palabras. */
export const MAX_CARACTERES_FRASE = 80;

export const esquemaFrasePuertaFalsa = z
  .strictObject({
    id: z.string().regex(ID_FRASE),
    /** Qué dice la placa de la puerta, para el botón del HUD y las pruebas. */
    rotulo: z.string().trim().min(1).max(24),
    texto: z.string().trim().min(1).max(MAX_CARACTERES_FRASE).optional(),
    voz: z
      .string()
      .regex(/^voz-[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
  })
  .refine((f) => (f.texto === undefined) !== (f.voz === undefined), {
    message: 'Una frase lleva «texto» o «voz» (una línea de La Voz), no las dos ni ninguna',
  });

export type FrasePuertaFalsa = z.infer<typeof esquemaFrasePuertaFalsa>;
