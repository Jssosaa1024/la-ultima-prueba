import type { EstadoDe, EtapaDe } from '../../content/esquema';
import { esEntero, esObjeto, evaluacion, soloClaves, type Evaluacion } from './tipos.ts';

/**
 * Sala 4 · Los carritos. Cada lámpara mira una cosa distinta de los libros por día: la
 * media, el del medio, el que se repite y la distancia entre los extremos.
 */

type Etapa = EtapaDe<'carritos'>;
type Estado = EstadoDe<'carritos'>;

export interface Estadisticas {
  media: number;
  mediana: number;
  /** El valor que más se repite, si hay uno solo y aparece al menos dos veces; si no, null. */
  moda: number | null;
  rango: number;
}

export function estadisticas(datos: readonly number[]): Estadisticas {
  if (datos.length === 0) return { media: 0, mediana: 0, moda: null, rango: 0 };
  const orden = [...datos].sort((a, b) => a - b);
  const n = orden.length;
  const suma = orden.reduce((s, x) => s + x, 0);
  const mitad = Math.floor(n / 2);
  const mediana =
    n % 2 === 1 ? (orden[mitad] ?? 0) : ((orden[mitad - 1] ?? 0) + (orden[mitad] ?? 0)) / 2;

  const veces = new Map<number, number>();
  for (const x of orden) veces.set(x, (veces.get(x) ?? 0) + 1);
  const maximo = Math.max(...veces.values());
  const masRepetidos = [...veces].filter(([, v]) => v === maximo).map(([k]) => k);
  const moda = maximo >= 2 && masRepetidos.length === 1 ? (masRepetidos[0] ?? null) : null;

  return { media: suma / n, mediana, moda, rango: (orden[n - 1] ?? 0) - (orden[0] ?? 0) };
}

const casi = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/** Una condición por lámpara encendida en la etapa: `media`, `mediana`, `moda` y `rango`. */
export function evaluarCarritos(etapa: Etapa, estado: Estado): Evaluacion {
  const e = estadisticas(estado.carritos);
  const l = etapa.exito.lamparas;
  const condiciones: Record<string, boolean> = {};
  if (l.media !== undefined) condiciones['media'] = casi(e.media, l.media);
  if (l.mediana !== undefined) condiciones['mediana'] = casi(e.mediana, l.mediana);
  if (l.moda !== undefined) condiciones['moda'] = e.moda === l.moda;
  if (l.rango !== undefined) condiciones['rango'] = e.rango === l.rango;
  return evaluacion(condiciones);
}

/** Libros que siguen en la pila. */
export const librosEnPila = (etapa: Etapa, estado: Estado): number =>
  etapa.controles.libros - estado.carritos.reduce((s, x) => s + x, 0);

/** Revisa un estado que llega de fuera: tantos carritos como hay y no más libros que la pila. */
export function esEstadoCarritos(etapa: Etapa, x: unknown): x is Estado {
  if (!esObjeto(x) || !soloClaves(x, ['carritos'])) return false;
  const c = x['carritos'];
  return (
    Array.isArray(c) &&
    c.length === etapa.controles.carritos &&
    c.every((v) => esEntero(v) && v >= 0) &&
    c.reduce((s: number, v: number) => s + v, 0) <= etapa.controles.libros
  );
}

// ---------- Mover libros (T64) ----------
//
// El panel mueve los libros de a uno: de la pila a un carrito, de un carrito a otro o de
// vuelta a la pila. Cada movimiento es un solo cambio de estado, para que pasar un libro de
// un día a otro no apague la lámpara de la media a medio camino.

/** De dónde sale o a dónde va un libro: la pila o un carrito (0 es el del lunes). */
export type LugarLibro = 'pila' | number;

/** Libros que hay en un lugar; 0 si el carrito no existe. */
export function librosEn(etapa: Etapa, estado: Estado, lugar: LugarLibro): number {
  if (lugar === 'pila') return librosEnPila(etapa, estado);
  return Number.isInteger(lugar) ? (estado.carritos[lugar] ?? 0) : 0;
}

const existe = (estado: Estado, lugar: LugarLibro): boolean =>
  lugar === 'pila' || (Number.isInteger(lugar) && lugar >= 0 && lugar < estado.carritos.length);

/**
 * El estado después de pasar un libro de `de` a `a`. Devuelve null si no se puede: el lugar
 * no existe, es el mismo o no tiene libros.
 */
export function moverLibro(
  etapa: Etapa,
  estado: Estado,
  de: LugarLibro,
  a: LugarLibro,
): Estado | null {
  if (de === a || !existe(estado, de) || !existe(estado, a)) return null;
  if (librosEn(etapa, estado, de) <= 0) return null;
  const carritos = [...estado.carritos];
  if (de !== 'pila') carritos[de] = (carritos[de] ?? 0) - 1;
  if (a !== 'pila') carritos[a] = (carritos[a] ?? 0) + 1;
  return { carritos };
}

/** Todos los libros de vuelta a la pila. */
export const vaciarCarritos = (estado: Estado): Estado => ({
  carritos: estado.carritos.map(() => 0),
});
