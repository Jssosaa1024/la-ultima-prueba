import { signal } from '@preact/signals';
import type { Foto } from '../game/coop/mensajes';
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

export function reiniciarCoop(): void {
  coop.value = COOP_INICIAL;
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
