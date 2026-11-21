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

/**
 * Lo que cambia para una línea: otro modelo, ajustes o semilla, o un texto con marcas de
 * entonación (`[dryly]`, `...`) que la API lee pero el subtítulo no muestra.
 */
export interface AjustesLinea {
  modelo?: string;
  semilla?: number;
  ajustes?: Partial<AjustesVoz>;
  /** Lo que se le manda a la API. Debe decir las mismas palabras que el subtítulo. */
  texto_voz?: string;
  /** Por qué se cambió, en una frase. */
  nota?: string;
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
  /** Ajustes de líneas sueltas, por id del guion. */
  lineas?: Record<string, AjustesLinea>;
}

export interface LineaVoz {
  id: string;
  texto: string;
}

const esNumero = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

const MODELO = /^eleven_[a-z0-9_]+$/;
/** Rango de cada ajuste de voz. */
const RANGOS: Record<keyof AjustesVoz, [number, number] | 'booleano'> = {
  stability: [0, 1],
  similarity_boost: [0, 1],
  style: [0, 1],
  use_speaker_boost: 'booleano',
  speed: [0.7, 1.2],
};

const ajusteValido = (clave: string, valor: unknown): boolean => {
  const rango = RANGOS[clave as keyof AjustesVoz];
  if (!rango) return false;
  return rango === 'booleano' ? typeof valor === 'boolean' : esNumero(valor, rango[0], rango[1]);
};

/** Problemas de los ajustes de una línea. */
function problemasDeLinea(id: string, crudo: unknown): string[] {
  if (!ID_SEGURO.test(id)) return [`«lineas»: «${id}» no es un id del guion`];
  if (typeof crudo !== 'object' || crudo === null) return [`«lineas.${id}» no es un objeto`];
  const problemas: string[] = [];
  const l = crudo as Record<string, unknown>;
  for (const clave of Object.keys(l)) {
    if (!['modelo', 'semilla', 'ajustes', 'texto_voz', 'nota'].includes(clave)) {
      problemas.push(`«lineas.${id}.${clave}» no se conoce`);
    }
  }
  const modelo = l['modelo'];
  if (modelo !== undefined && (typeof modelo !== 'string' || !MODELO.test(modelo))) {
    problemas.push(`«lineas.${id}.modelo» debe ser un id de modelo de ElevenLabs`);
  }
  const semilla = l['semilla'];
  if (semilla !== undefined && (!Number.isInteger(semilla) || (semilla as number) < 0)) {
    problemas.push(`«lineas.${id}.semilla» debe ser un entero positivo`);
  }
  const a = l['ajustes'];
  if (
    a !== undefined &&
    (typeof a !== 'object' || a === null || Object.entries(a).some(([k, v]) => !ajusteValido(k, v)))
  ) {
    problemas.push(`«lineas.${id}.ajustes» tiene un ajuste desconocido o fuera de rango`);
  }
  const t = l['texto_voz'];
  if (t !== undefined && (typeof t !== 'string' || t.trim() === '' || t.length > 500)) {
    problemas.push(`«lineas.${id}.texto_voz» debe ser un texto de 1 a 500 caracteres`);
  }
  if (l['nota'] !== undefined && typeof l['nota'] !== 'string') {
    problemas.push(`«lineas.${id}.nota» debe ser un texto`);
  }
  return problemas;
}

/** Valida `voz.json`. Devuelve la configuración o la lista de problemas. */
export function leerConfig(crudo: unknown): ConfigVoz | string[] {
  const problemas: string[] = [];
  if (typeof crudo !== 'object' || crudo === null) return ['voz.json no es un objeto'];
  const c = crudo as Record<string, unknown>;
  if (typeof c['modelo'] !== 'string' || !MODELO.test(c['modelo'])) {
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
  const lineas = c['lineas'];
  if (lineas !== undefined) {
    if (typeof lineas !== 'object' || lineas === null || Array.isArray(lineas)) {
      problemas.push('«lineas» es un objeto por id del guion');
    } else {
      for (const [id, l] of Object.entries(lineas)) problemas.push(...problemasDeLinea(id, l));
    }
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

/** Lo que se le manda a la API por una línea: su texto de voz, su modelo y el cuerpo. */
export function pedidoDeLinea(
  linea: LineaVoz,
  config: ConfigVoz,
): { texto: string; modelo: string; cuerpo: Record<string, unknown> } {
  const l = config.lineas?.[linea.id];
  const texto = l?.texto_voz ?? linea.texto;
  const modelo = l?.modelo ?? config.modelo;
  return {
    texto,
    modelo,
    cuerpo: {
      text: texto,
      model_id: modelo,
      voice_settings: { ...config.ajustes, ...l?.ajustes },
      seed: l?.semilla ?? config.semilla,
    },
  };
}

/** Las palabras de un texto, sin marcas `[...]`, puntuación ni mayúsculas. */
export function palabras(texto: string): string[] {
  return texto
    .replace(/\[[^\]]*\]/g, ' ')
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Los ids de `lineas` que no están en el guion o cuyo `texto_voz` no dice las mismas palabras
 * que el subtítulo: el subtítulo tiene que coincidir con lo que se oye.
 */
export function lineasQueNoCuadran(config: ConfigVoz, guion: readonly LineaVoz[]): string[] {
  return Object.entries(config.lineas ?? {})
    .filter(([id, l]) => {
      const linea = guion.find((g) => g.id === id);
      if (!linea) return true;
      if (l.texto_voz === undefined) return false;
      return palabras(l.texto_voz).join(' ') !== palabras(linea.texto).join(' ');
    })
    .map(([id]) => id);
}

/** `plan` de `art/credits.json` según el `tier` de la suscripción: solo `free` es gratis. */
export function planDeTier(tier: string): 'gratis' | 'pago' {
  return tier.trim().toLowerCase() === 'free' ? 'gratis' : 'pago';
}
