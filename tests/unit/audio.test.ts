import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  argumentosCodificacion,
  correr,
  cumpleSonoridad,
  hayFfmpeg,
  KBPS_AMBIENTE,
  KBPS_VOZ,
  leerEbur128,
  leerLoudnorm,
  medir,
  planDeCodificacion,
} from '../../scripts/audio/sonoridad.ts';

// T42 (optimize-audio) y T11j (check-audio).

const ejecutar = promisify(execFile);

const RESUMEN_EBUR128 = [
  '[Parsed_ebur128_0 @ 0x1] Summary:',
  '',
  '  Integrated loudness:',
  '    I:         -16.2 LUFS',
  '    Threshold: -26.4 LUFS',
  '',
  '  True peak:',
  '    Peak:       -2.9 dBFS',
].join('\n');

describe('lectura de lo que mide ffmpeg', () => {
  it('lee la sonoridad integrada y el pico real del resumen de ebur128', () => {
    expect(leerEbur128(`ruido antes\n${RESUMEN_EBUR128}\n`)).toEqual({
      lufs: -16.2,
      picoDbtp: -2.9,
    });
  });

  it('un archivo en silencio da -inf, y una salida sin resumen, null', () => {
    const silencio = RESUMEN_EBUR128.replace('-16.2', '-inf').replace('-2.9', '-inf');
    expect(leerEbur128(silencio)).toEqual({ lufs: -Infinity, picoDbtp: -Infinity });
    expect(leerEbur128('Error opening input')).toBeNull();
  });

  it('lee el bloque JSON de la primera pasada de loudnorm', () => {
    const json = JSON.stringify({
      input_i: '-30.1',
      input_tp: '-26.0',
      input_lra: '0.0',
      input_thresh: '-40.1',
      output_i: '-16.0',
      target_offset: '0.1',
    });
    expect(leerLoudnorm(`[Parsed_loudnorm_0 @ 0x1]\n${json}\n`)).toMatchObject({
      input_i: '-30.1',
      target_offset: '0.1',
    });
    expect(leerLoudnorm('{ "input_i": "-30" }')).toBeNull();
    expect(leerLoudnorm('sin json')).toBeNull();
  });
});

describe('plan de codificación', () => {
  it('voz a 48 kbps y ambientes (amb-*) a 64 kbps, en <sala>/<nombre>.m4a', () => {
    expect(planDeCodificacion('porteria/voz-intro-1.wav')).toEqual({
      salida: 'porteria/voz-intro-1.m4a',
      kbps: KBPS_VOZ,
    });
    expect(planDeCodificacion(['s2-laboratorio', 'amb-zumbido.WAV'].join(path.sep))).toEqual({
      salida: 's2-laboratorio/amb-zumbido.m4a',
      kbps: KBPS_AMBIENTE,
    });
  });

  it('rechaza rutas fuera de una sala, otras salas, otros formatos y nombres raros', () => {
    expect(planDeCodificacion('voz.wav')).toMatch(/art\/audio\/<sala>/);
    expect(planDeCodificacion('cocina/voz.wav')).toMatch(/no es una sala/);
    expect(planDeCodificacion('porteria/voz.mp3')).toMatch(/no es un \.wav/);
    expect(planDeCodificacion('porteria/Voz Final.wav')).toMatch(/minúsculas/);
  });

  it('la segunda pasada es mono, 48 kHz, AAC y sin metadatos', () => {
    const args = argumentosCodificacion(
      'a.wav',
      'a.m4a',
      { input_i: '-30', input_tp: '-20', input_lra: '1', input_thresh: '-40', target_offset: '0' },
      48,
    ).join(' ');
    expect(args).toContain('-ar 48000 -ac 1 -c:a aac -b:a 48k -map_metadata -1');
    expect(args).toContain('I=-16:TP=-1.5');
    expect(args).toContain('linear=true');
    expect(args.endsWith('a.m4a')).toBe(true);
  });

  it('cumple con −16 LUFS ± 1 LU', () => {
    expect(cumpleSonoridad({ lufs: -16.9, picoDbtp: -3 })).toBe(true);
    expect(cumpleSonoridad({ lufs: -14.9, picoDbtp: -1 })).toBe(false);
    expect(cumpleSonoridad({ lufs: -Infinity, picoDbtp: -Infinity })).toBe(false);
  });
});

// Con ffmpeg instalado: un WAV generado aquí mismo (un tono bajito), sin descargar nada.
const conFfmpeg = await hayFfmpeg();

/** Genera un tono con ffmpeg. */
async function tono(destino: string, filtros: string[]): Promise<void> {
  const r = await correr('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=4:sample_rate=44100',
    ...filtros,
    destino,
  ]);
  expect(r.codigo).toBe(0);
}

describe.skipIf(!conFfmpeg)('optimize-audio y check-audio con ffmpeg', () => {
  let carpeta = '';
  const node = (script: string, args: string[]) =>
    ejecutar(process.execPath, [path.join('scripts', script), ...args]);

  beforeAll(async () => {
    carpeta = await mkdtemp(path.join(tmpdir(), 'audio-'));
    await mkdir(path.join(carpeta, 'art', 'porteria'), { recursive: true });
    // Estéreo, 44,1 kHz y muy bajo (unos −35 LUFS): todo lo que el script debe corregir.
    await tono(path.join(carpeta, 'art', 'porteria', 'voz-prueba.wav'), [
      '-af',
      'volume=-32dB',
      '-ac',
      '2',
    ]);
  }, 60_000);

  afterAll(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  it('el WAV queda en .m4a mono a 48 kHz y a −16 LUFS, y check-audio lo acepta', async () => {
    const salida = path.join(carpeta, 'public', 'assets', 'audio', 'es-CO');
    await node('optimize-audio.ts', ['--entrada', path.join(carpeta, 'art'), '--salida', salida]);
    const m4a = path.join(salida, 'porteria', 'voz-prueba.m4a');

    const sonda = await correr('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,sample_rate,channels',
      '-of',
      'csv=p=0',
      m4a,
    ]);
    expect(sonda.stdout.trim()).toBe('aac,48000,1');
    const m = await medir(m4a);
    expect(Math.abs(m.lufs + 16)).toBeLessThanOrEqual(1);
    expect(m.picoDbtp).toBeLessThanOrEqual(-1.4);

    const ok = await node('check-audio.ts', [
      '--publico',
      path.join(carpeta, 'public'),
      '--audio',
      path.join(carpeta, 'public', 'assets', 'audio'),
    ]);
    expect(ok.stdout).toContain('1 archivo(s) a -16 LUFS');
  }, 120_000);

  it('check-audio falla con un .ogg en public/ o con un .m4a que no está a −16 LUFS', async () => {
    const publico = path.join(carpeta, 'malo');
    const audio = path.join(publico, 'assets', 'audio', 'es-CO', 'porteria');
    await mkdir(audio, { recursive: true });
    await writeFile(path.join(publico, 'viejo.ogg'), 'no es audio');
    await tono(path.join(audio, 'bajito.m4a'), ['-af', 'volume=-30dB', '-c:a', 'aac']);
    const fallo = await node('check-audio.ts', [
      '--publico',
      publico,
      '--audio',
      path.join(publico, 'assets', 'audio'),
    ]).then(
      () => ({ code: 0, stderr: '' }),
      (e: { code: number; stderr: string }) => e,
    );
    expect(fallo.code).toBe(1);
    expect(fallo.stderr).toContain('viejo.ogg');
    expect(fallo.stderr).toContain('bajito.m4a');
  }, 120_000);
});
