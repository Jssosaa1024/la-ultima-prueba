import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { esquemaPuzzle } from './content/esquema';

/**
 * Colecciones de contenido (Astro 7 exige este archivo en `src/`). Los JSON se validan en
 * cada build: si un puzzle no cumple el esquema, `astro build` falla.
 */
const puzzles = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/puzzles' }),
  schema: esquemaPuzzle,
});

export const collections = { puzzles };
