/**
 * Ayudas de audio para optimize-audio (T42) y check-audio (T11j): llamar a ffmpeg, leer lo que
 * mide y decidir cómo se codifica cada archivo. Las funciones que no llaman a ffmpeg son puras
 * y tienen tests.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

/** Sonoridad integrada objetivo (EBU R128), en LUFS. */
export const LUFS_OBJETIVO = -16;
/** Pico real máximo, en dBTP. */
export const PICO_MAX_DBTP = -1.5;
/** Cuánto puede desviarse un archivo publicado del objetivo, en LU. */
export const TOLERANCIA_LU = 1;
/** Rango de sonoridad que se le pide a loudnorm (el de voz y ambientes cortos). */
const LRA = 11;
export const FRECUENCIA_HZ = 48_000;
/** Tasas de la especificación (sección 0): voz mono a 48 kbps y ambiente a 64 kbps. */
export const KBPS_VOZ = 48;
export const KBPS_AMBIENTE = 64;
/** Los ambientes en bucle se nombran con este prefijo (`amb-pasillo.wav`). */
export const PREFIJO_AMBIENTE = 'amb-';
/** Las carpetas de sala válidas en `art/audio/` (las de `public/assets/audio/<idioma>/`). */
export const LUGARES = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;

export interface Resultado {
  codigo: number;
  stdout: string;
  stderr: string;
}

/** Corre un programa sin shell (los argumentos no se interpretan) y junta su salida. */
export function correr(programa: string, argumentos: readonly string[]): Promise<Resultado> {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn(programa, argumentos, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    hijo.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    hijo.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    hijo.on('error', rechazar);
    hijo.on('close', (codigo) => resolver({ codigo: codigo ?? 1, stdout, stderr }));
  });
}

/** Si ffmpeg está instalado y se puede correr. */
export async function hayFfmpeg(): Promise<boolean> {
  try {
    return (await correr('ffmpeg', ['-hide_banner', '-version'])).codigo === 0;
  } catch {
    return false;
  }
}

export interface Medida {
  /** Sonoridad integrada, en LUFS. */
  lufs: number;
  /** Pico real, en dBTP. */
  picoDbtp: number;
}

/**
 * Lee el resumen que imprime el filtro `ebur128=peak=true` de ffmpeg al terminar:
 *
 *     Integrated loudness:
 *       I:         -16.0 LUFS
 *     ...
 *     True peak:
 *       Peak:       -1.6 dBFS
 */
export function leerEbur128(salida: string): Medida | null {
  const resumen = salida.slice(salida.lastIndexOf('Summary:'));
  const lufs = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(resumen)?.[1];
  const pico = /Peak:\s+(-?[\d.]+|-inf)\s+dBFS/.exec(resumen)?.[1];
  if (lufs === undefined || pico === undefined) return null;
  const numero = (t: string): number => (t === '-inf' ? -Infinity : Number(t));
  return { lufs: numero(lufs), picoDbtp: numero(pico) };
}

/** Mide la sonoridad integrada y el pico real de un archivo con ffmpeg. */
export async function medir(archivo: string): Promise<Medida> {
  const r = await correr('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    archivo,
    '-af',
    'ebur128=peak=true',
    '-f',
    'null',
    '-',
  ]);
  const medida = r.codigo === 0 ? leerEbur128(r.stderr) : null;
  if (!medida) throw new Error(`ffmpeg no pudo medir ${archivo}`);
  return medida;
}

/** Lo que mide la primera pasada de `loudnorm` (su bloque JSON al final de la salida). */
export interface MedidaLoudnorm {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

export function leerLoudnorm(salida: string): MedidaLoudnorm | null {
  const inicio = salida.lastIndexOf('{');
  const fin = salida.lastIndexOf('}');
  if (inicio < 0 || fin < inicio) return null;
  try {
    const datos = JSON.parse(salida.slice(inicio, fin + 1)) as Partial<MedidaLoudnorm>;
    const campos = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'] as const;
    if (campos.some((c) => typeof datos[c] !== 'string')) return null;
    return datos as MedidaLoudnorm;
  } catch {
    return null;
  }
}

const objetivo = `I=${LUFS_OBJETIVO}:TP=${PICO_MAX_DBTP}:LRA=${LRA}`;

/** Argumentos de la primera pasada: solo mide, no escribe nada. */
export function argumentosMedicion(entrada: string): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-i',
    entrada,
    '-af',
    `loudnorm=${objetivo}:print_format=json`,
    '-f',
    'null',
    '-',
  ];
}

/**
 * Argumentos de la segunda pasada: normaliza con lo medido (lineal, sin comprimir la voz),
 * pasa a mono a 48 kHz y codifica en AAC dentro de `.m4a`.
 */
export function argumentosCodificacion(
  entrada: string,
  salida: string,
  m: MedidaLoudnorm,
  kbps: number,
): string[] {
  const filtro =
    `loudnorm=${objetivo}:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}` +
    `:offset=${m.target_offset}:linear=true`;
  return [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    entrada,
    '-af',
    filtro,
    '-ar',
    String(FRECUENCIA_HZ),
    '-ac',
    '1',
    '-c:a',
    'aac',
    '-b:a',
    `${kbps}k`,
    // Sin metadatos del original (nombres de archivo, software): solo el audio.
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    salida,
  ];
}

/**
 * Los efectos de sonido (T42c) se normalizan por pico, no a −16 LUFS: en un golpe corto casi
 * todo el volumen es el golpe, y llevarlo a −16 LUFS sin pasarse del pico exige aplastarlo
 * (decisión de Alex, 18 de noviembre de 2026). Su pico real queda a −2 dBTP
 * (medio dB de margen para el AAC) y nunca suenan más fuerte que la voz: si un efecto largo
 * pasaría de −15 LUFS, se baja hasta −16. El juego pone el nivel de cada uno al tocarlo.
 */
export const PICO_EFECTOS_DBTP = -2;
/** Prefijo de los archivos de efectos publicados (`compartido/efecto-puerta.m4a`). */
export const PREFIJO_EFECTO = 'efecto-';

/** Si un archivo publicado es un efecto de sonido, por su nombre. */
export const esArchivoDeEfecto = (archivo: string): boolean =>
  path.basename(archivo).startsWith(PREFIJO_EFECTO);

/** La ganancia que lleva un efecto a su pico, sin pasar de −16 LUFS. */
export function gananciaDeEfecto(m: Medida): number {
  return Math.min(PICO_EFECTOS_DBTP - m.picoDbtp, LUFS_OBJETIVO - m.lufs);
}

/**
 * Si un efecto publicado cumple: el pico no pasa de −1,5 dBTP, no suena más fuerte que la voz
 * (−15 LUFS) y no quedó bajito por error (su pico a menos de 1,5 dB del objetivo, o ya a −16
 * LUFS si lo limitó la sonoridad).
 */
export function cumpleEfecto(m: Medida): boolean {
  if (!Number.isFinite(m.lufs) || !Number.isFinite(m.picoDbtp)) return false;
  const lleno = m.picoDbtp >= PICO_EFECTOS_DBTP - 1.5 || m.lufs >= LUFS_OBJETIVO - TOLERANCIA_LU;
  return m.picoDbtp <= PICO_MAX_DBTP && m.lufs <= LUFS_OBJETIVO + TOLERANCIA_LU && lleno;
}

/** Argumentos para codificar un efecto (T42c): mono a 48 kHz, con una ganancia fija y en AAC. */
export function argumentosEfecto(
  entrada: string,
  salida: string,
  gananciaDb: number,
  kbps: number,
): string[] {
  return [
    '-hide_banner',
    '-nostats',
    '-y',
    '-i',
    entrada,
    '-af',
    `aformat=sample_fmts=flt,volume=${gananciaDb.toFixed(2)}dB,aformat=channel_layouts=mono,aresample=${FRECUENCIA_HZ}`,
    '-ar',
    String(FRECUENCIA_HZ),
    '-ac',
    '1',
    '-c:a',
    'aac',
    '-b:a',
    `${kbps}k`,
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    salida,
  ];
}

export interface Plan {
  /** Ruta de salida, relativa a la carpeta de salida (`<sala>/<nombre>.m4a`). */
  salida: string;
  kbps: number;
  /** Efecto de sonido (T42c): se normaliza por pico en vez de a −16 LUFS. */
  efecto?: boolean;
}

/**
 * Dónde va y cómo se codifica un WAV de `art/audio/`, según su ruta relativa
 * (`<sala>/<nombre>.wav`). Devuelve un texto con el problema si la ruta no sirve.
 */
export function planDeCodificacion(relativo: string): Plan | string {
  const partes = relativo.split(/[\\/]/);
  if (partes.length !== 2) return `${relativo}: el audio va en art/audio/<sala>/<nombre>.wav`;
  const [sala = '', archivo = ''] = partes;
  if (!(LUGARES as readonly string[]).includes(sala)) {
    return `${relativo}: «${sala}» no es una sala (${LUGARES.join(', ')})`;
  }
  if (path.extname(archivo).toLowerCase() !== '.wav') return `${relativo}: no es un .wav`;
  const nombre = path.basename(archivo, path.extname(archivo));
  if (!/^[a-z0-9][a-z0-9-]*$/.test(nombre)) {
    return `${relativo}: el nombre solo lleva minúsculas, números y guiones`;
  }
  const kbps = nombre.startsWith(PREFIJO_AMBIENTE) ? KBPS_AMBIENTE : KBPS_VOZ;
  return { salida: `${sala}/${nombre}.m4a`, kbps };
}

/** Si una medida cumple el objetivo publicado: −16 LUFS ± 1 LU. */
export function cumpleSonoridad(m: Medida): boolean {
  return Number.isFinite(m.lufs) && Math.abs(m.lufs - LUFS_OBJETIVO) <= TOLERANCIA_LU;
}
