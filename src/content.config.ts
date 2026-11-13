import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { esquemaPuzzle } from './content/esquema';
import { esquemaSalaValidada } from './content/esquema-salas';

/**
 * Colecciones de contenido (Astro 7 exige este archivo en `src/`). Los JSON se validan en
 * cada build: si un puzzle no cumple el esquema, `astro build` falla.
 */
const puzzles = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/puzzles' }),
  schema: esquemaPuzzle,
});

/** Distribución de la portería y las cinco salas, que el motor arma por código. */
const salas = defineCollection({
  loader: file('./src/content/salas.json'),
  schema: esquemaSalaValidada,
});

export const collections = { puzzles, salas };
