/**
 * Alias y color de cada jugador del cooperativo (T81b), en reglas puras.
 *
 * Dos jugadores de la misma partida nunca tienen el mismo alias ni el mismo color. Decide el
 * anfitrión, en el orden en que le llegan las elecciones: si dos piden lo mismo a la vez, se
 * lo queda el primero y al otro se le pide elegir de nuevo. Por la red solo viajan ids de estas
 * listas; el texto y el tono de cada uno los pone la interfaz.
 */

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

/** Lo que un jugador pide. */
export interface Eleccion {
  alias: Alias;
  color: Color;
}

/**
 * Lo que el anfitrión le aceptó a un jugador. `null` = lo que pidió ya lo tenía otro y todavía
 * no ha elegido de nuevo.
 */
export interface Apariencia {
  jugador: string;
  alias: Alias | null;
  color: Color | null;
}

/** Alias y colores que ya tienen los demás (no `yo`). */
export function ocupados(
  lista: readonly Apariencia[],
  yo: string | null,
): { alias: Alias[]; colores: Color[] } {
  const otros = lista.filter((a) => a.jugador !== yo);
  return {
    alias: otros.flatMap((a) => (a.alias ? [a.alias] : [])),
    colores: otros.flatMap((a) => (a.color ? [a.color] : [])),
  };
}

/** El jugador ya tiene alias y color aceptados. */
export const completa = (lista: readonly Apariencia[], jugador: string): boolean =>
  lista.some((a) => a.jugador === jugador && a.alias !== null && a.color !== null);

/**
 * Atiende la elección de `jugador`. Cada campo se acepta si nadie más lo tiene; si no, se queda
 * con lo que ya tenía (o `null` si es la primera vez). Devuelve la MISMA lista si no cambia
 * nada. Un jugador nuevo queda al final de la lista.
 */
export function elegir(
  lista: readonly Apariencia[],
  jugador: string,
  pedido: Eleccion,
): readonly Apariencia[] {
  const { alias, colores } = ocupados(lista, jugador);
  const antes = lista.find((a) => a.jugador === jugador);
  const nueva: Apariencia = {
    jugador,
    alias: alias.includes(pedido.alias) ? (antes?.alias ?? null) : pedido.alias,
    color: colores.includes(pedido.color) ? (antes?.color ?? null) : pedido.color,
  };
  if (antes && antes.alias === nueva.alias && antes.color === nueva.color) return lista;
  return antes ? lista.map((a) => (a === antes ? nueva : a)) : [...lista, nueva];
}

/**
 * Del lado de quien eligió: qué pasó con su pedido según lo que el anfitrión ya decidió.
 * - `esperando`: el anfitrión todavía no lo ha atendido.
 * - `listo`: se resolvió; `ocupado` dice qué campo ya tenía otro (null si se aceptó todo).
 *
 * Un campo está resuelto si ya es el pedido o si lo tiene otro (perdió). En la `primera`
 * elección (la de Presence, al unirse) también si quedó vacío: chocó y quien lo tenía ya se
 * fue. Después, un campo vacío solo significa que el anfitrión aún no atiende el pedido.
 */
export function resultadoDeEleccion(
  lista: readonly Apariencia[],
  yo: string,
  pedido: Eleccion,
  primera = false,
):
  | { estado: 'esperando' }
  | { estado: 'listo'; ocupado: { alias: Alias | null; color: Color | null } | null } {
  const mia = lista.find((a) => a.jugador === yo);
  if (!mia) return { estado: 'esperando' };
  const otros = ocupados(lista, yo);
  const perdioAlias = otros.alias.includes(pedido.alias);
  const perdioColor = otros.colores.includes(pedido.color);
  const aliasListo = mia.alias === pedido.alias || perdioAlias || (primera && mia.alias === null);
  const colorListo = mia.color === pedido.color || perdioColor || (primera && mia.color === null);
  if (!aliasListo || !colorListo) return { estado: 'esperando' };
  if (!perdioAlias && !perdioColor) return { estado: 'listo', ocupado: null };
  return {
    estado: 'listo',
    ocupado: { alias: perdioAlias ? pedido.alias : null, color: perdioColor ? pedido.color : null },
  };
}
