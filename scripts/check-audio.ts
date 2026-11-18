/**
 * check-audio (T11j): falla el build si hay audio que no sirve en el sitio publicado.
 *
 *   npm run check-audio
 *
 * - Ningún `.ogg` ni `.oga` en `public/`: Safari en iPhone no los reproduce.
 * - Cada `.m4a` de `public/assets/audio/` está a −16 LUFS ± 1 LU (lo mide con ffmpeg).
 *   Los efectos de sonido (`efecto-*.m4a`, T42c) van por pico: a −2 dBTP, sin pasar de
 *   −1,5 dBTP ni de −15 LUFS (decisión de Alex, 18 de noviembre de 2026).
 *
 * Sin `.m4a` no hace falta ffmpeg. Si hay audio y ffmpeg no está, falla, salvo en el build de
 * Cloudflare Pages (variable `CF_PAGES`), que no lo trae: ahí solo avisa, porque el volumen ya
 * se midió en local con `npm run verify` antes de subir.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  cumpleEfecto,
  cumpleSonoridad,
  esArchivoDeEfecto,
  hayFfmpeg,
  LUFS_OBJETIVO,
  medir,
  PICO_EFECTOS_DBTP,
} from './audio/sonoridad.ts';

/** Extensiones de Ogg que no se pueden publicar. */
const PROHIBIDAS = ['.ogg', '.oga'];

async function archivos(carpeta: string): Promise<string[]> {
  const entradas = await readdir(carpeta, { recursive: true, withFileTypes: true }).catch(() => []);
  return entradas
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

async function principal(): Promise<number> {
  const { values } = parseArgs({
    options: {
      publico: { type: 'string', default: 'public' },
      audio: { type: 'string', default: path.join('public', 'assets', 'audio') },
    },
  });
  let problemas = 0;

  const ogg = (await archivos(values.publico)).filter((a) =>
    PROHIBIDAS.includes(path.extname(a).toLowerCase()),
  );
  for (const a of ogg) {
    console.error(
      `  ✗ ${a}: Ogg no suena en Safari de iPhone. Usa AAC (.m4a): npm run optimize-audio`,
    );
    problemas++;
  }

  const m4a = (await archivos(values.audio)).filter(
    (a) => path.extname(a).toLowerCase() === '.m4a',
  );
  if (m4a.length > 0) {
    if (!(await hayFfmpeg())) {
      if (process.env['CF_PAGES']) {
        console.warn('check-audio: sin ffmpeg en este build; el volumen se revisa en local.');
      } else {
        console.error('check-audio: hay audio y no se encontró ffmpeg para medirlo. Instálalo.');
        problemas++;
      }
    } else {
      for (const a of m4a) {
        const m = await medir(a);
        const texto = `${a}: ${m.lufs.toFixed(1)} LUFS, pico ${m.picoDbtp.toFixed(1)} dBTP`;
        const efecto = esArchivoDeEfecto(a);
        if (efecto ? cumpleEfecto(m) : cumpleSonoridad(m)) {
          console.log(`  ✓ ${texto}`);
        } else {
          const regla = efecto
            ? `efecto: pico a ${PICO_EFECTOS_DBTP} dBTP, sin pasar de −1,5 dBTP ni de −15 LUFS`
            : `debe estar a ${LUFS_OBJETIVO} ± 1 LU`;
          console.error(`  ✗ ${texto} (${regla})`);
          problemas++;
        }
      }
    }
  }

  if (problemas > 0) {
    console.error(
      `\ncheck-audio: ${problemas} problema(s). Vuelve a pasar el WAV por optimize-audio.`,
    );
    return 1;
  }
  console.log(
    m4a.length === 0
      ? 'check-audio: sin Ogg y todavía sin audio publicado.'
      : `check-audio: ${m4a.length} archivo(s) a ${LUFS_OBJETIVO} LUFS ± 1 LU (los efectos, por pico) y sin Ogg.`,
  );
  return 0;
}

process.exitCode = await principal();
