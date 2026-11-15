import type { Object3D } from 'three';
import type { Lugar } from '../../content/esquema-salas';
import { animarBalones } from './balones';
import { animarCarritos } from './carritos';
import { animarEtiquetadora } from './etiquetadora';
import { animarFlechas } from './flechas';
import { animarPorteria } from './porteria';
import { animarReflector } from './reflector';
import { animarTanques } from './tanques';
import type { AnimacionSala } from './tipos';
import { animarUrna } from './urna';

export type { AnimacionSala } from './tipos';

/**
 * Junta la animación de la máquina de una sala con otra cosa que también se anima en ella.
 * `estado` sigue siendo el de la máquina; el de lo demás queda en `detalle`.
 */
export function conDetalle(maquina: AnimacionSala, extra: AnimacionSala): AnimacionSala {
  return {
    actualizar(dt) {
      maquina.actualizar(dt);
      extra.actualizar(dt);
    },
    get estado() {
      return maquina.estado;
    },
    get detalle() {
      return extra.estado;
    },
    liberar() {
      maquina.liberar();
      extra.liberar();
    },
  };
}

/** Lo que se anima en cada sala. Las salas que aún no tienen nada, no animan. */
const ANIMACIONES: Partial<Record<Lugar, (raiz: Object3D) => AnimacionSala>> = {
  // El mural con los sellos ganados y la luz sobre la puerta que toca abrir (hito 1, punto 16).
  porteria: animarPorteria,
  's1-cooperativa': animarEtiquetadora,
  // Los tanques y, con la linterna, las flechas hacia la grabación 1 (T75).
  's2-laboratorio': (raiz) => conDetalle(animarTanques(raiz), animarFlechas(raiz)),
  // El reflector y los balones del carro, que rebotan al tocarlos (T75).
  's3-gimnasio': (raiz) => conDetalle(animarReflector(raiz), animarBalones(raiz)),
  's4-biblioteca': animarCarritos,
  's5-rectoria': (raiz) => animarUrna(raiz),
};

/** Prepara las animaciones de `lugar` sobre su sala ya construida, si las tiene. */
export function animacionDeSala(lugar: Lugar, raiz: Object3D): AnimacionSala | null {
  return ANIMACIONES[lugar]?.(raiz) ?? null;
}
