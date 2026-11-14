/**
 * hash-answers (T23): guarda el hash del estado resuelto de cada etapa.
 *
 *   npm run hash-answers                 escribe src/content/respuestas.json
 *   npm run hash-answers -- --comprobar  no escribe; falla si el archivo quedó viejo
 *
 * Recorre todos los estados que se pueden armar en cada etapa de cada puzzle de
 * src/content/puzzles/ y guarda el hash de los que la resuelven. Hay que correrlo cada vez que
 * cambia un puzzle (y subir su `version`). Un test de unidad falla si el archivo no está al día.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Puzzle } from '../src/content/esquema';
import { generarRespuestas } from '../src/game/respuestas.ts';
import { serializarRespuestas } from './respuestas/serializar.ts';

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: {
      puzzles: { type: 'string', default: path.join('src', 'content', 'puzzles') },
      salida: { type: 'string', default: path.join('src', 'content', 'respuestas.json') },
      comprobar: { type: 'boolean', default: false },
    },
  });

  const archivos = (await readdir(values.puzzles)).filter((f) => f.endsWith('.json')).sort();
  if (archivos.length === 0) {
    console.error(`hash-answers: no hay puzzles en ${values.puzzles}`);
    return 1;
  }
  // El esquema ya valida estos JSON en cada build (src/content.config.ts) y en los tests.
  const puzzles = await Promise.all(
    archivos.map(
      async (f) => JSON.parse(await readFile(path.join(values.puzzles, f), 'utf8')) as Puzzle,
    ),
  );

  const respuestas = generarRespuestas(puzzles);
  for (const [id, r] of Object.entries(respuestas.puzzles)) {
    if (r.etapas.some((hashes) => hashes.length === 0)) {
      console.error(`hash-answers: ${id} tiene una etapa que ningún estado resuelve.`);
      return 1;
    }
  }
  const texto = await serializarRespuestas(respuestas);

  if (values.comprobar) {
    const enDisco = await readFile(values.salida, 'utf8').catch(() => null);
    if (enDisco?.replace(/\r\n/g, '\n') !== texto) {
      console.error(`hash-answers: ${values.salida} quedó viejo. Corre: npm run hash-answers`);
      return 1;
    }
    console.log(`hash-answers: ${values.salida} está al día.`);
    return 0;
  }

  await writeFile(values.salida, texto, 'utf8');
  for (const [id, r] of Object.entries(respuestas.puzzles)) {
    const cuenta = r.etapas.map((hashes) => hashes.length).join(', ');
    console.log(`hash-answers: ${id} v${r.version} · estados resueltos por etapa: ${cuenta}`);
  }
  console.log(`hash-answers: escrito ${values.salida}`);
  return 0;
}

process.exitCode = await principal();
