import { evaluar } from '../puzzles';
import { iguales } from '../puzzles/tipos';
import {
  aplicar,
  crearPartida,
  etapaActual,
  GRABACIONES,
  numeroDeSala,
  opcionesDeFinal,
  SALAS,
  salaResuelta,
  type Lugar,
  type Partida,
  type SalaId,
} from '../partida';
import {
  avanzarTiempo,
  nuevaEtapa,
  PISTAS_INICIALES,
  registrarIntento,
  verPista,
  type EstadoPistas,
} from '../pistas';
import {
  agotado,
  crearReloj,
  DURACION_MS,
  pausar,
  reanudar,
  restante,
  transcurrido,
  type Reloj,
} from '../reloj';
import {
  ESPERA_RECONEXION_MS,
  MAX_JUGADORES,
  repartirConAusencias,
  type Reparto,
  type RepartoConAusencias,
} from '../reparto';
import type {
  Asunto,
  Evento,
  Foto,
  Intencion,
  OpcionVoto,
  PropuestaAbierta,
  UbicacionObjeto,
  VotoAbierto,
} from './mensajes';
import { completa, elegir, type Apariencia, type Eleccion } from './apariencia';
import { efectoDeUsar, esRecogible, lugarInicial, puzzleDeLugar, puzzlePorId } from './mundo';

/**
 * El anfitrión autoritativo del cooperativo, en reglas puras (T84, T85, T87).
 *
 * Quien crea la partida guarda esta `Sesion` y decide todo: quién entra, reloj, objetos,
 * propuestas, pistas, votos y finales. Cada función recibe la sesión, lo que pasó y la hora
 * (`ahora`, en ms) y devuelve la sesión nueva con los eventos que hay que difundir. Si la
 * intención no se acepta, devuelve la MISMA sesión y ningún evento: la máquina no dice
 * «incorrecto», simplemente no pasa nada.
 *
 * Las reglas de la partida son las del modo individual (`partida.ts`, `pistas.ts`,
 * `reparto.ts`, `puzzles/`); aquí solo se agregan los turnos del grupo.
 */

/** Mínimo de jugadores para empezar: el cooperativo es de 2 a 4. */
export const MIN_JUGADORES = 2;

export type FaseSesion = Foto['fase'];

export interface Sesion {
  fase: FaseSesion;
  anfitrion: string;
  /** En la espera, los unidos en orden; al empezar queda fijo (T29). */
  orden: string[];
  listos: string[];
  partida: Partida;
  reloj: Reloj;
  /** Objetos que se movieron de su lugar inicial. */
  objetos: UbicacionObjeto[];
  revelados: string[];
  propuesta: PropuestaAbierta | null;
  sigPropuesta: number;
  /** Pistas por sala, en el orden de `SALAS`. */
  pistas: EstadoPistas[];
  /** Milisegundos activos ya sumados al tiempo de las pistas. */
  activoVisto: number;
  votos: VotoAbierto[];
  /** Jugadores en Presence, por orden de llegada. */
  conectados: string[];
  /** Desde cuándo falta cada jugador de `orden` (ms del reloj del anfitrión). */
  ausentesDesde: Record<string, number>;
  /** Último reparto emitido para el lugar actual (null en la portería). */
  roles: Reparto | null;
  /** Alias y color aceptados de cada jugador de `orden` (T81b). */
  apariencias: readonly Apariencia[];
}

export interface Paso {
  s: Sesion;
  eventos: Evento[];
}

const quieto = (s: Sesion): Paso => ({ s, eventos: [] });

export function crearSesion(anfitrion: string, ahora: number): Sesion {
  return {
    fase: 'espera',
    anfitrion,
    orden: [anfitrion],
    listos: [],
    partida: crearPartida(),
    reloj: crearReloj(DURACION_MS, ahora),
    objetos: [],
    revelados: [],
    propuesta: null,
    sigPropuesta: 1,
    pistas: SALAS.map(() => ({ ...PISTAS_INICIALES })),
    activoVisto: 0,
    votos: [],
    conectados: [anfitrion],
    ausentesDesde: {},
    roles: null,
    apariencias: [],
  };
}

// ——— Foto ———

const entero = (x: number, max = 24 * 3600 * 1000): number =>
  Math.min(max, Math.max(0, Math.round(x)));

/** Foto completa para el evento `estado`. */
export function fotoEn(s: Sesion, ahora: number): Foto {
  return {
    fase: s.fase,
    anfitrion: s.anfitrion,
    orden: [...s.orden],
    listos: [...s.listos],
    lugar: s.partida.lugar,
    etapas: SALAS.map((id) => s.partida.etapas[id]),
    grabaciones: [...s.partida.grabaciones],
    final: s.partida.final,
    reloj: { restante_ms: entero(restante(s.reloj, ahora)), pausado: s.reloj.pausado },
    objetos: s.objetos.map((o) => ({ ...o })),
    revelados: [...s.revelados],
    propuesta: s.propuesta && {
      ...s.propuesta,
      votos: s.propuesta.votos.map((v) => ({ ...v })),
    },
    pistas: s.pistas.map((p) => ({
      ofrecidas: p.ofrecidas,
      vistas: p.vistas,
      ms: entero(p.msEnEtapa),
      intentos: entero(p.intentosEnEtapa, 100_000),
    })),
    votos: s.votos.map((v) => ({ ...v, votos: [...v.votos] })),
    ausentes: Object.entries(s.ausentesDesde).map(([jugador, desde]) => ({
      jugador,
      ms: entero(ahora - desde),
    })),
    apariencias: s.apariencias.map((a) => ({ ...a })),
  };
}

/**
 * Rearma la sesión desde una foto (T90: el nuevo anfitrión parte de su última copia). El
 * reloj queda en pausa; quien migra lo reanuda a los 3 s.
 */
export function sesionDesdeFoto(
  foto: Foto,
  anfitrion: string,
  conectados: readonly string[],
  ahora: number,
): Sesion {
  const etapas = Object.fromEntries(SALAS.map((id, i) => [id, foto.etapas[i] ?? 0])) as Record<
    SalaId,
    number
  >;
  const partida: Partida = {
    fase: foto.fase === 'final' ? 'final' : 'jugando',
    lugar: foto.lugar,
    etapas,
    final: foto.final,
    grabaciones: foto.grabaciones.filter((g) => GRABACIONES.includes(g)),
  };
  const reloj: Reloj = { restanteMs: foto.reloj.restante_ms, pausado: true, desde: ahora };
  const s: Sesion = {
    fase: foto.fase,
    anfitrion,
    orden: [...foto.orden],
    listos: [...foto.listos],
    partida,
    reloj,
    objetos: foto.objetos.map((o) => ({ ...o })),
    revelados: [...foto.revelados],
    propuesta: foto.propuesta && {
      ...foto.propuesta,
      votos: foto.propuesta.votos.map((v) => ({ ...v })),
    },
    sigPropuesta: (foto.propuesta?.id ?? 0) + 1,
    pistas: foto.pistas.map((p) => ({
      ofrecidas: p.ofrecidas,
      vistas: p.vistas,
      msEnEtapa: p.ms,
      intentosEnEtapa: p.intentos,
    })),
    activoVisto: transcurrido(reloj, ahora),
    votos: foto.votos.map((v) => ({ ...v, votos: [...v.votos] })),
    conectados: [...conectados],
    ausentesDesde: Object.fromEntries(foto.ausentes.map((a) => [a.jugador, ahora - a.ms])),
    roles: null,
    apariencias: foto.apariencias.map((a) => ({ ...a })),
  };
  // Quien no está conectado ahora cuenta como ausente desde este momento.
  for (const j of s.orden) {
    if (!s.conectados.includes(j) && !Object.hasOwn(s.ausentesDesde, j)) s.ausentesDesde[j] = ahora;
  }
  return s;
}

// ——— Ayudas ———

/** Jugadores de la partida que están conectados ahora. */
export const presentes = (s: Sesion): string[] => s.orden.filter((j) => s.conectados.includes(j));

/** Todos los conectados están en la lista (y hay al menos uno). */
function unanimidad(s: Sesion, votos: readonly string[]): boolean {
  const p = presentes(s);
  return p.length > 0 && p.every((j) => votos.includes(j));
}

function ausencias(s: Sesion, ahora: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(s.ausentesDesde).map(([j, desde]) => [j, Math.max(0, ahora - desde)]),
  );
}

/** Reparto del lugar actual con las ausencias de ahora, o null en la portería. */
export function repartoActual(s: Sesion, ahora: number): RepartoConAusencias | null {
  if (s.partida.lugar === 'porteria' || s.fase !== 'jugando') return null;
  return repartirConAusencias(s.orden, numeroDeSala(s.partida.lugar), ausencias(s, ahora));
}

/** Emite `roles` si el reparto del lugar cambió (al entrar o al pasar D a un suplente). */
function actualizarRoles(s: Sesion, ahora: number, eventos: Evento[]): Sesion {
  const reparto = repartoActual(s, ahora)?.reparto ?? null;
  if (iguales(reparto, s.roles)) return s;
  if (reparto && s.partida.lugar !== 'porteria') {
    eventos.push({ t: 'roles', p: { sala: numeroDeSala(s.partida.lugar), ...reparto } });
  }
  return { ...s, roles: reparto };
}

/** Dónde está un objeto ahora. */
export function ubicacion(s: Sesion, objeto: string): UbicacionObjeto | null {
  const movido = s.objetos.find((o) => o.objeto === objeto);
  if (movido) return movido;
  const sala = lugarInicial(objeto);
  return sala ? { objeto, portador: null, sala } : null;
}

function moverObjeto(s: Sesion, u: UbicacionObjeto): Sesion {
  return { ...s, objetos: [...s.objetos.filter((o) => o.objeto !== u.objeto), u] };
}

const indiceSala = (lugar: Lugar): number => SALAS.indexOf(lugar as SalaId);

/** Suma el tiempo activo a las pistas de la etapa en curso. */
function alDia(s: Sesion, ahora: number): Sesion {
  const activo = transcurrido(s.reloj, ahora);
  const delta = activo - s.activoVisto;
  if (delta <= 0) return s.activoVisto === activo ? s : { ...s, activoVisto: activo };
  const i = indiceSala(s.partida.lugar);
  const puzzle = puzzleDeLugar(s.partida.lugar);
  const sala = SALAS[i];
  if (s.fase !== 'jugando' || !puzzle || !sala || salaResuelta(s.partida, sala)) {
    return { ...s, activoVisto: activo };
  }
  const pistas = s.pistas.map((p, k) => (k === i ? avanzarTiempo(p, puzzle.pistas, delta) : p));
  return { ...s, pistas, activoVisto: activo };
}

// ——— Presence ———

/**
 * Cambió la lista de Presence. `conectados` va por orden de llegada (`unido_en`) y solo trae
 * identidades válidas y de la misma versión (el filtro lo hace `net/`).
 */
/**
 * Cambió Presence. `elecciones` trae el alias y el color con que cada jugador se unió (la
 * identidad de Presence): T81b los atiende al verlo llegar, en el orden de llegada.
 */
export function alPresencia(
  s0: Sesion,
  conectados: readonly string[],
  ahora: number,
  elecciones: ReadonlyMap<string, Eleccion> = new Map(),
): Paso {
  let s = alDia(s0, ahora);
  const eventos: Evento[] = [];
  const nuevos = conectados.filter((j) => !s.conectados.includes(j));
  const lista = [...new Set(conectados)];

  if (s.fase === 'espera') {
    // El anfitrión siempre va primero; luego los demás por orden de llegada, hasta 4.
    const otros = lista.filter((j) => j !== s.anfitrion);
    const orden = [s.anfitrion, ...otros].slice(0, MAX_JUGADORES);
    for (const j of nuevos) {
      if (!orden.includes(j)) eventos.push({ t: 'rechazo', p: { a: j, motivo: 'llena' } });
    }
    const listos = s.listos.filter((j) => orden.includes(j) && lista.includes(j));
    const apariencias = aparienciasDe(s.apariencias, orden, elecciones);
    const cambio =
      !iguales(orden, s.orden) || !iguales(listos, s.listos) || apariencias !== s.apariencias;
    s = { ...s, orden, listos, conectados: lista, apariencias };
    const inicio = intentarEmpezar(s, ahora);
    if (inicio) return { s: inicio.s, eventos: [...eventos, ...inicio.eventos] };
    // Quien llega recibe la foto para ponerse al día.
    if (cambio || nuevos.length > 0) eventos.push({ t: 'estado', p: fotoEn(s, ahora) });
    return { s, eventos };
  }

  for (const j of nuevos) {
    if (!s.orden.includes(j)) eventos.push({ t: 'rechazo', p: { a: j, motivo: 'empezada' } });
  }
  const ausentesDesde: Record<string, number> = {};
  for (const j of s.orden) {
    if (!lista.includes(j)) ausentesDesde[j] = s.ausentesDesde[j] ?? ahora;
  }
  s = { ...s, conectados: lista, ausentesDesde };
  s = actualizarRoles(s, ahora, eventos);
  // Si alguien se fue, lo que esperaba su voto puede quedar resuelto.
  const r = revisarUnanimidad(s, ahora);
  eventos.push(...r.eventos);
  // Quien vuelve recibe la foto para ponerse al día.
  if (nuevos.some((j) => r.s.orden.includes(j)))
    eventos.push({ t: 'estado', p: fotoEn(r.s, ahora) });
  return { s: r.s, eventos };
}

/**
 * T81b · En la espera: quien sale de la partida suelta su alias y su color; quien llega pide
 * los de Presence, en el orden de `orden` (el anfitrión primero y luego por llegada).
 * Devuelve la MISMA lista si no cambia nada.
 */
function aparienciasDe(
  antes: readonly Apariencia[],
  orden: readonly string[],
  elecciones: ReadonlyMap<string, Eleccion>,
): readonly Apariencia[] {
  let lista = antes.filter((a) => orden.includes(a.jugador));
  if (lista.length === antes.length) lista = antes as Apariencia[];
  for (const j of orden) {
    const pedido = elecciones.get(j);
    if (pedido && !lista.some((a) => a.jugador === j)) lista = [...elegir(lista, j, pedido)];
  }
  return lista;
}

function intentarEmpezar(s: Sesion, ahora: number): Paso | null {
  const p = presentes(s);
  if (s.fase !== 'espera' || p.length < MIN_JUGADORES || !p.every((j) => s.listos.includes(j))) {
    return null;
  }
  // T81b: nadie empieza sin alias y color propios.
  if (!p.every((j) => completa(s.apariencias, j))) return null;
  const reloj = reanudar(s.reloj, ahora);
  const iniciada: Sesion = {
    ...s,
    fase: 'jugando',
    orden: p,
    listos: p,
    reloj,
    activoVisto: transcurrido(reloj, ahora),
  };
  return {
    s: iniciada,
    eventos: [{ t: 'inicio', p: { orden: p, restante_ms: entero(restante(reloj, ahora)) } }],
  };
}

// ——— Reloj ———

/**
 * Llamar cada segundo, más o menos. Suma tiempo a las pistas, termina la partida al agotarse
 * el reloj y pasa D a un suplente cuando se acaba la espera de 60 s.
 */
export function alTick(s0: Sesion, ahora: number): Paso {
  let s = alDia(s0, ahora);
  const eventos: Evento[] = [];
  if (s.fase !== 'jugando') return { s, eventos };
  if (agotado(s.reloj, ahora)) {
    return terminar(s, aplicar(s.partida, { t: 'tiempo_agotado' }), ahora);
  }
  s = actualizarRoles(s, ahora, eventos);
  s = soltarReservas(s, ahora, eventos);
  return { s, eventos };
}

/**
 * T89: lo que lleva un jugador desconectado queda reservado 60 s; luego queda en el piso del
 * lugar del grupo, donde cualquiera lo puede recoger.
 */
function soltarReservas(s: Sesion, ahora: number, eventos: Evento[]): Sesion {
  const vencidos = Object.entries(s.ausentesDesde)
    .filter(([, desde]) => ahora - desde >= ESPERA_RECONEXION_MS)
    .map(([j]) => j);
  if (vencidos.length === 0) return s;
  let cambio = false;
  const objetos = s.objetos.map((o) => {
    if (o.portador === null || !vencidos.includes(o.portador)) return o;
    cambio = true;
    const suelto = { objeto: o.objeto, portador: null, sala: s.partida.lugar };
    eventos.push({ t: 'objeto', p: suelto });
    return suelto;
  });
  return cambio ? { ...s, objetos } : s;
}

/**
 * T90: el nuevo anfitrión arranca con el reloj en pausa y lo reanuda a los 3 s, si corría
 * antes de la migración.
 */
export function reanudarReloj(s: Sesion, ahora: number): Paso {
  if (s.fase !== 'jugando' || !s.reloj.pausado) return quieto(s);
  const reloj = reanudar(s.reloj, ahora);
  if (reloj === s.reloj) return quieto(s);
  return {
    s: { ...s, reloj, activoVisto: transcurrido(reloj, ahora) },
    eventos: [{ t: 'reloj', p: { restante_ms: entero(restante(reloj, ahora)), pausado: false } }],
  };
}

function terminar(s: Sesion, partida: Partida, ahora: number): Paso {
  if (partida === s.partida || !partida.final) return quieto(s);
  const fin: Sesion = {
    ...s,
    fase: 'final',
    partida,
    reloj: pausar(s.reloj, ahora),
    propuesta: null,
    votos: [],
  };
  return { s: fin, eventos: [{ t: 'final', p: { final: partida.final } }] };
}

// ——— Intenciones ———

/** Procesa una intención de `de`. Si no se acepta, devuelve la misma sesión y ningún evento. */
export function alIntencion(s0: Sesion, de: string, i: Intencion, ahora: number): Paso {
  if (!s0.orden.includes(de) || !s0.conectados.includes(de)) return quieto(s0);
  const s = alDia(s0, ahora);
  switch (i.t) {
    case 'listo':
      return listo(s, de, i.p.listo, ahora);
    case 'pedir_estado':
      return { s, eventos: [{ t: 'estado', p: fotoEn(s, ahora) }] };
    case 'elegir':
      return elegirApariencia(s, de, i.p, ahora) ?? quieto(s0);
    default:
      if (s.fase !== 'jugando') return quieto(s0);
  }
  switch (i.t) {
    case 'recoger':
      return recoger(s, de, i.p.objeto) ?? quieto(s0);
    case 'pasar':
      return pasar(s, de, i.p.objeto, i.p.a) ?? quieto(s0);
    case 'usar':
      return usar(s, de, i.p.herramienta, i.p.objetivo) ?? quieto(s0);
    case 'proponer':
      return proponer(s, de, i.p.puzzle, i.p.etapa, i.p.estado, ahora) ?? quieto(s0);
    case 'confirmar':
      return confirmar(s, de, i.p.propuesta, i.p.acepta, ahora) ?? quieto(s0);
    case 'pedir_pista':
      return pedirPista(s, i.p.puzzle) ?? quieto(s0);
    case 'votar':
      return votar(s, de, i.p.asunto, i.p.opcion, i.p.acepta, ahora) ?? quieto(s0);
  }
}

function listo(s: Sesion, de: string, valor: boolean, ahora: number): Paso {
  if (s.fase !== 'espera' || s.listos.includes(de) === valor) return quieto(s);
  const listos = valor ? [...s.listos, de] : s.listos.filter((j) => j !== de);
  const s2 = { ...s, listos };
  return intentarEmpezar(s2, ahora) ?? { s: s2, eventos: [{ t: 'estado', p: fotoEn(s2, ahora) }] };
}

/**
 * T81b · Otro alias y color en la sala de espera. Las intenciones llegan una por una, así que
 * si dos piden lo mismo se lo queda la primera. Siempre responde con la foto, aunque no haya
 * aceptado nada: así quien perdió ve que alguien más lo tiene y elige de nuevo.
 */
function elegirApariencia(s: Sesion, de: string, pedido: Eleccion, ahora: number): Paso | null {
  if (s.fase !== 'espera') return null;
  const apariencias = elegir(s.apariencias, de, pedido);
  const s2 = apariencias === s.apariencias ? s : { ...s, apariencias };
  return intentarEmpezar(s2, ahora) ?? { s: s2, eventos: [{ t: 'estado', p: fotoEn(s2, ahora) }] };
}

// T84 · Objetos

function recoger(s: Sesion, de: string, objeto: string): Paso | null {
  const u = ubicacion(s, objeto);
  if (!u || !esRecogible(objeto) || u.portador !== null || u.sala !== s.partida.lugar) return null;
  const nueva = { objeto, portador: de, sala: s.partida.lugar };
  return { s: moverObjeto(s, nueva), eventos: [{ t: 'objeto', p: nueva }] };
}

function pasar(s: Sesion, de: string, objeto: string, a: string): Paso | null {
  const u = ubicacion(s, objeto);
  if (!u || u.portador !== de || a === de || !presentes(s).includes(a)) return null;
  // Todo el grupo está siempre en el mismo lugar: el objeto viaja con quien lo lleva.
  const nueva = { objeto, portador: a, sala: s.partida.lugar };
  return { s: moverObjeto(s, nueva), eventos: [{ t: 'objeto', p: nueva }] };
}

function usar(s: Sesion, de: string, herramienta: string | null, objetivo: string): Paso | null {
  const enLugar = ubicacion(s, objetivo);
  if (!enLugar || enLugar.sala !== s.partida.lugar) return null;
  if (herramienta !== null && ubicacion(s, herramienta)?.portador !== de) return null;
  const efecto = efectoDeUsar(herramienta, objetivo);
  if (!efecto) return null;
  if (efecto.t === 'grabacion') {
    const partida = aplicar(s.partida, { t: 'recoger_grabacion', grabacion: efecto.grabacion });
    if (partida === s.partida) return null;
    return {
      s: { ...s, partida },
      eventos: [{ t: 'grabacion', p: { fragmento: efecto.grabacion, por: de } }],
    };
  }
  if (s.revelados.includes(objetivo)) return null;
  return {
    s: { ...s, revelados: [...s.revelados, objetivo] },
    eventos: [{ t: 'revelado', p: { objeto: objetivo, por: de } }],
  };
}

// T85 · Propuesta, confirmación y resultado

function proponer(
  s: Sesion,
  de: string,
  puzzleId: string,
  etapa: number,
  estado: unknown,
  ahora: number,
): Paso | null {
  const puzzle = puzzlePorId(puzzleId);
  if (!puzzle || puzzleDeLugar(s.partida.lugar)?.id !== puzzle.id) return null;
  const sala = s.partida.lugar as SalaId;
  if (etapaActual(s.partida, sala) !== etapa || evaluar(puzzle, etapa, estado) === null)
    return null;
  const reparto = repartoActual(s, ahora);
  // Solo D acciona la máquina, y nadie mientras el grupo espera a quien tiene D.
  if (!reparto || reparto.esperandoA !== null || reparto.reparto.D !== de) return null;
  const propuesta: PropuestaAbierta = {
    id: s.sigPropuesta,
    puzzle: puzzle.id,
    etapa,
    por: de,
    estado: structuredClone(estado),
    votos: [{ jugador: de, acepta: true }],
  };
  const s2: Sesion = { ...s, propuesta, sigPropuesta: s.sigPropuesta + 1 };
  const eventos: Evento[] = [
    {
      t: 'propuesta',
      p: { id: propuesta.id, puzzle: puzzle.id, etapa, por: de, estado: propuesta.estado },
    },
  ];
  const r = revisarUnanimidad(s2, ahora);
  return { s: r.s, eventos: [...eventos, ...r.eventos] };
}

function confirmar(s: Sesion, de: string, id: number, acepta: boolean, ahora: number): Paso | null {
  const p = s.propuesta;
  if (!p || p.id !== id || p.votos.some((v) => v.jugador === de)) return null;
  const evento: Evento = { t: 'confirmacion', p: { propuesta: id, jugador: de, acepta } };
  // Un rechazo anula la propuesta: D vuelve a proponer.
  if (!acepta) return { s: { ...s, propuesta: null }, eventos: [evento] };
  const s2 = { ...s, propuesta: { ...p, votos: [...p.votos, { jugador: de, acepta }] } };
  const r = revisarUnanimidad(s2, ahora);
  return { s: r.s, eventos: [evento, ...r.eventos] };
}

/** La máquina responde: el anfitrión evalúa la propuesta que todos aceptaron. */
function resolverPropuesta(s: Sesion, ahora: number): Paso {
  const p = s.propuesta;
  const puzzle = p && puzzlePorId(p.puzzle);
  if (!p || !puzzle) return quieto(s);
  const sala = SALAS[puzzle.sala - 1];
  const ev = evaluar(puzzle, p.etapa, p.estado);
  if (!sala || !ev || etapaActual(s.partida, sala) !== p.etapa) {
    return { s: { ...s, propuesta: null }, eventos: [] };
  }
  const i = puzzle.sala - 1;
  let partida = s.partida;
  let pistas = s.pistas;
  if (ev.resuelta) {
    partida = aplicar(partida, { t: 'resolver_etapa', sala, etapa: p.etapa });
    pistas = pistas.map((x, k) => (k === i ? nuevaEtapa(x) : x));
  } else {
    pistas = pistas.map((x, k) => (k === i ? registrarIntento(x, puzzle.pistas) : x));
  }
  const s2 = alDia({ ...s, partida, pistas, propuesta: null }, ahora);
  return {
    s: s2,
    eventos: [
      {
        t: 'resultado',
        p: {
          puzzle: puzzle.id,
          etapa: p.etapa,
          condiciones: { ...ev.condiciones },
          resuelta: ev.resuelta,
          sello: ev.resuelta && salaResuelta(partida, sala),
        },
      },
    ],
  };
}

function pedirPista(s: Sesion, puzzleId: string): Paso | null {
  const puzzle = puzzleDeLugar(s.partida.lugar);
  if (!puzzle || puzzle.id !== puzzleId) return null;
  const i = puzzle.sala - 1;
  const actual = s.pistas[i];
  if (!actual) return null;
  const siguiente = verPista(actual);
  if (siguiente === actual) return null;
  return {
    s: { ...s, pistas: s.pistas.map((x, k) => (k === i ? siguiente : x)) },
    eventos: [{ t: 'pista', p: { puzzle: puzzle.id, nivel: siguiente.vistas } }],
  };
}

// T87 · Votos

/** A dónde lleva un voto de `sala`: pasa por la portería si hace falta. */
function moverA(p: Partida, destino: OpcionVoto | null): Partida {
  if (destino === null || destino === p.lugar) return p;
  if (destino === 'porteria') return aplicar(p, { t: 'volver_porteria' });
  if (!(SALAS as readonly string[]).includes(destino)) return p;
  const desde = p.lugar === 'porteria' ? p : aplicar(p, { t: 'volver_porteria' });
  const r = aplicar(desde, { t: 'entrar', sala: destino as SalaId });
  return r === desde ? p : r;
}

function votoPermitido(s: Sesion, asunto: Asunto, opcion: OpcionVoto | null, ahora: number) {
  switch (asunto) {
    case 'pausa':
      return opcion === null && !s.reloj.pausado;
    case 'reanudar':
      return opcion === null && s.reloj.pausado && restante(s.reloj, ahora) > 0;
    case 'sala':
      return moverA(s.partida, opcion) !== s.partida;
    case 'final': {
      const o = opcionesDeFinal(s.partida);
      return (opcion === 'salir' && o.salir) || (opcion === 'restaurar' && o.restaurar);
    }
    case 'ayuda':
      return opcion === null;
  }
}

function votar(
  s: Sesion,
  de: string,
  asunto: Asunto,
  opcion: OpcionVoto | null,
  acepta: boolean,
  ahora: number,
): Paso | null {
  const abierto = s.votos.find((v) => v.asunto === asunto);
  const resto = s.votos.filter((v) => v.asunto !== asunto);
  let lista: string[];
  let eleccion = opcion;
  if (!acepta) {
    if (!abierto?.votos.includes(de)) return null;
    lista = abierto.votos.filter((j) => j !== de);
    eleccion = abierto.opcion;
  } else {
    if (!votoPermitido(s, asunto, opcion, ahora)) return null;
    if (abierto && abierto.opcion === opcion) {
      if (abierto.votos.includes(de)) return null;
      lista = [...abierto.votos, de];
    } else {
      // Otra opción reemplaza el voto abierto: se empieza a contar de nuevo.
      lista = [de];
    }
  }
  const resuelto = acepta && unanimidad(s, lista);
  const votos =
    resuelto || lista.length === 0 ? resto : [...resto, { asunto, opcion: eleccion, votos: lista }];
  const s2: Sesion = { ...s, votos };
  const evento: Evento = { t: 'voto', p: { asunto, opcion: eleccion, votos: lista, resuelto } };
  if (!resuelto) return { s: s2, eventos: [evento] };
  const efecto = aplicarVoto(s2, asunto, eleccion, ahora);
  return { s: efecto.s, eventos: [evento, ...efecto.eventos] };
}

function aplicarVoto(s: Sesion, asunto: Asunto, opcion: OpcionVoto | null, ahora: number): Paso {
  switch (asunto) {
    case 'pausa': {
      const reloj = pausar(s.reloj, ahora);
      return {
        s: { ...s, reloj },
        eventos: [
          { t: 'reloj', p: { restante_ms: entero(restante(reloj, ahora)), pausado: true } },
        ],
      };
    }
    case 'reanudar': {
      const reloj = reanudar(s.reloj, ahora);
      return {
        s: { ...s, reloj, activoVisto: transcurrido(reloj, ahora) },
        eventos: [
          { t: 'reloj', p: { restante_ms: entero(restante(reloj, ahora)), pausado: false } },
        ],
      };
    }
    case 'sala': {
      const partida = moverA(s.partida, opcion);
      if (partida === s.partida) return quieto(s);
      const eventos: Evento[] = [];
      // Al cambiar de lugar se cierran la propuesta y los votos del lugar anterior, y lo que
      // lleva cada jugador viaja con el grupo.
      const objetos = s.objetos.map((o) => (o.portador ? { ...o, sala: partida.lugar } : o));
      const s2 = actualizarRoles(
        { ...s, partida, objetos, propuesta: null, votos: [], roles: null },
        ahora,
        eventos,
      );
      return { s: s2, eventos };
    }
    case 'final':
      return terminar(
        s,
        aplicar(s.partida, {
          t: 'elegir_final',
          opcion: opcion === 'restaurar' ? 'restaurar' : 'salir',
        }),
        ahora,
      );
    case 'ayuda':
      return terminar(s, aplicar(s.partida, { t: 'pedir_ayuda' }), ahora);
  }
}

/**
 * Resuelve lo que ya tiene el acuerdo de todos los conectados: la propuesta abierta y los
 * votos. Se llama tras cada voto y cuando alguien sale de Presence.
 */
function revisarUnanimidad(s0: Sesion, ahora: number): Paso {
  let s = s0;
  const eventos: Evento[] = [];
  if (
    s.propuesta &&
    unanimidad(
      s,
      s.propuesta.votos.filter((v) => v.acepta).map((v) => v.jugador),
    )
  ) {
    const r = resolverPropuesta(s, ahora);
    s = r.s;
    eventos.push(...r.eventos);
  }
  for (const v of s.votos) {
    if (s.fase !== 'jugando') break;
    if (!unanimidad(s, v.votos)) continue;
    const resto = s.votos.filter((x) => x.asunto !== v.asunto);
    if (!votoPermitido(s, v.asunto, v.opcion, ahora)) {
      s = { ...s, votos: resto };
      continue;
    }
    eventos.push({
      t: 'voto',
      p: { asunto: v.asunto, opcion: v.opcion, votos: v.votos, resuelto: true },
    });
    const r = aplicarVoto({ ...s, votos: resto }, v.asunto, v.opcion, ahora);
    s = r.s;
    eventos.push(...r.eventos);
  }
  return { s, eventos };
}

/** Milisegundos que el grupo lleva esperando a quien tiene D (para la interfaz). */
export function esperaDeD(s: Sesion, ahora: number): { jugador: string; faltanMs: number } | null {
  const r = repartoActual(s, ahora);
  return r?.esperandoA ? { jugador: r.esperandoA, faltanMs: r.faltanMs } : null;
}

export { ESPERA_RECONEXION_MS };
