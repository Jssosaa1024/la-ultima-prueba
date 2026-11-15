import { PUZZLES } from '../content/puzzles';
import { SALAS_3D } from '../content/salas';
import {
  ASUNTOS,
  FRASES,
  MOTIVOS_RECHAZO,
  TIPOS_DIRECTO,
  TIPOS_EVENTO,
  TIPOS_INTENCION,
  type Directo,
  type Evento,
  type Foto,
  type Intencion,
} from '../game/coop/mensajes';
import { ETAPAS_POR_SALA, FINALES, GRABACIONES, SALAS } from '../game/partida';
import { esEstadoDeEtapa } from '../game/puzzles';
import { esObjeto, soloClaves } from '../game/puzzles/tipos';
import { MAX_JUGADORES, ROLES } from '../game/reparto';

/**
 * Protocolo del modo cooperativo (T80, especificación sección 3): el sobre de cada mensaje y
 * la validación estricta de todo lo que llega por la red.
 *
 * Lo que viene de otro navegador es texto no confiable. Cada mensaje se revisa entero antes
 * de usarlo: versión, canal, tipo, tamaño y cada campo contra listas conocidas (ids de
 * objetos, puzzles, salas, finales). Un mensaje con algo de más, de menos o fuera de lista se
 * descarta completo.
 */

export const VERSION_PROTOCOLO = 1;

/** Versión del contenido: si no coincide, la unión se rechaza («Actualiza la página»). */
export const VERSION_CONTENIDO = PUZZLES.map((p) => p.version).join('.');

/** Límites de tamaño (JSON en UTF-8): 1 KB por mensaje y 8 KB la foto `estado`. */
export const MAX_BYTES = 1024;
export const MAX_BYTES_ESTADO = 8192;

/** Los tres eventos Broadcast del canal. */
export const CANALES = ['int', 'evt', 'dir'] as const;
export type Canal = (typeof CANALES)[number];

// ——— Código de partida ———

/** Alfabeto del código: sin 0, O, 1, I ni L, que se confunden al dictarlo. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RE_CODIGO = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/;

export const esCodigo = (x: unknown): x is string => typeof x === 'string' && RE_CODIGO.test(x);

/** Código nuevo de 4 caracteres. `azar` devuelve un número en [0, 1). */
export function crearCodigo(azar: () => number = Math.random): string {
  let codigo = '';
  for (let i = 0; i < 4; i++) {
    const k = Math.floor(azar() * ALFABETO_CODIGO.length) % ALFABETO_CODIGO.length;
    codigo += ALFABETO_CODIGO[k];
  }
  return codigo;
}

/**
 * Lee el código de `?codigo=` (en mayúsculas, sin espacios). Devuelve null si no es válido:
 * nunca se usa un valor de la URL sin revisarlo.
 */
export function leerCodigo(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string' || valor.length > 8) return null;
  const codigo = valor.trim().toUpperCase();
  return esCodigo(codigo) ? codigo : null;
}

// ——— Identidad (Presence) ———

/** Alias que se eligen de una lista, sin nombres reales. Viaja el id. */
export const ALIAS = [
  'zorro',
  'buho',
  'colibri',
  'tortuga',
  'jaguar',
  'condor',
  'delfin',
  'oso',
  'rana',
  'tucan',
  'ardilla',
  'mono',
] as const;
export type Alias = (typeof ALIAS)[number];

/** Colores de los avatares, uno por jugador. */
export const COLORES = ['ambar', 'turquesa', 'violeta', 'coral'] as const;
export type Color = (typeof COLORES)[number];

/** Lo único que se guarda en Presence. Se escribe una vez al unirse. */
export interface Identidad {
  jugador: string;
  alias: Alias;
  color: Color;
  /** Milisegundos desde 1970 en que se unió; ordena a los jugadores y elige anfitrión. */
  unido_en: number;
  version_contenido: string;
}

const RE_JUGADOR = /^j_[a-z0-9]{4,16}$/;
export const esJugador = (x: unknown): x is string => typeof x === 'string' && RE_JUGADOR.test(x);

/** Id de jugador nuevo (se guarda en el navegador para reconectar con el mismo). */
export function crearJugador(azar: () => number = Math.random): string {
  let id = 'j_';
  for (let i = 0; i < 8; i++) id += Math.floor(azar() * 36).toString(36);
  return id;
}

const enLista = <T extends string>(lista: readonly T[], x: unknown): x is T =>
  typeof x === 'string' && (lista as readonly string[]).includes(x);

const esEntero = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

const RE_VERSION = /^[0-9.]{1,32}$/;

export function esIdentidad(x: unknown): x is Identidad {
  return (
    esObjeto(x) &&
    soloClaves(x, ['jugador', 'alias', 'color', 'unido_en', 'version_contenido']) &&
    esJugador(x['jugador']) &&
    enLista(ALIAS, x['alias']) &&
    enLista(COLORES, x['color']) &&
    esEntero(x['unido_en'], 0, 8_640_000_000_000_000) &&
    typeof x['version_contenido'] === 'string' &&
    RE_VERSION.test(x['version_contenido'])
  );
}

// ——— Listas de ids conocidos ———

const OBJETOS: ReadonlySet<string> = new Set(SALAS_3D.flatMap((s) => s.objetos.map((o) => o.id)));
const LUGARES: readonly string[] = ['porteria', ...SALAS];
const PUZZLE_IDS: readonly string[] = PUZZLES.map((p) => p.id);
const RE_CONDICION = /^[a-z0-9_]{1,24}$/;
const RE_CID_NUM = /^[0-9]{1,9}$/;

export const esObjetoConocido = (x: unknown): x is string =>
  typeof x === 'string' && OBJETOS.has(x);
const esLugar = (x: unknown): boolean => enLista(LUGARES, x);
const esPuzzle = (x: unknown): x is string => enLista(PUZZLE_IDS, x);
const esEtapa = (x: unknown): x is number => esEntero(x, 0, ETAPAS_POR_SALA - 1);
const esSala = (x: unknown): x is number => esEntero(x, 1, SALAS.length);
const esIdPropuesta = (x: unknown): x is number => esEntero(x, 1, 1_000_000_000);
const esMs = (x: unknown): x is number => esEntero(x, 0, 24 * 3600 * 1000);
const esBool = (x: unknown): x is boolean => typeof x === 'boolean';

function esListaDe(x: unknown, max: number, item: (v: unknown) => boolean, unicos = true) {
  if (!Array.isArray(x) || x.length > max || !x.every(item)) return false;
  return !unicos || new Set(x.map((v) => JSON.stringify(v))).size === x.length;
}

const esJugadores = (x: unknown): boolean => esListaDe(x, MAX_JUGADORES, esJugador);

/** El estado del mecanismo tiene la forma exacta que permiten los controles de esa etapa. */
function esEstadoDe(puzzle: unknown, etapa: unknown, estado: unknown): boolean {
  const p = PUZZLES.find((x) => x.id === puzzle);
  return p !== undefined && esEtapa(etapa) && esEstadoDeEtapa(p, etapa, estado);
}

function esOpcionVoto(asunto: unknown, opcion: unknown): boolean {
  if (asunto === 'sala') return esLugar(opcion);
  if (asunto === 'final') return opcion === 'salir' || opcion === 'restaurar';
  return opcion === null;
}

function esCondiciones(x: unknown): boolean {
  if (!esObjeto(x)) return false;
  const claves = Object.keys(x);
  return (
    claves.length >= 1 &&
    claves.length <= 12 &&
    claves.every((k) => RE_CONDICION.test(k) && esBool(x[k]))
  );
}

/** Revisa `p` según el tipo: exactamente estas claves, cada una con su revisión. */
function con(
  p: unknown,
  campos: Record<string, (v: unknown, p: Record<string, unknown>) => boolean>,
) {
  if (!esObjeto(p) || !soloClaves(p, Object.keys(campos))) return false;
  return Object.entries(campos).every(([k, revisar]) => revisar(p[k], p));
}

// ——— Contenido de cada tipo ———

const INTENCIONES: Record<Intencion['t'], (p: unknown) => boolean> = {
  listo: (p) => con(p, { listo: esBool }),
  recoger: (p) => con(p, { objeto: esObjetoConocido }),
  pasar: (p) => con(p, { objeto: esObjetoConocido, a: esJugador }),
  usar: (p) =>
    con(p, {
      herramienta: (v) => v === null || esObjetoConocido(v),
      objetivo: esObjetoConocido,
    }),
  proponer: (p) =>
    con(p, {
      puzzle: esPuzzle,
      etapa: esEtapa,
      estado: (v, q) => esEstadoDe(q['puzzle'], q['etapa'], v),
    }),
  confirmar: (p) => con(p, { propuesta: esIdPropuesta, acepta: esBool }),
  pedir_pista: (p) => con(p, { puzzle: esPuzzle }),
  votar: (p) =>
    con(p, {
      asunto: (v) => enLista(ASUNTOS, v),
      opcion: (v, q) => esOpcionVoto(q['asunto'], v),
      acepta: esBool,
    }),
  pedir_estado: (p) => con(p, { desde_n: (v) => esEntero(v, 0, 1_000_000_000) }),
};

const esUbicacion = (u: unknown): boolean =>
  con(u, {
    objeto: esObjetoConocido,
    portador: (v) => v === null || esJugador(v),
    sala: esLugar,
  });

const esPistasFoto = (x: unknown): boolean =>
  con(x, {
    ofrecidas: (v) => esEntero(v, 0, 3),
    vistas: (v) => esEntero(v, 0, 3),
    ms: esMs,
    intentos: (v) => esEntero(v, 0, 100_000),
  });

const esPropuestaAbierta = (x: unknown): boolean =>
  x === null ||
  con(x, {
    id: esIdPropuesta,
    puzzle: esPuzzle,
    etapa: esEtapa,
    por: esJugador,
    estado: (v, q) => esEstadoDe(q['puzzle'], q['etapa'], v),
    votos: (v) =>
      esListaDe(v, MAX_JUGADORES, (w) => con(w, { jugador: esJugador, acepta: esBool })),
  });

const esVotoAbierto = (x: unknown): boolean =>
  con(x, {
    asunto: (v) => enLista(ASUNTOS, v),
    opcion: (v, q) => esOpcionVoto(q['asunto'], v),
    votos: esJugadores,
  });

export const esFoto = (p: unknown): p is Foto =>
  con(p, {
    fase: (v) => v === 'espera' || v === 'jugando' || v === 'final',
    anfitrion: esJugador,
    orden: esJugadores,
    listos: esJugadores,
    lugar: esLugar,
    etapas: (v) =>
      Array.isArray(v) &&
      v.length === SALAS.length &&
      v.every((e) => esEntero(e, 0, ETAPAS_POR_SALA)),
    grabaciones: (v) => esListaDe(v, GRABACIONES.length, (g) => enLista(GRABACIONES, g)),
    final: (v) => v === null || enLista(FINALES, v),
    reloj: (v) => con(v, { restante_ms: esMs, pausado: esBool }),
    objetos: (v) => esListaDe(v, 32, esUbicacion),
    revelados: (v) => esListaDe(v, 64, esObjetoConocido),
    propuesta: esPropuestaAbierta,
    pistas: (v) => Array.isArray(v) && v.length === SALAS.length && v.every(esPistasFoto),
    votos: (v) => esListaDe(v, ASUNTOS.length, esVotoAbierto),
    ausentes: (v) => esListaDe(v, MAX_JUGADORES, (a) => con(a, { jugador: esJugador, ms: esMs })),
  });

const EVENTOS: Record<Evento['t'], (p: unknown) => boolean> = {
  estado: esFoto,
  inicio: (p) => con(p, { orden: esJugadores, restante_ms: esMs }),
  roles: (p) =>
    con(p, { sala: esSala, ...Object.fromEntries(ROLES.map((r) => [r, esJugador] as const)) }),
  objeto: esUbicacion,
  revelado: (p) => con(p, { objeto: esObjetoConocido, por: esJugador }),
  propuesta: (p) =>
    con(p, {
      id: esIdPropuesta,
      puzzle: esPuzzle,
      etapa: esEtapa,
      por: esJugador,
      estado: (v, q) => esEstadoDe(q['puzzle'], q['etapa'], v),
    }),
  confirmacion: (p) => con(p, { propuesta: esIdPropuesta, jugador: esJugador, acepta: esBool }),
  resultado: (p) =>
    con(p, {
      puzzle: esPuzzle,
      etapa: esEtapa,
      condiciones: esCondiciones,
      resuelta: esBool,
      sello: esBool,
    }),
  pista: (p) => con(p, { puzzle: esPuzzle, nivel: (v) => esEntero(v, 1, 3) }),
  voto: (p) =>
    con(p, {
      asunto: (v) => enLista(ASUNTOS, v),
      opcion: (v, q) => esOpcionVoto(q['asunto'], v),
      votos: esJugadores,
      resuelto: esBool,
    }),
  reloj: (p) => con(p, { restante_ms: esMs, pausado: esBool }),
  grabacion: (p) => con(p, { fragmento: (v) => enLista(GRABACIONES, v), por: esJugador }),
  final: (p) => con(p, { final: (v) => enLista(FINALES, v) }),
  anfitrion: (p) => con(p, { jugador: esJugador }),
  rechazo: (p) => con(p, { a: esJugador, motivo: (v) => enLista(MOTIVOS_RECHAZO, v) }),
};

/** Coordenada en cm enteros (±100 m) y giro en centésimas de grado. */
const esCm = (x: unknown): boolean => esEntero(x, -10_000, 10_000);

const DIRECTOS: Record<Directo['t'], (p: unknown) => boolean> = {
  pose: (p) =>
    con(p, {
      s: (v) => esEntero(v, 0, SALAS.length),
      x: esCm,
      y: esCm,
      z: esCm,
      yaw: (v) => esEntero(v, -36_000, 36_000),
    }),
  senal: (p) =>
    con(p, {
      s: (v) => esEntero(v, 0, SALAS.length),
      x: esCm,
      y: esCm,
      z: esCm,
      frase: (v) => v === null || enLista(FRASES, v),
    }),
};

// ——— Sobre ———

interface SobreBase {
  v: typeof VERSION_PROTOCOLO;
  de: string;
}

/** Intención: lleva `cid` (para descartar repetidas) y nunca `n`. */
export type SobreInt = SobreBase & Intencion & { cid: string; n: null };
/** Evento del anfitrión: lleva `n` creciente y nunca `cid`. */
export type SobreEvt = SobreBase & Evento & { cid: null; n: number };
/** Directo: sin `cid` ni `n`. */
export type SobreDir = SobreBase & Directo & { cid: null; n: null };

export type Sobre = SobreInt | SobreEvt | SobreDir;
export type SobreDe<C extends Canal> = C extends 'int'
  ? SobreInt
  : C extends 'evt'
    ? SobreEvt
    : SobreDir;

export const intencion = (de: string, cid: string, i: Intencion): SobreInt =>
  ({ v: VERSION_PROTOCOLO, de, cid, n: null, ...i }) as SobreInt;

export const evento = (de: string, n: number, e: Evento): SobreEvt =>
  ({ v: VERSION_PROTOCOLO, de, cid: null, n, ...e }) as SobreEvt;

export const directo = (de: string, d: Directo): SobreDir =>
  ({ v: VERSION_PROTOCOLO, de, cid: null, n: null, ...d }) as SobreDir;

/** Tamaño del mensaje en bytes, como JSON en UTF-8. */
export function bytes(x: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(x)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export type Validacion<T> = { ok: true; mensaje: T } | { ok: false; motivo: string };

const malo = (motivo: string): { ok: false; motivo: string } => ({ ok: false, motivo });

/**
 * Valida un mensaje recibido por un canal. Devuelve el mensaje tipado o el motivo del
 * descarte (para las pruebas y el panel de depuración; nunca se muestra al jugador).
 */
export function validar<C extends Canal>(canal: C, x: unknown): Validacion<SobreDe<C>> {
  if (!enLista(CANALES, canal)) return malo('canal');
  if (!esObjeto(x)) return malo('forma');
  const limite = canal === 'evt' && x['t'] === 'estado' ? MAX_BYTES_ESTADO : MAX_BYTES;
  if (bytes(x) > limite) return malo('tamano');
  if (!soloClaves(x, ['v', 't', 'de', 'cid', 'n', 'p'])) return malo('forma');
  if (x['v'] !== VERSION_PROTOCOLO) return malo('version');
  if (!esJugador(x['de'])) return malo('de');

  const t = x['t'];
  const p = x['p'];
  if (canal === 'int') {
    if (!enLista(TIPOS_INTENCION, t)) return malo('tipo');
    const cid = x['cid'];
    if (x['n'] !== null || typeof cid !== 'string') return malo('sobre');
    // El cid es «<emisor>-<número>»: nadie puede hacerse pasar por otro con un cid ajeno.
    const [emisor, num] = [cid.slice(0, cid.lastIndexOf('-')), cid.slice(cid.lastIndexOf('-') + 1)];
    if (emisor !== x['de'] || !RE_CID_NUM.test(num)) return malo('cid');
    if (!INTENCIONES[t](p)) return malo('contenido');
  } else if (canal === 'evt') {
    if (!enLista(TIPOS_EVENTO, t)) return malo('tipo');
    if (x['cid'] !== null || !esEntero(x['n'], 1, 1_000_000_000)) return malo('sobre');
    if (!EVENTOS[t](p)) return malo('contenido');
  } else {
    if (!enLista(TIPOS_DIRECTO, t)) return malo('tipo');
    if (x['cid'] !== null || x['n'] !== null) return malo('sobre');
    if (!DIRECTOS[t](p)) return malo('contenido');
  }
  return { ok: true, mensaje: x as unknown as SobreDe<C> };
}

/** Atajo: el mensaje si es válido, o null. */
export function leer<C extends Canal>(canal: C, x: unknown): SobreDe<C> | null {
  const r = validar(canal, x);
  return r.ok ? r.mensaje : null;
}
