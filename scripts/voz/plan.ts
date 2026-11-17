/**
 * Ayudas puras de `npm run voz` (T42b): qué líneas del guion se generan, cuántos caracteres
 * gastan, dónde se guardan y cómo se lee la configuración de la voz. No llaman a la red ni
 * tocan archivos: tienen tests en `tests/unit/voz.test.ts`.
 */
import path from 'node:path';

/** Carpeta de La Voz dentro de `art/` (Git LFS; nunca se publica). */
export const CARPETA_VOZ = path.join('art', 'audio', 'voz');
export const CARPETA_ORIGINALES = path.join(CARPETA_VOZ, 'originales');
export const CARPETA_MUESTRAS = path.join(CARPETA_VOZ, 'muestras');
/** La voz elegida, el modelo y sus ajustes. Sin claves: solo ids públicos de ElevenLabs. */
export const ARCHIVO_CONFIG = path.join(CARPETA_VOZ, 'voz.json');
/** La línea con la que se comparan las voces candidatas. */
export const LINEA_MUESTRA = 'voz-intro-1';

/** Los ids del guion son también nombres de archivo: solo minúsculas, números y guiones. */
const ID_SEGURO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Ids de voz de ElevenLabs (20 caracteres alfanuméricos). */
const ID_VOZ = /^[A-Za-z0-9]{10,40}$/;

export interface AjustesVoz {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
}

export interface Candidata {
  voice_id: string;
  nombre: string;
  /** Por qué se propuso, en una frase. */
  nota: string;
}

export interface ConfigVoz {
  /** Modelo de ElevenLabs: el multilingüe. */
  modelo: string;
  /** Formato de los originales que devuelve la API. */
  formato: string;
  /** Semilla fija: la misma línea con la misma voz suena igual al regenerarla. */
  semilla: number;
  ajustes: AjustesVoz;
  candidatas: Candidata[];
  /** El `voice_id` que escogió Alex, o `null` mientras no haya escogido. */
  elegida: string | null;
}

export interface LineaVoz {
  id: string;
  texto: string;
}

const esNumero = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

/** Valida `voz.json`. Devuelve la configuración o la lista de problemas. */
export function leerConfig(crudo: unknown): ConfigVoz | string[] {
  const problemas: string[] = [];
  if (typeof crudo !== 'object' || crudo === null) return ['voz.json no es un objeto'];
  const c = crudo as Record<string, unknown>;
  if (typeof c['modelo'] !== 'string' || !/^eleven_[a-z0-9_]+$/.test(c['modelo'])) {
    problemas.push('«modelo» debe ser un id de modelo de ElevenLabs (eleven_…)');
  }
  if (typeof c['formato'] !== 'string' || !/^mp3_\d+_\d+$/.test(c['formato'])) {
    problemas.push('«formato» debe ser un formato mp3 de ElevenLabs (mp3_44100_128)');
  }
  if (!Number.isInteger(c['semilla']) || (c['semilla'] as number) < 0) {
    problemas.push('«semilla» debe ser un entero positivo');
  }
  const a = c['ajustes'] as Record<string, unknown> | undefined;
  if (
    !a ||
    !esNumero(a['stability'], 0, 1) ||
    !esNumero(a['similarity_boost'], 0, 1) ||
    !esNumero(a['style'], 0, 1) ||
    typeof a['use_speaker_boost'] !== 'boolean' ||
    !esNumero(a['speed'], 0.7, 1.2)
  ) {
    problemas.push(
      '«ajustes» necesita stability, similarity_boost y style de 0 a 1, use_speaker_boost y speed de 0,7 a 1,2',
    );
  }
  const candidatas = c['candidatas'];
  if (
    !Array.isArray(candidatas) ||
    candidatas.some(
      (v: Record<string, unknown>) =>
        typeof v?.['voice_id'] !== 'string' ||
        !ID_VOZ.test(v['voice_id']) ||
        typeof v['nombre'] !== 'string' ||
        typeof v['nota'] !== 'string',
    )
  ) {
    problemas.push('«candidatas» es una lista de { voice_id, nombre, nota }');
  }
  const elegida = c['elegida'];
  if (elegida !== null && (typeof elegida !== 'string' || !ID_VOZ.test(elegida))) {
    problemas.push('«elegida» es null o un voice_id');
  }
  return problemas.length > 0 ? problemas : (crudo as ConfigVoz);
}

/** Ruta del original de una línea, o `null` si el id no sirve como nombre de archivo. */
export function rutaOriginal(id: string, carpeta = CARPETA_ORIGINALES): string | null {
  return ID_SEGURO.test(id) ? path.join(carpeta, `${id}.mp3`) : null;
}

/** Nombre de la muestra de una voz candidata: `voz-intro-1--1-salvatore.mp3`. */
export function nombreMuestra(linea: string, orden: number, nombre: string): string {
  const corto =
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .slice(0, 3)
      .join('-') || 'voz';
  return `${linea}--${orden}-${corto}.mp3`;
}

/** Caracteres que cobra ElevenLabs por un texto (uno por carácter, espacios incluidos). */
export const caracteres = (texto: string): number => [...texto].length;

export interface Pendientes {
  /** Las líneas que se van a generar. */
  generar: LineaVoz[];
  /** Las que ya tienen original y se saltan. */
  saltadas: string[];
  /** Caracteres que se van a gastar. */
  total: number;
}

/**
 * Qué líneas generar: todas las del guion (o solo las de `solo`), menos las que ya tienen
 * original, salvo con `forzar`.
 */
export function pendientes(
  guion: readonly LineaVoz[],
  existe: (id: string) => boolean,
  opciones: { forzar?: boolean; solo?: readonly string[] } = {},
): Pendientes {
  const elegidas = opciones.solo?.length
    ? guion.filter((l) => opciones.solo?.includes(l.id))
    : [...guion];
  const generar = elegidas.filter((l) => opciones.forzar || !existe(l.id));
  const saltadas = elegidas.filter((l) => !generar.includes(l)).map((l) => l.id);
  return { generar, saltadas, total: generar.reduce((s, l) => s + caracteres(l.texto), 0) };
}

/** Los ids de `--solo` que no están en el guion. */
export function idsDesconocidos(guion: readonly LineaVoz[], solo: readonly string[]): string[] {
  return solo.filter((id) => !guion.some((l) => l.id === id));
}

/** Cuerpo del pedido de texto a voz. */
export function cuerpoPedido(texto: string, config: ConfigVoz): Record<string, unknown> {
  return {
    text: texto,
    model_id: config.modelo,
    voice_settings: config.ajustes,
    seed: config.semilla,
  };
}

/** `plan` de `art/credits.json` según el `tier` de la suscripción: solo `free` es gratis. */
export function planDeTier(tier: string): 'gratis' | 'pago' {
  return tier.trim().toLowerCase() === 'free' ? 'gratis' : 'pago';
}
