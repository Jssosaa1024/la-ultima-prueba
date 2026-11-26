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

/**
 * Cómo se mueven los libros (correcciones del 25 nov): cada carrito tiene su «+» y su «−», y
 * cada toque mueve un solo libro entre la pila y ese carrito.
 */
export const INSTRUCCION = '+ pone un libro de la pila en el carrito; − lo devuelve a la pila.';

/** Lo que acaba de pasar, para el lector de pantalla. */
export function textoMovimiento(de: LugarLibro, a: LugarLibro): string {
  return `Pasaste un libro ${desde(de)} ${hacia(a)}.`;
}

/** Nombre del grupo de cada carrito: «Carrito del lunes: 4 libros». */
export const textoCarrito = (i: number, cantidad: number): string =>
  `Carrito del ${dia(i)}: ${libros(cantidad)}`;

/** Nombre accesible del «+» de un carrito. */
export const etiquetaPoner = (i: number): string => `Poner un libro en el carrito del ${dia(i)}`;

/** Nombre accesible del «−» de un carrito. */
export const etiquetaQuitar = (i: number): string => `Quitar un libro del carrito del ${dia(i)}`;

/** «Pila: 20 libros», «Pila: ningún libro». */
export const textoPila = (cantidad: number): string => `Pila: ${libros(cantidad)}`;

/** Rótulo de cada lámpara del resumen semanal, en el orden de la pared. */
export const LAMPARAS = [
  { id: 'media', rotulo: 'MEDIA' },
  { id: 'mediana', rotulo: 'MEDIANA' },
  { id: 'moda', rotulo: 'MODA' },
  { id: 'rango', rotulo: 'RANGO' },
] as const;

/** Números como se escriben en Colombia: «4», «3,5». */
export const numero = (n: number): string => String(n).replace('.', ',');
