/**
 * build-manifest (T08): hash, bytes y triángulos por sala.
 *
 *   npm run build-manifest                pone el hash en los nombres y escribe el manifiesto
 *   npm run build-manifest -- --comprobar no cambia nada; falla si el manifiesto quedó viejo
 *
 * Se corre después de optimize-models. Lee y escribe en public/assets/.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generarManifiesto, ponerHashEnNombres, serializar } from './manifiesto/construir.ts';

const AYUDA = `Uso: npm run build-manifest -- [--comprobar] [--raiz <carpeta>]

  --comprobar  no cambia archivos; sale con error si el manifiesto no coincide con public/assets/
  --raiz       carpeta de assets (por defecto, public/assets)`;

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: {
      comprobar: { type: 'boolean', default: false },
      raiz: { type: 'string', default: path.join('public', 'assets') },
      ayuda: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.ayuda) {
    console.log(AYUDA);
    return 0;
  }
  const raiz = values.raiz;
  const destino = path.join(raiz, 'manifest.json');

  if (!values.comprobar) {
    const { renombrados, eliminados } = await ponerHashEnNombres(raiz);
    for (const { de, a } of renombrados) console.log(`renombrado  ${de} → ${a}`);
    for (const archivo of eliminados) console.log(`eliminado   ${archivo} (versión anterior)`);
  }

  const { manifiesto, problemas } = await generarManifiesto(raiz);
  if (problemas.length > 0) {
    console.error('\nProblemas en los assets:');
    for (const problema of problemas) console.error(`  - ${problema}`);
    return 1;
  }
  const texto = serializar(manifiesto);

  if (values.comprobar) {
    const actual = await readFile(destino, 'utf8').catch(() => null);
    if (actual?.replace(/\r\n/g, '\n') !== texto) {
      console.error(`${destino} no coincide con los archivos. Corre: npm run build-manifest`);
      return 1;
    }
    console.log(`${destino} está al día.`);
    return 0;
  }

  await mkdir(raiz, { recursive: true });
  await writeFile(destino, texto);

  console.log(`\nManifiesto escrito en ${destino}\n`);
  const salas = Object.entries(manifiesto.salas);
  if (salas.length === 0) console.log('Todavía no hay salas en public/assets/salas/.');
  for (const [id, { totales, archivos, audio }] of salas) {
    console.log(id);
    console.log(`  modelos     ${archivos.length} archivo(s), ${kb(totales.bytes)}`);
    console.log(`  audio       ${audio.length} archivo(s), ${kb(totales.bytesAudio)}`);
    console.log(`  triángulos  ${totales.triangulos}`);
    console.log(`  draw calls  ${totales.drawCalls}`);
    console.log(`  texturas    ${kb(totales.bytesGpu)} en GPU`);
  }
  return 0;
}

process.exitCode = await principal();
