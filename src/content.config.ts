import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { esquemaPuzzle } from './content/esquema';
import { esquemaFichaValidada } from './content/esquema-fichas';
import { esquemaLineaGuionValidada } from './content/esquema-guion';
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

/** Texto legible de cada objeto que se examina (T35c). */
const fichas = defineCollection({
  loader: file('./src/content/fichas.json'),
  schema: esquemaFichaValidada,
});

/** Lo que dice La Voz, con id, sala, momento y duración estimada (T34a). */
const guion = defineCollection({
  loader: file('./src/content/guion.json'),
  schema: esquemaLineaGuionValidada,
});

export const collections = { puzzles, salas, fichas, guion };
