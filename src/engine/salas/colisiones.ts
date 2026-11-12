/**
 * Cajas de colisión generadas por código (T17).
 *
 * Cada sala marca sus mallas sólidas con `userData.solido = true` (paredes, muebles) y aquí
 * se toma la caja envolvente de cada una en coordenadas del mundo. La exportación desde
 * Blender (T16) queda para después; cuando llegue, sus cajas se suman a esta misma lista.
 */
import { Box3 } from 'three';
import type { Object3D } from 'three';
import type { Caja } from '../jugador/colision';

/** Marca un objeto (y todo lo que tiene adentro) como sólido para el jugador. */
export function marcarSolido<T extends Object3D>(objeto: T): T {
  objeto.userData['solido'] = true;
  return objeto;
}

const caja = new Box3();

/** Una caja por cada malla sólida de `raiz`, en coordenadas del mundo. */
export function cajasDeColision(raiz: Object3D): Caja[] {
  raiz.updateWorldMatrix(true, true);
  const cajas: Caja[] = [];
  raiz.traverse((objeto) => {
    if (objeto.userData['solido'] !== true) return;
    caja.setFromObject(objeto);
    if (caja.isEmpty()) return;
    cajas.push({
      minX: caja.min.x,
      minY: caja.min.y,
      minZ: caja.min.z,
      maxX: caja.max.x,
      maxY: caja.max.y,
      maxZ: caja.max.z,
    });
  });
  return cajas;
}
