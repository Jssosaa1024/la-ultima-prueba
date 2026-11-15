/**
 * optimize-audio (T42): WAV a AAC mono en `.m4a`, normalizado a −16 LUFS con pico real de
 * −1,5 dBTP (EBU R128), a 48 kHz. Voz a 48 kbps; ambientes (`amb-*.wav`) a 64 kbps.
 *
 *   npm run optimize-audio
 *   npm run optimize-audio -- --entrada art/audio --salida public/assets/audio/es-CO
 *
 * Lee `art/audio/<sala>/<nombre>.wav` y escribe `public/assets/audio/es-CO/<sala>/<nombre>.m4a`.
 * Normaliza en dos pasadas con el filtro `loudnorm` de ffmpeg: la primera mide y la segunda
 * corrige de forma lineal, para no comprimir la voz. Nunca toca los originales.
 *
 * Necesita ffmpeg instalado (https://ffmpeg.org). Después se corre `npm run build-manifest`.
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  argumentosCodificacion,
  argumentosMedicion,
  correr,
  hayFfmpeg,
  leerLoudnorm,
  medir,
  planDeCodificacion,
} from './audio/sonoridad.ts';

const AYUDA = `Uso: npm run optimize-audio -- [--entrada <carpeta>] [--salida <carpeta>]

  --entrada  WAV originales, en <sala>/<nombre>.wav (por defecto, art/audio)
  --salida   carpeta de los .m4a (por defecto, public/assets/audio/es-CO)`;

/** Los .wav de la carpeta, con su ruta relativa a ella. */
async function buscarWav(carpeta: string): Promise<string[]> {
  const entradas = await readdir(carpeta, { recursive: true, withFileTypes: true }).catch(() => []);
  return entradas
    .filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === '.wav')
    .map((e) => path.relative(carpeta, path.join(e.parentPath, e.name)))
    .sort();
}

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: {
      entrada: { type: 'string', default: path.join('art', 'audio') },
      salida: { type: 'string', default: path.join('public', 'assets', 'audio', 'es-CO') },
      ayuda: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.ayuda) {
    console.log(AYUDA);
    return 0;
  }
  if (!(await hayFfmpeg())) {
    console.error('optimize-audio: no se encontró ffmpeg. Instálalo y vuelve a intentar.');
    return 1;
  }

  const archivos = await buscarWav(values.entrada);
  if (archivos.length === 0) {
    console.log(`optimize-audio: no hay archivos .wav en ${values.entrada}; nada que hacer.`);
    return 0;
  }

  let errores = 0;
  for (const relativo of archivos) {
    const plan = planDeCodificacion(relativo);
    if (typeof plan === 'string') {
      console.error(`  ✗ ${plan}`);
      errores++;
      continue;
    }
    const entrada = path.join(values.entrada, relativo);
    const salida = path.join(values.salida, plan.salida);
    const primera = await correr('ffmpeg', argumentosMedicion(entrada));
    const medida = primera.codigo === 0 ? leerLoudnorm(primera.stderr) : null;
    if (!medida) {
      console.error(`  ✗ ${relativo}: ffmpeg no pudo medirlo`);
      errores++;
      continue;
    }
    await mkdir(path.dirname(salida), { recursive: true });
    const segunda = await correr(
      'ffmpeg',
      argumentosCodificacion(entrada, salida, medida, plan.kbps),
    );
    if (segunda.codigo !== 0) {
      console.error(`  ✗ ${relativo}: ffmpeg no pudo codificarlo`);
      errores++;
      continue;
    }
    const final = await medir(salida);
    console.log(
      `  ✓ ${relativo} → ${plan.salida} (${plan.kbps} kbps): ` +
        `${Number(medida.input_i).toFixed(1)} → ${final.lufs.toFixed(1)} LUFS, ` +
        `pico ${final.picoDbtp.toFixed(1)} dBTP`,
    );
  }
  if (errores > 0) {
    console.error(`\noptimize-audio: ${errores} archivo(s) con problemas.`);
    return 1;
  }
  console.log('\noptimize-audio: listo. Ahora corre: npm run build-manifest');
  return 0;
}

process.exitCode = await principal();
