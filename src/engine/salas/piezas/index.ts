/**
 * Registro de las piezas por código (ver `comunes.ts`). Cada sala agrega las suyas en su
 * propio archivo de esta carpeta y las suma aquí; en `salas.json` se piden por nombre con
 * `pieza`. Una prueba de unidad revisa que cada `pieza` de `salas.json` esté registrada y
 * quepa en el `tam` de su objeto.
 */
import { MeshLambertMaterial } from 'three';
import type { ObjetoSala } from '../../../content/esquema-salas';
import { texturaDibujada } from '../laminas';
import { pintarConBlanco } from './comunes';
import type { ConstructorPieza, Pieza } from './comunes';

export type { ConstructorPieza, Pieza } from './comunes';

/** Nombre de la pieza → cómo se arma. */
export const PIEZAS: Readonly<Record<string, ConstructorPieza>> = {};

/** La pieza del objeto, o `null` si no pide una o no está registrada (queda la primitiva). */
export function crearPieza(o: ObjetoSala): Pieza | null {
  if (!o.pieza) return null;
  const constructor = PIEZAS[o.pieza];
  if (!constructor) {
    console.warn(`La pieza ${o.pieza} de ${o.id} no está registrada; queda la primitiva`);
    return null;
  }
  return constructor(o);
}

/**
 * Material de una pieza: Lambert con sus colores por vértice y, si dibuja algo, su textura.
 * Sin navegador (pruebas en Node) no hay textura y la pieza se ve con sus colores.
 */
export function materialPieza(p: Pieza): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: true });
  if (p.dibujo) {
    const textura = texturaDibujada(p.dibujo.ancho, p.dibujo.alto, pintarConBlanco(p.dibujo));
    if (textura) material.map = textura;
  }
  return material;
}
