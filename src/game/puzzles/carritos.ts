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
