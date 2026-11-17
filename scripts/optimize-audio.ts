/**
 * optimize-audio (T42): WAV a AAC mono en `.m4a`, normalizado a −16 LUFS con pico real de
 * −1,5 dBTP (EBU R128), a 48 kHz. Voz a 48 kbps; ambientes (`amb-*.wav`) a 64 kbps.
 *
 *   npm run optimize-audio
 *   npm run optimize-audio -- --entrada art/audio --salida public/assets/audio/es-CO
 *
 * Lee `art/audio/<sala>/<nombre>.wav` y escribe `public/assets/audio/es-CO/<sala>/<nombre>.m4a`.
 * También pasa la voz de La Voz (T42b): `art/audio/voz/originales/<id>.mp3`, que genera
 * `npm run voz`, va a `<sala>/<id>.m4a` según la sala de esa línea en el guion (las de
 * cualquier sala, a `compartido/`). Las muestras de `art/audio/voz/muestras/` no se publican.
 * Normaliza en dos pasadas con el filtro `loudnorm` de ffmpeg: la primera mide y la segunda
 * corrige de forma lineal, para no comprimir la voz. Nunca toca los originales.
 *
 * Necesita ffmpeg instalado (https://ffmpeg.org). Después se corre `npm run build-manifest`.
 */
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  argumentosCodificacion,
  argumentosMedicion,
  correr,
  hayFfmpeg,
  KBPS_VOZ,
  leerLoudnorm,
  medir,
  planDeCodificacion,
  type Plan,
} from './audio/sonoridad.ts';
import { archivoDeAudio } from '../src/content/audio-guion.ts';

const GUION_JSON = path.join('src', 'content', 'guion.json');

const AYUDA = `Uso: npm run optimize-audio -- [--entrada <carpeta>] [--salida <carpeta>] [--voz <carpeta>]

  --entrada  WAV originales, en <sala>/<nombre>.wav (por defecto, art/audio)
  --salida   carpeta de los .m4a (por defecto, public/assets/audio/es-CO)
  --voz      mp3 de La Voz, en <id>.mp3 (por defecto, <entrada>/voz/originales)`;

interface Trabajo {
  /** Cómo se nombra en la salida de consola. */
  nombre: string;
  entrada: string;
  plan: Plan;
}

/** Los mp3 de La Voz que están en el guion, con su ruta publicada. */
async function trabajosDeVoz(
  carpeta: string,
): Promise<{ trabajos: Trabajo[]; problemas: string[] }> {
  const entradas = await readdir(carpeta, { withFileTypes: true }).catch(() => []);
  const mp3 = entradas
    .filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === '.mp3')
    .map((e) => e.name)
    .sort();
  if (mp3.length === 0) return { trabajos: [], problemas: [] };
  const guion = JSON.parse(await readFile(GUION_JSON, 'utf8')) as { id: string; sala: string }[];
  const trabajos: Trabajo[] = [];
  const problemas: string[] = [];
  for (const archivo of mp3) {
    const id = path.basename(archivo, path.extname(archivo));
    const linea = guion.find((l) => l.id === id);
    const salida = linea ? archivoDeAudio(linea) : null;
    if (!salida) {
      problemas.push(`${archivo}: «${id}» no es una línea del guion`);
      continue;
    }
    trabajos.push({
      nombre: `voz/${archivo}`,
      entrada: path.join(carpeta, archivo),
      plan: { salida, kbps: KBPS_VOZ },
    });
  }
  return { trabajos, problemas };
}

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
      voz: { type: 'string' },
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

  // La carpeta de voz está dentro de art/audio: sus mp3 no son .wav, así que buscarWav no los ve.
  const trabajos: Trabajo[] = [];
  let errores = 0;
  for (const relativo of await buscarWav(values.entrada)) {
    const plan = planDeCodificacion(relativo);
    if (typeof plan === 'string') {
      console.error(`  ✗ ${plan}`);
      errores++;
      continue;
    }
    trabajos.push({ nombre: relativo, entrada: path.join(values.entrada, relativo), plan });
  }
  // Por defecto, la voz está dentro de la entrada: art/audio/voz/originales.
  const carpetaVoz = values.voz ?? path.join(values.entrada, 'voz', 'originales');
  const voz = await trabajosDeVoz(carpetaVoz);
  for (const p of voz.problemas) console.error(`  ✗ ${p}`);
  errores += voz.problemas.length;
  trabajos.push(...voz.trabajos);

  if (trabajos.length === 0 && errores === 0) {
    console.log(
      `optimize-audio: no hay audio en ${values.entrada} ni en ${carpetaVoz}; nada que hacer.`,
    );
    return 0;
  }

  for (const { nombre: relativo, entrada, plan } of trabajos) {
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
