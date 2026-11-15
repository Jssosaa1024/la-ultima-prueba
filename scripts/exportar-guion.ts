/**
 * exportar-guion (T34a): exporta el guion de La Voz a un CSV para revisarlo y grabarlo.
 *
 *   npm run exportar-guion [-- --salida <archivo.csv>]
 *
 * Lee `src/content/guion.json`, lo valida con las mismas reglas del build y escribe
 * `docs/guion-la-voz.csv` (o el archivo de `--salida`). El CSV de `docs/` se sube al
 * repositorio para leerlo desde GitHub; un test falla si queda desactualizado.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  esquemaLineaGuion,
  problemasDelGuion,
  type LineaGuion,
} from '../src/content/esquema-guion.ts';
import { CSV_POR_DEFECTO, guionACsv } from './guion/csv.ts';

const GUION_JSON = path.join('src', 'content', 'guion.json');

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: { salida: { type: 'string', default: CSV_POR_DEFECTO } },
  });

  const crudo: unknown = JSON.parse(await readFile(GUION_JSON, 'utf8'));
  const leido = esquemaLineaGuion.array().safeParse(crudo);
  if (!leido.success) {
    console.error(`exportar-guion: ${GUION_JSON} no cumple el esquema:`);
    for (const p of leido.error.issues) console.error(`  - [${p.path.join('.')}] ${p.message}`);
    return 1;
  }
  const lineas: LineaGuion[] = leido.data;
  const problemas = problemasDelGuion(lineas);
  if (problemas.length > 0) {
    console.error('exportar-guion: el guion tiene problemas:');
    for (const p of problemas) console.error(`  - ${p}`);
    return 1;
  }

  await writeFile(values.salida, guionACsv(lineas), 'utf8');
  const segundos = lineas.reduce((s, l) => s + l.duracion_s, 0);
  console.log(
    `exportar-guion: ${lineas.length} líneas (unos ${Math.round(segundos)} s de audio) en ${values.salida}`,
  );
  return 0;
}

process.exitCode = await principal();
