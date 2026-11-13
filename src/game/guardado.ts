import type { Puzzle } from '../content/esquema';
import {
  ETAPAS_POR_SALA,
  GRABACION_EN_SALA,
  GRABACIONES,
  numeroDeSala,
  SALAS,
  etapaActual,
  salaAbierta,
  type GrabacionId,
  type Lugar,
  type Partida,
  type SalaId,
} from './partida';
import type { EstadoPistas } from './pistas';
import { esEstadoValido } from './puzzles';
import { esEntero, esObjeto, soloClaves } from './puzzles/tipos';
import { DURACION_MS } from './reloj';

/**
 * Guardar y reanudar la partida individual tras recargar (T30).
 *
 * Safari en iPhone recarga la pestaña sin aviso cuando se queda sin memoria; con esto la
 * partida sigue donde iba. Lo guardado en `localStorage` es texto no confiable (lo puede
 * editar cualquiera): `leerGuardado` lo revisa campo por campo y arma un objeto nuevo, sin
 * copiar nada que no conozca. El almacén se recibe como parámetro para que `game/` no toque
 * el DOM y para probarlo sin navegador.
 */

export const CLAVE_GUARDADO = 'la-ultima-prueba:partida';
export const VERSION_GUARDADO = 1;
export const MAX_NOTAS = 50;
export const MAX_NOTA = 280;
export const MAX_DATOS = 100;

export interface NotaGuardada {
  id: string;
  texto: string;
}

export interface Guardado {
  v: typeof VERSION_GUARDADO;
  partida: Partida;
  /** Milisegundos de reloj activo que quedaban. Al reanudar, el reloj arranca en pausa. */
  restanteMs: number;
  /** Pistas de cada puzzle visitado. */
  pistas: Partial<Record<SalaId, EstadoPistas>>;
  /** Ajustes de cada mecanismo en su etapa actual («los mecanismos conservan sus ajustes»). */
  mecanismos: Partial<Record<SalaId, unknown>>;
  /** Cuaderno: notas del jugador e ids de los objetos con datos encontrados. */
  notas: NotaGuardada[];
  datos: string[];
}

/** Lo mínimo de `localStorage` que se usa. */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

const ID_NOTA = /^n[0-9]{1,6}$/;
const ID_DATO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Guarda la partida. Solo mientras se juega: un final borra el guardado. */
export function guardar(almacen: Almacen, g: Guardado): boolean {
  try {
    if (g.partida.fase !== 'jugando') {
      almacen.removeItem(CLAVE_GUARDADO);
      return false;
    }
    almacen.setItem(CLAVE_GUARDADO, JSON.stringify(g));
    return true;
  } catch {
    // Modo privado, cuota llena o almacenamiento bloqueado: se sigue jugando sin guardar.
    return false;
  }
}

/** Lee la partida guardada, o null si no hay, no se puede leer o no es válida. */
export function cargar(almacen: Almacen, puzzles: readonly Puzzle[]): Guardado | null {
  try {
    const texto = almacen.getItem(CLAVE_GUARDADO);
    if (texto === null || texto.length > 100_000) return null;
    return leerGuardado(JSON.parse(texto), puzzles);
  } catch {
    return null;
  }
}

export function borrarGuardado(almacen: Almacen): void {
  try {
    almacen.removeItem(CLAVE_GUARDADO);
  } catch {
    // Nada que hacer: el próximo guardado lo reemplaza.
  }
}

/** Revisa un guardado que llega de fuera y devuelve una copia limpia, o null si no sirve. */
export function leerGuardado(x: unknown, puzzles: readonly Puzzle[]): Guardado | null {
  if (!esObjeto(x)) return null;
  if (!soloClaves(x, ['v', 'partida', 'restanteMs', 'pistas', 'mecanismos', 'notas', 'datos'])) {
    return null;
  }
  if (x['v'] !== VERSION_GUARDADO) return null;

  const partida = leerPartida(x['partida']);
  if (!partida) return null;

  const restanteMs = x['restanteMs'];
  if (typeof restanteMs !== 'number' || !Number.isFinite(restanteMs)) return null;
  if (restanteMs < 0 || restanteMs > DURACION_MS) return null;

  const pistas = leerPistas(x['pistas']);
  const notas = leerNotas(x['notas']);
  const datos = leerDatos(x['datos']);
  if (!pistas || !notas || !datos) return null;

  return {
    v: VERSION_GUARDADO,
    partida,
    restanteMs,
    pistas,
    mecanismos: leerMecanismos(x['mecanismos'], partida, puzzles),
    notas,
    datos,
  };
}

function leerPartida(x: unknown): Partida | null {
  if (!esObjeto(x) || !soloClaves(x, ['fase', 'lugar', 'etapas', 'final', 'grabaciones'])) {
    return null;
  }
  // Solo se guarda mientras se juega.
  if (x['fase'] !== 'jugando' || x['final'] !== null) return null;

  const e = x['etapas'];
  if (!esObjeto(e) || !soloClaves(e, SALAS)) return null;
  const etapas = {} as Record<SalaId, number>;
  for (const s of SALAS) {
    const n = e[s];
    if (!esEntero(n) || n < 0 || n > ETAPAS_POR_SALA) return null;
    etapas[s] = n;
  }

  const lugares: readonly unknown[] = ['porteria', ...SALAS];
  const lugar = x['lugar'];
  if (!lugares.includes(lugar)) return null;

  const g = x['grabaciones'];
  if (!Array.isArray(g) || new Set(g).size !== g.length) return null;
  if (!g.every((id) => (GRABACIONES as readonly unknown[]).includes(id))) return null;

  const partida: Partida = {
    fase: 'jugando',
    lugar: lugar as Lugar,
    etapas,
    final: null,
    grabaciones: g as GrabacionId[],
  };

  // Coherencia: no hay avance en salas cerradas, ni se está en una sala cerrada, ni hay
  // grabaciones de salas que no se han abierto.
  if (SALAS.some((s) => partida.etapas[s] > 0 && !salaAbierta(partida, s))) return null;
  if (partida.lugar !== 'porteria' && !salaAbierta(partida, partida.lugar)) return null;
  if (partida.grabaciones.some((id) => !salaAbierta(partida, GRABACION_EN_SALA[id]))) return null;
  return partida;
}

function leerPistas(x: unknown): Partial<Record<SalaId, EstadoPistas>> | null {
  if (!esObjeto(x)) return null;
  const pistas: Partial<Record<SalaId, EstadoPistas>> = {};
  for (const [clave, valor] of Object.entries(x)) {
    const sala = SALAS.find((s) => s === clave);
    if (!sala || !esObjeto(valor)) return null;
    if (!soloClaves(valor, ['msEnEtapa', 'intentosEnEtapa', 'ofrecidas', 'vistas'])) return null;
    const { msEnEtapa, intentosEnEtapa, ofrecidas, vistas } = valor;
    if (typeof msEnEtapa !== 'number' || !Number.isFinite(msEnEtapa)) return null;
    if (msEnEtapa < 0 || msEnEtapa > DURACION_MS) return null;
    if (!esEntero(intentosEnEtapa) || intentosEnEtapa < 0 || intentosEnEtapa > 10_000) return null;
    if (!esEntero(ofrecidas) || ofrecidas < 0 || ofrecidas > 3) return null;
    if (!esEntero(vistas) || vistas < 0 || vistas > ofrecidas) return null;
    pistas[sala] = { msEnEtapa, intentosEnEtapa, ofrecidas, vistas };
  }
  return pistas;
}

/**
 * Los ajustes de un mecanismo se conservan solo si siguen siendo válidos para la etapa
 * actual de su sala. Si no, se descartan y la máquina arranca desde su estado inicial.
 */
function leerMecanismos(
  x: unknown,
  partida: Partida,
  puzzles: readonly Puzzle[],
): Partial<Record<SalaId, unknown>> {
  const mecanismos: Partial<Record<SalaId, unknown>> = {};
  if (!esObjeto(x)) return mecanismos;
  for (const sala of SALAS) {
    if (!Object.hasOwn(x, sala)) continue;
    const etapa = etapaActual(partida, sala);
    const puzzle = puzzles.find((p) => p.sala === numeroDeSala(sala));
    if (etapa === null || !puzzle || !esEstadoValido(puzzle, etapa, x[sala])) continue;
    // Copia por JSON: el estado ya se validó y solo tiene números, textos y listas.
    mecanismos[sala] = JSON.parse(JSON.stringify(x[sala]));
  }
  return mecanismos;
}

function leerNotas(x: unknown): NotaGuardada[] | null {
  if (!Array.isArray(x) || x.length > MAX_NOTAS) return null;
  const notas: NotaGuardada[] = [];
  for (const n of x) {
    if (!esObjeto(n) || !soloClaves(n, ['id', 'texto'])) return null;
    const { id, texto } = n;
    if (typeof id !== 'string' || !ID_NOTA.test(id)) return null;
    if (typeof texto !== 'string' || [...texto].length > MAX_NOTA) return null;
    notas.push({ id, texto });
  }
  return new Set(notas.map((n) => n.id)).size === notas.length ? notas : null;
}

function leerDatos(x: unknown): string[] | null {
  if (!Array.isArray(x) || x.length > MAX_DATOS) return null;
  if (!x.every((d) => typeof d === 'string' && d.length <= 60 && ID_DATO.test(d))) return null;
  return new Set(x).size === x.length ? (x as string[]) : null;
}
