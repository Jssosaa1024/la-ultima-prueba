import type { Object3D } from 'three';
import type { Lugar } from '../../content/esquema-salas';
import { animarEtiquetadora } from './etiquetadora';
import { animarReflector } from './reflector';
import type { AnimacionSala } from './tipos';

export type { AnimacionSala } from './tipos';

/** La animación de la máquina de cada sala. Las salas que aún no tienen, no animan nada. */
const ANIMACIONES: Partial<Record<Lugar, (raiz: Object3D) => AnimacionSala>> = {
  's1-cooperativa': animarEtiquetadora,
  's3-gimnasio': animarReflector,
};

/** Prepara la animación de la máquina de `lugar` sobre su sala ya construida, si la tiene. */
export function animacionDeSala(lugar: Lugar, raiz: Object3D): AnimacionSala | null {
  return ANIMACIONES[lugar]?.(raiz) ?? null;
}
