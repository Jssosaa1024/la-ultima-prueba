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
 * Tiempo que el grupo espera a quien tiene D si se desconecta, antes de pasarle D a otro.
 * Es el mismo plazo en que sus objetos quedan reservados (especificación, «Desconexión»).
 */
export const ESPERA_RECONEXION_MS = 60_000;

/**
 * Milisegundos que lleva desconectado cada jugador ausente, por id. Los conectados no
 * aparecen. Lo arma el anfitrión con lo que ve en Presence.
 */
export type Ausencias = Readonly<Record<string, number>>;

export interface RepartoConAusencias {
  reparto: Reparto;
  /**
   * Jugador con D al que el grupo está esperando, o null. Mientras se espera, D sigue siendo
   * suyo y nadie puede accionar la máquina.
   */
  esperandoA: string | null;
  /** Milisegundos que faltan para que D pase a un suplente (0 si no se espera a nadie). */
  faltanMs: number;
}

/**
 * Reparto cuando hay jugadores desconectados. Solo cambia D, que es el encargo sin el cual
 * el grupo no puede accionar la máquina:
 *
 * 1. Si quien tiene D se desconecta, el grupo lo espera hasta `ESPERA_RECONEXION_MS`.
 * 2. Si no vuelve en ese tiempo, D pasa al siguiente jugador conectado en el orden de la
 *    partida.
 * 3. Cuando vuelve, recupera D: basta llamar de nuevo sin él en `ausencias`.
 *
 * A, B y C no se mueven: los objetos del ausente quedan reservados y luego en el piso.
 * Devuelve null si `repartir` lo haría o si no queda nadie conectado.
 */
export function repartirConAusencias(
  jugadores: readonly string[],
  sala: number,
  ausencias: Ausencias,
): RepartoConAusencias | null {
  const base = repartir(jugadores, sala);
  if (!base) return null;
  const ausente = (j: string): boolean => Object.hasOwn(ausencias, j);
  if (jugadores.every(ausente)) return null;
  if (!ausente(base.D)) return { reparto: base, esperandoA: null, faltanMs: 0 };

  // Un tiempo que no sea un número válido se toma como «se acaba de desconectar».
  const dato = ausencias[base.D];
  const lleva = typeof dato === 'number' && Number.isFinite(dato) && dato > 0 ? dato : 0;
  if (lleva < ESPERA_RECONEXION_MS) {
    return { reparto: base, esperandoA: base.D, faltanMs: ESPERA_RECONEXION_MS - lleva };
  }

  const n = jugadores.length;
  const desde = jugadores.indexOf(base.D);
  for (let paso = 1; paso < n; paso++) {
    const suplente = jugadores[(desde + paso) % n];
    if (suplente !== undefined && !ausente(suplente)) {
      return { reparto: { ...base, D: suplente }, esperandoA: null, faltanMs: 0 };
    }
  }
  return null;
}
