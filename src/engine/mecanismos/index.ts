import type { Object3D } from 'three';
import type { Lugar } from '../../content/esquema-salas';
import { animarLamparas } from '../salas/lamparas';
import { animarBalones } from './balones';
import { animarCajaFuerte } from './caja-fuerte';
import { animarCarritos } from './carritos';
import { animarEtiquetadora } from './etiquetadora';
import { animarFlechas } from './flechas';
import { pulirGimnasio } from './gimnasio-piezas';
import { pulirLaboratorio } from './laboratorio-piezas';
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

/**
 * Junta la máquina de una sala con algo de ambiente que también se mueve (la lámpara que
 * titila, T19k) sin cambiar su `estado` ni su `detalle`: las pruebas e2e siguen leyendo los
 * de la máquina.
 */
export function conAmbiente(maquina: AnimacionSala, ambiente: AnimacionSala): AnimacionSala {
  const junta: AnimacionSala = {
    actualizar(dt) {
      maquina.actualizar(dt);
      ambiente.actualizar(dt);
    },
    get estado() {
      return maquina.estado;
    },
    liberar() {
      maquina.liberar();
      ambiente.liberar();
    },
  };
  // `detalle` solo si la máquina lo tiene: sin él, el motor no escribe `data-detalle`.
  if ('detalle' in maquina) {
    Object.defineProperty(junta, 'detalle', { get: () => maquina.detalle, enumerable: true });
  }
  return junta;
}

/** Lo que se anima en cada sala. Las salas que aún no tienen nada, no animan. */
const ANIMACIONES: Partial<Record<Lugar, (raiz: Object3D) => AnimacionSala>> = {
  // El mural con los sellos ganados y la luz sobre la puerta que toca abrir (hito 1, punto 16).
  porteria: animarPorteria,
  's1-cooperativa': animarEtiquetadora,
  // Los tanques y, con la linterna, las flechas hacia la grabación 1 (T75). Antes, las piezas
  // de la máquina y lo fijo se pulen por código (pulir salas, sesión A).
  's2-laboratorio': (raiz) => {
    pulirLaboratorio(raiz);
    return conDetalle(animarTanques(raiz), animarFlechas(raiz));
  },
  // El reflector y los balones del carro, que rebotan al tocarlos (T75). Antes, las piezas
  // que se mueven o se tocan y lo fijo se pulen por código (pulir salas, sesión A).
  's3-gimnasio': (raiz) => {
    pulirGimnasio(raiz);
    return conDetalle(animarReflector(raiz), animarBalones(raiz));
  },
  's4-biblioteca': animarCarritos,
  // La urna y, con el sello, la caja fuerte que se abre (hito 1, punto 17).
  's5-rectoria': (raiz) => conDetalle(animarUrna(raiz), animarCajaFuerte(raiz)),
};

/** Prepara las animaciones de `lugar` sobre su sala ya construida, si las tiene. */
export function animacionDeSala(lugar: Lugar, raiz: Object3D): AnimacionSala | null {
  const maquina = ANIMACIONES[lugar]?.(raiz) ?? null;
  const lamparas = animarLamparas(raiz);
  if (!lamparas) return maquina;
  return maquina ? conAmbiente(maquina, lamparas) : lamparas;
}
