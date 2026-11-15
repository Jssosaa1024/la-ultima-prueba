import type { LugarLibro } from '../../../game/puzzles';

/**
 * Textos del panel de los carritos (T64). Puros: se prueban sin navegador.
 *
 * La máquina no explica qué mira cada lámpara ni dice «incorrecto»: solo cuenta dónde están
 * los libros y qué va a pasar con el siguiente toque.
 */

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
const CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

/** «lunes», «martes»… (o «día 8» si algún día hubiera más de siete carritos). */
export const dia = (i: number): string => DIAS[i] ?? `día ${i + 1}`;

/** «Lun», «Mar»… para el rótulo de cada carrito. */
export const diaCorto = (i: number): string => CORTOS[i] ?? `D${i + 1}`;

/** «1 libro», «4 libros», «ningún libro». */
export function libros(n: number): string {
  if (n === 0) return 'ningún libro';
  return n === 1 ? '1 libro' : `${n} libros`;
}

/** «la pila», «el carrito del lunes». */
export const nombreLugar = (lugar: LugarLibro): string =>
  lugar === 'pila' ? 'la pila' : `el carrito del ${dia(lugar)}`;

/** «de la pila», «del carrito del lunes». */
const desde = (lugar: LugarLibro): string =>
  lugar === 'pila' ? 'de la pila' : `del carrito del ${dia(lugar)}`;

/** «a la pila», «al carrito del lunes». */
const hacia = (lugar: LugarLibro): string =>
  lugar === 'pila' ? 'a la pila' : `al carrito del ${dia(lugar)}`;

/** Lo que hará el siguiente toque. */
export function textoInstruccion(origen: LugarLibro | null, hayLibros: boolean): string {
  if (origen === null) {
    return hayLibros
      ? 'Toca de dónde quieres sacar un libro: la pila o un carrito.'
      : 'No hay libros que mover.';
  }
  const donde = origen === 'pila' ? 'un carrito' : 'otro carrito o la pila';
  return `Estás sacando libros ${desde(origen)}. Toca ${donde} para dejar uno.`;
}

/** Lo que acaba de pasar, para el lector de pantalla. */
export function textoMovimiento(de: LugarLibro, a: LugarLibro): string {
  return `Pasaste un libro ${desde(de)} ${hacia(a)}.`;
}

/** Nombre accesible del botón de un lugar, según lo que hará al tocarlo. */
export function etiquetaLugar(
  lugar: LugarLibro,
  cantidad: number,
  origen: LugarLibro | null,
): string {
  const nombre = lugar === 'pila' ? 'Pila' : `Carrito del ${dia(lugar)}`;
  const base = `${nombre}: ${libros(cantidad)}.`;
  if (origen === null) return cantidad > 0 ? `${base} Sacar libros de aquí.` : base;
  if (origen === lugar) return `${base} Dejar de sacar libros de aquí.`;
  return `${base} Dejar aquí un libro ${desde(origen)}.`;
}

/** Rótulo de cada lámpara del resumen semanal, en el orden de la pared. */
export const LAMPARAS = [
  { id: 'media', rotulo: 'MEDIA' },
  { id: 'mediana', rotulo: 'MEDIANA' },
  { id: 'moda', rotulo: 'MODA' },
  { id: 'rango', rotulo: 'RANGO' },
] as const;

/** Números como se escriben en Colombia: «4», «3,5». */
export const numero = (n: number): string => String(n).replace('.', ',');
