/**
 * Reparto de encargos A–D (T29, `docs/diseno.md`, «Versión cooperativa»).
 *
 * En cada sala hay cuatro encargos. Según cuántos jugadores haya, se agrupan así:
 *
 *   1 jugador    A, B, C y D (modo individual)
 *   2 jugadores  uno tiene A y B; el otro, C y D
 *   3 jugadores  uno tiene A; otro, B y C; otro, D
 *   4 jugadores  un encargo por integrante
 *
 * Los encargos rotan entre salas: en cada sala, cada jugador recibe el grupo de encargos que
 * tenía el siguiente jugador en la sala anterior. Así D (quien acciona la máquina) va pasando
 * por todo el grupo. El reparto depende solo del orden de los jugadores y del número de la
 * sala: cualquier cliente lo puede recalcular y da lo mismo, y volver a una sala anterior
 * devuelve el reparto que tenía.
 */

export const ROLES = ['A', 'B', 'C', 'D'] as const;
export type Rol = (typeof ROLES)[number];

/** Quién tiene cada encargo: id de jugador por rol. Es el contenido del evento `roles`. */
export type Reparto = Readonly<Record<Rol, string>>;

export const MAX_JUGADORES = 4;
const SALAS = 5;

/** Grupos de encargos según el número de jugadores, en el orden de la tabla del diseño. */
const GRUPOS: Readonly<Record<number, readonly (readonly Rol[])[]>> = {
  1: [['A', 'B', 'C', 'D']],
  2: [
    ['A', 'B'],
    ['C', 'D'],
  ],
  3: [['A'], ['B', 'C'], ['D']],
  4: [['A'], ['B'], ['C'], ['D']],
};

/** Grupos de encargos para ese número de jugadores, o null si no es de 1 a 4. */
export function gruposDeEncargos(jugadores: number): readonly (readonly Rol[])[] | null {
  return GRUPOS[jugadores] ?? null;
}

const esSala = (sala: number): boolean => Number.isInteger(sala) && sala >= 1 && sala <= SALAS;

function sonJugadores(jugadores: readonly string[]): boolean {
  return (
    jugadores.length >= 1 &&
    jugadores.length <= MAX_JUGADORES &&
    jugadores.every((j) => typeof j === 'string' && j.length > 0) &&
    new Set(jugadores).size === jugadores.length
  );
}

/**
 * Reparto de una sala (1 a 5). `jugadores` va en el orden en que se unieron a la partida
 * (`unido_en`), y ese orden no cambia durante la partida aunque alguien se desconecte.
 * Devuelve null si los jugadores no son de 1 a 4 ids distintos o la sala no existe.
 */
export function repartir(jugadores: readonly string[], sala: number): Reparto | null {
  const grupos = gruposDeEncargos(jugadores.length);
  if (!grupos || !sonJugadores(jugadores) || !esSala(sala)) return null;
  const n = jugadores.length;
  const reparto: Partial<Record<Rol, string>> = {};
  jugadores.forEach((jugador, i) => {
    for (const rol of grupos[(i + sala - 1) % n] ?? []) reparto[rol] = jugador;
  });
  const { A, B, C, D } = reparto;
  return A && B && C && D ? { A, B, C, D } : null;
}

/** Encargos de un jugador en ese reparto, en orden A–D (vacío si no está en la partida). */
export function rolesDe(reparto: Reparto, jugador: string): Rol[] {
  return ROLES.filter((rol) => reparto[rol] === jugador);
}

/** Verdadero si el jugador tiene ese encargo (por ejemplo, D para `proponer`). */
export const tieneRol = (reparto: Reparto, jugador: string, rol: Rol): boolean =>
  reparto[rol] === jugador;

/**
 * Reparto con suplente para D. Si quien tiene D está desconectado, D pasa al siguiente jugador
 * conectado en el orden de la partida, para que el grupo pueda seguir accionando la máquina.
 * A, B y C no se mueven: los objetos del ausente quedan reservados y luego en el piso
 * (especificación, «Desconexión»). Cuando el ausente vuelve, recupera D: basta llamar de nuevo
 * con la lista de conectados al día. Devuelve null si `repartir` lo haría o si no hay nadie
 * conectado.
 */
export function repartirConectados(
  jugadores: readonly string[],
  sala: number,
  conectados: readonly string[],
): Reparto | null {
  const base = repartir(jugadores, sala);
  if (!base) return null;
  const presentes = jugadores.filter((j) => conectados.includes(j));
  if (presentes.length === 0) return null;
  if (presentes.includes(base.D)) return base;
  const n = jugadores.length;
  const desde = jugadores.indexOf(base.D);
  for (let paso = 1; paso < n; paso++) {
    const suplente = jugadores[(desde + paso) % n];
    if (suplente !== undefined && presentes.includes(suplente)) return { ...base, D: suplente };
  }
  return null;
}
