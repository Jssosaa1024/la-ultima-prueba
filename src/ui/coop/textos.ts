import { salaPorId } from '../../content/salas';
import type { Frase, JugadorCoop, VotoCoop } from '../../signals/coop';
import { formatoReloj } from '../hud/formato';
import { NOMBRE_ALIAS } from './nombres';

/**
 * Textos del cooperativo en partida (T85, T87). Por la red solo llegan ids; las frases se
 * arman aquí con el contenido del bundle.
 */

/** Alias de un jugador para mostrar: «Búho», o «tú» si es este navegador. */
export function aliasDe(jugadores: readonly JugadorCoop[], jugador: string): string {
  const j = jugadores.find((x) => x.jugador === jugador);
  if (!j) return 'alguien';
  return j.yo ? 'tú' : NOMBRE_ALIAS[j.alias];
}

/** Lista con «y»: «Zorro», «Zorro y Rana», «Zorro, Rana y Oso». */
export function lista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

/** Lo que se vota, en palabras: «ir a La cooperativa». */
export function queSeVota(v: Pick<VotoCoop, 'asunto' | 'opcion'>): string {
  switch (v.asunto) {
    case 'pausa':
      return 'pausar el reloj';
    case 'reanudar':
      return 'reanudar el reloj';
    case 'sala':
      return v.opcion && v.opcion !== 'salir' && v.opcion !== 'restaurar'
        ? `ir a ${salaPorId(v.opcion).nombre}`
        : 'cambiar de lugar';
    case 'final':
      return v.opcion === 'restaurar' ? 'restaurar el archivo y salir' : 'salir del colegio';
    case 'ayuda':
      return 'pedir ayuda por el intercomunicador y terminar la partida';
  }
}

/** «Búho propone ir a La cooperativa.» o «Propones ir a…». */
export function textoVoto(v: VotoCoop, jugadores: readonly JugadorCoop[]): string {
  const quien = v.votos[0];
  const que = queSeVota(v);
  if (!quien) return `Votación para ${que}.`;
  const nombre = aliasDe(jugadores, quien);
  return nombre === 'tú' ? `Propones ${que}.` : `${nombre} propone ${que}.`;
}

/** Quiénes faltan por aceptar (solo los conectados cuentan para la unanimidad). */
export function faltan(
  aceptan: readonly string[],
  jugadores: readonly JugadorCoop[],
): JugadorCoop[] {
  return jugadores.filter((j) => j.conectado && !aceptan.includes(j.jugador));
}

/** «Aceptaron 1 de 3. Falta Zorro.» */
export function textoCuenta(aceptan: readonly string[], jugadores: readonly JugadorCoop[]): string {
  const conectados = jugadores.filter((j) => j.conectado);
  const si = conectados.filter((j) => aceptan.includes(j.jugador)).length;
  const pendientes = faltan(aceptan, jugadores).map((j) => aliasDe(jugadores, j.jugador));
  const base = `Aceptaron ${si} de ${conectados.length}.`;
  if (pendientes.length === 0) return base;
  const verbo = pendientes.length === 1 ? 'Falta' : 'Faltan';
  return `${base} ${verbo} ${lista(pendientes)}.`;
}

/** «Esperando a Búho (encargo D): quedan 0:42.» */
export function textoEsperaD(alias: string, restanteMs: number): string {
  return `Esperando a ${alias}, que tiene el encargo D y se desconectó: quedan ${formatoReloj(restanteMs)}. Si no vuelve, D pasa a otro jugador.`;
}

/** «Tus encargos: C y D». */
export function textoEncargos(roles: readonly string[]): string {
  if (roles.length === 0) return '';
  return `${roles.length === 1 ? 'Tu encargo' : 'Tus encargos'}: ${lista(roles)}`;
}

/** Frases rápidas (T91): lo único que el grupo se puede «decir». No hay chat libre. */
export const TEXTO_FRASE: Readonly<Record<Frase, string>> = {
  aqui: '¡Aquí!',
  mira: 'Mira esto',
  ven: 'Ven',
  listo: 'Listo',
  espera: 'Espera',
  no_se: 'No sé',
};

/** «Búho: ¡Aquí!» o «Búho señala algo». */
export function textoSenal(alias: string, frase: Frase | null): string {
  if (alias === 'tú') return frase ? `Dijiste: ${TEXTO_FRASE[frase]}` : 'Señalaste';
  return frase ? `${alias}: ${TEXTO_FRASE[frase]}` : `${alias} señala algo`;
}
