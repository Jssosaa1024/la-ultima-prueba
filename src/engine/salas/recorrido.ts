/**
 * Reglas del recorrido que necesita el cargador de salas (T20). Funciones puras, con tests.
 */
import type { Lugar, Sala } from '../../content/esquema-salas';

/** Las cinco salas en el orden en que se abren desde la portería. */
export const ORDEN_SALAS = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const satisfies readonly Lugar[];

/**
 * Qué sala conviene dejar preparada mientras se juega en `actual`: la primera sala sin sello
 * que no sea la actual. La portería no se precarga: se queda en memoria todo el juego.
 */
export function siguienteSala(actual: Lugar, conSello: readonly string[]): Lugar | null {
  return ORDEN_SALAS.find((s) => s !== actual && !conSello.includes(s)) ?? null;
}

/** Distancia desde la puerta a la que aparece el jugador al volver a la portería. */
const SEPARACION = 1;
const GRADOS = Math.PI / 180;

/**
 * Dónde aparece el jugador al entrar a `sala` viniendo de `desde`.
 * - Al volver a la portería desde una sala: frente a la puerta de esa sala, de espaldas a ella.
 * - En cualquier otro caso: el punto de inicio de la sala.
 */
export function puntoDeEntrada(
  sala: Sala,
  desde: Lugar | null,
): { x: number; z: number; yaw: number } {
  const puerta = desde ? sala.objetos.find((o) => o.puerta === desde) : undefined;
  if (!puerta) return { x: sala.inicio.x, z: sala.inicio.z, yaw: sala.inicio.giro * GRADOS };

  // Un plano sin girar mira hacia +Z; girado `g` grados mira hacia (sen g, cos g).
  const g = (puerta.giro ?? 0) * GRADOS;
  const nx = Math.sin(g);
  const nz = Math.cos(g);
  return {
    x: puerta.pos[0] + nx * SEPARACION,
    z: puerta.pos[2] + nz * SEPARACION,
    // «Adelante» con yaw es (−sen yaw, −cos yaw): se mira hacia afuera de la puerta.
    yaw: Math.atan2(-nx, -nz),
  };
}
