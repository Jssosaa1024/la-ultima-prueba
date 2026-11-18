/**
 * Ayudas puras de `npm run efectos` (T42c): cómo se lee la configuración, qué efectos se
 * generan y dónde se guardan. No llaman a la red ni tocan archivos: tienen tests en
 * `tests/unit/efectos-grabados.test.ts`.
 */
import path from 'node:path';
import {
  EFECTOS_GRABADOS,
  esEfectoGrabado,
  type EfectoGrabado,
} from '../../src/content/audio-efectos.ts';

/** Carpeta de los efectos dentro de `art/` (Git LFS; nunca se publica). */
export const CARPETA_EFECTOS = path.join('art', 'audio', 'efectos');
export const CARPETA_ORIGINALES = path.join(CARPETA_EFECTOS, 'originales');
/** El modelo, el formato y la descripción de cada efecto. Sin claves. */
export const ARCHIVO_CONFIG = path.join(CARPETA_EFECTOS, 'efectos.json');

/** Límites de la API de efectos de sonido de ElevenLabs. */
export const DURACION_MIN_S = 0.5;
export const DURACION_MAX_S = 30;
/** Las descripciones son cortas: así se leen en los créditos. */
const TEXTO_MAX = 450;

export interface DescripcionEfecto {
  /** Qué se le pide a ElevenLabs (en inglés: así lo entiende mejor el modelo). */
  texto: string;
  /** Duración en segundos. */
  duracion: number;
}

export interface ConfigEfectos {
  modelo: string;
  formato: string;
  /** Cuánto se apega al texto (de 0 a 1). */
  influencia: number;
  efectos: Record<EfectoGrabado, DescripcionEfecto>;
}

const esNumero = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Valida `efectos.json`: cada efecto grabado tiene su descripción, y no sobra ninguno. */
export function leerConfig(crudo: unknown): ConfigEfectos | string[] {
  const problemas: string[] = [];
  if (!esObjeto(crudo)) return ['no es un objeto JSON'];
  if (typeof crudo['modelo'] !== 'string' || !/^[a-z0-9_]+$/.test(crudo['modelo'])) {
    problemas.push('«modelo» debe ser un id de modelo de ElevenLabs');
  }
  if (typeof crudo['formato'] !== 'string' || !/^mp3_\d+_\d+$/.test(crudo['formato'])) {
    problemas.push('«formato» debe ser mp3 (por ejemplo, mp3_44100_128)');
  }
  if (!esNumero(crudo['influencia'], 0, 1)) problemas.push('«influencia» va de 0 a 1');
  const efectos = crudo['efectos'];
  if (!esObjeto(efectos)) {
    problemas.push('falta «efectos»');
  } else {
    for (const nombre of Object.keys(efectos)) {
      if (!esEfectoGrabado(nombre)) problemas.push(`«${nombre}» no está en EFECTOS_GRABADOS`);
    }
    for (const nombre of EFECTOS_GRABADOS) {
      const e = efectos[nombre];
      if (!esObjeto(e)) {
        problemas.push(`falta la descripción de «${nombre}»`);
        continue;
      }
      const texto = e['texto'];
      if (typeof texto !== 'string' || texto.trim().length < 10 || texto.length > TEXTO_MAX) {
        problemas.push(`«${nombre}»: el texto va de 10 a ${TEXTO_MAX} caracteres`);
      }
      if (!esNumero(e['duracion'], DURACION_MIN_S, DURACION_MAX_S)) {
        problemas.push(`«${nombre}»: la duración va de ${DURACION_MIN_S} a ${DURACION_MAX_S} s`);
      }
    }
  }
  return problemas.length > 0 ? problemas : (crudo as unknown as ConfigEfectos);
}

/** Dónde se guarda el original de un efecto. */
export function rutaOriginal(nombre: EfectoGrabado): string {
  return path.join(CARPETA_ORIGINALES, `${nombre}.mp3`);
}

/** El cuerpo del pedido a `/v1/sound-generation`. */
export function cuerpoPedido(
  d: DescripcionEfecto,
  config: Pick<ConfigEfectos, 'modelo' | 'influencia'>,
): Record<string, unknown> {
  return {
    text: d.texto,
    duration_seconds: d.duracion,
    prompt_influence: config.influencia,
    model_id: config.modelo,
  };
}

/** Qué efectos se generan: los que faltan, o los pedidos con `--solo`, o todos con `--forzar`. */
export function pendientes(
  existe: (nombre: EfectoGrabado) => boolean,
  o: { forzar: boolean; solo: readonly string[] },
): { generar: EfectoGrabado[]; saltados: EfectoGrabado[]; desconocidos: string[] } {
  const desconocidos = o.solo.filter((s) => !esEfectoGrabado(s));
  const base =
    o.solo.length > 0 ? EFECTOS_GRABADOS.filter((n) => o.solo.includes(n)) : EFECTOS_GRABADOS;
  const generar = base.filter((n) => o.forzar || !existe(n));
  const saltados = base.filter((n) => !generar.includes(n));
  return { generar, saltados, desconocidos };
}

/** El nombre de un original (`puerta.mp3`) como efecto grabado, o `null`. */
export function efectoDeOriginal(archivo: string): EfectoGrabado | null {
  if (path.extname(archivo).toLowerCase() !== '.mp3') return null;
  const nombre = path.basename(archivo, path.extname(archivo));
  return esEfectoGrabado(nombre) ? nombre : null;
}
