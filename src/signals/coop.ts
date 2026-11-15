import { batch, signal } from '@preact/signals';
import { FRASES, type Asunto, type Foto, type OpcionVoto } from '../game/coop/mensajes';
import type { Reparto, Rol } from '../game/reparto';
import { elegirRed, entornoDelBuild } from '../net';
import type { Alias, Color, Identidad } from '../net/protocolo';

/**
 * Estado del modo cooperativo que ve la interfaz (T32, T81).
 *
 * Lo escribe el controlador cooperativo (`controlador-coop.ts`) con lo que llega de la red;
 * `ui/` solo lee y pide cambios con `enviar()` del puente. Todo lo que viene de la red ya
 * pasó por la validación de `net/protocolo.ts` y aquí solo hay ids de listas cerradas.
 */

/** En qué punto está la conexión del cooperativo. */
export type EstadoCoop =
  /** Sin cooperativo: modo individual o menú. */
  | 'inactivo'
  /** Uniéndose al canal o esperando la primera foto del anfitrión. */
  | 'conectando'
  /** Sala de espera (T81). */
  | 'espera'
  /** La partida empezó. */
  | 'jugando'
  /** No se pudo entrar (ver `error`). */
  | 'error';

/** Por qué no se pudo entrar a una partida. */
export type ErrorCoop = 'llena' | 'version' | 'empezada' | 'no_encontrada' | 'conexion';

/** Un jugador de la sala de espera o de la partida. */
export interface JugadorCoop {
  jugador: string;
  alias: Alias;
  color: Color;
  listo: boolean;
  conectado: boolean;
  anfitrion: boolean;
  /** Es este navegador. */
  yo: boolean;
}

export interface Coop {
  estado: EstadoCoop;
  /** Código de la partida (validado con la regla del protocolo). */
  codigo: string | null;
  error: ErrorCoop | null;
  jugadores: readonly JugadorCoop[];
  soyAnfitrion: boolean;
  /** Sin Supabase: el cooperativo solo funciona entre pestañas de este navegador. */
  soloPestanas: boolean;
}

export const COOP_INICIAL: Coop = {
  estado: 'inactivo',
  codigo: null,
  error: null,
  jugadores: [],
  soyAnfitrion: false,
  soloPestanas: false,
};

export const coop = signal<Coop>(COOP_INICIAL);

/** Propuesta abierta en la máquina de la sala (T85): la hizo quien tiene D. */
export interface PropuestaCoop {
  id: number;
  puzzle: string;
  etapa: number;
  por: string;
  estado: unknown;
  /** Quiénes ya aceptaron (quien propone cuenta como que acepta). */
  aceptan: readonly string[];
}

/** Un voto abierto (T87): pausa, reanudar, cambio de sala, final o ayuda. */
export interface VotoCoop {
  asunto: Asunto;
  opcion: OpcionVoto | null;
  /** Quiénes votaron a favor. */
  votos: readonly string[];
}

/** El grupo espera a quien tiene D, que se desconectó (T89): hasta 60 s. */
export interface EsperaD {
  jugador: string;
  /** Lo que faltaba en `desde` (`performance.now()`). */
  faltanMs: number;
  desde: number;
}

/** Frases rápidas (T91): viaja el id; el texto lo pone cada cliente. */
export const FRASES_RAPIDAS = FRASES;
export type Frase = (typeof FRASES)[number];

/**
 * Una señal de un jugador (T91): un punto de la sala (en cm) y, si quiere, una frase. Las
 * guarda el controlador para que la interfaz muestre la frase y el motor dibuje el punto
 * (sesión A). `x = y = z = 0` es «sin punto»: solo la frase.
 */
export interface SenalCoop {
  /** Sube con cada señal, para mostrarla aunque sea igual a la anterior. */
  n: number;
  jugador: string;
  /** Número de la sala (0 = portería). */
  s: number;
  x: number;
  y: number;
  z: number;
  frase: Frase | null;
  /** `performance.now()` al llegar. */
  en: number;
}

/** Las últimas señales (hasta 8), la más nueva al final. */
export const senales = signal<readonly SenalCoop[]>([]);

/**
 * Dónde está este jugador, en metros. Lo escribe el motor (sesión A, con las poses de T82);
 * mientras no lo haga, una señal sin objeto enfocado va «sin punto».
 */
export const miPosicion = signal<{ x: number; y: number; z: number } | null>(null);

/**
 * Objetos que no están donde los pone la sala (T84c): los que lleva algún jugador (también
 * este) y los que quedaron en el piso de otro lugar. El motor los oculta de la escena y los
 * vuelve a mostrar cuando regresan a su sitio sin portador. Vacío en el modo individual.
 */
export const objetosFuera = signal<readonly string[]>([]);

/** Quién tiene cada encargo en la sala actual; `null` en la portería. */
export const reparto = signal<Reparto | null>(null);
/** Los encargos de este jugador en la sala actual. */
export const misRoles = signal<readonly Rol[]>([]);
export const propuestaCoop = signal<PropuestaCoop | null>(null);
export const votosCoop = signal<readonly VotoCoop[]>([]);
export const esperaD = signal<EsperaD | null>(null);

export function reiniciarCoop(): void {
  batch(() => {
    coop.value = COOP_INICIAL;
    reparto.value = null;
    misRoles.value = [];
    propuestaCoop.value = null;
    votosCoop.value = [];
    esperaD.value = null;
    senales.value = [];
    objetosFuera.value = [];
  });
}

/** Los encargos de un jugador en un reparto, en orden (A, B, C, D). */
export function rolesDe(r: Reparto | null, jugador: string): Rol[] {
  if (!r) return [];
  return (['A', 'B', 'C', 'D'] as const).filter((rol) => r[rol] === jugador);
}

/** Mínimo de jugadores para empezar (el de `game/coop/sesion.ts`). */
export const MIN_JUGADORES_COOP = 2;

/**
 * Los jugadores que muestra la sala de espera y el HUD: los de la partida (`orden`) con su
 * alias y color de Presence. Quien no está en Presence se muestra como desconectado, con el
 * alias que tenía (o el primero de la lista si nunca se vio).
 */
export function jugadoresDeFoto(
  foto: Foto,
  presentes: readonly Identidad[],
  conocidos: ReadonlyMap<string, Identidad>,
  yo: string,
): JugadorCoop[] {
  return foto.orden.map((jugador) => {
    const id = presentes.find((p) => p.jugador === jugador) ?? conocidos.get(jugador);
    return {
      jugador,
      alias: id?.alias ?? 'zorro',
      color: id?.color ?? 'ambar',
      listo: foto.listos.includes(jugador),
      conectado: presentes.some((p) => p.jugador === jugador),
      anfitrion: foto.anfitrion === jugador,
      yo: jugador === yo,
    };
  });
}

/**
 * El anfitrión puede iniciar cuando hay al menos dos jugadores conectados y todos los demás
 * marcaron «listo». Iniciar es marcarse listo él también: la sesión empieza sola cuando todos
 * lo están (`intentarEmpezar` de `game/coop/sesion.ts`).
 */
export function puedeIniciar(jugadores: readonly JugadorCoop[]): boolean {
  const conectados = jugadores.filter((j) => j.conectado);
  return conectados.length >= MIN_JUGADORES_COOP && conectados.every((j) => j.anfitrion || j.listo);
}

// La interfaz no importa de `net/`: lo que necesita del protocolo pasa por aquí.
export { ALIAS, COLORES, esCodigo, leerCodigo } from '../net/protocolo';
export type { Alias, Color } from '../net/protocolo';
export { AVISO_SIN_SUPABASE } from '../net';

/** Sin Supabase configurado (o con `?red=pestanas`) el cooperativo solo va entre pestañas. */
export function soloEntrePestanas(busqueda: string): boolean {
  return elegirRed(entornoDelBuild(), busqueda) === 'pestanas';
}
