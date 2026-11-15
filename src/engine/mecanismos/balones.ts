/**
 * Sala 3 · Los balones del carro (T75).
 *
 * Al tocar un balón («Usar»), rebota un par de veces sobre el carro. Uno solo no rebota: está
 * desinflado, apenas se aplasta, y es el que esconde la grabación 2. Aquí solo se anima; quién
 * entrega la grabación es el controlador de la partida.
 */
import type { Object3D } from 'three';
import { BALONES, grabacionDeObjeto } from '../../content/grabaciones';
import { escuchar } from '../../signals/puente';
import type { AnimacionSala } from './tipos';

/** Lo que dura el rebote completo, en segundos. */
export const DURACION_REBOTE_S = 1.2;
/** Lo que dura el aplastón del balón desinflado. */
export const DURACION_APLASTON_S = 0.5;
/** Altura del primer rebote, en metros. */
const ALTURA_REBOTE = 0.45;

/**
 * Altura de un balón que rebota, a los `t` segundos de tocarlo: tres saltos, cada uno más
 * bajo y más corto, y al final se queda quieto.
 */
export function alturaDeRebote(t: number): number {
  if (t <= 0 || t >= DURACION_REBOTE_S) return 0;
  // Cada salto dura y sube la mitad que el anterior: 4/7, 2/7 y 1/7 del tiempo.
  let inicio = 0;
  let duracion = (DURACION_REBOTE_S * 4) / 7;
  let altura = ALTURA_REBOTE;
  while (t >= inicio + duracion) {
    inicio += duracion;
    duracion /= 2;
    altura /= 2;
  }
  const x = (t - inicio) / duracion;
  // Una parábola: 0 al salir, la altura máxima a la mitad y 0 al caer.
  return altura * 4 * x * (1 - x);
}

/** Cuánto se aplasta el balón desinflado (1 = normal): baja rápido y se recupera despacio. */
export function aplastonEn(t: number): number {
  if (t <= 0 || t >= DURACION_APLASTON_S) return 1;
  const x = t / DURACION_APLASTON_S;
  return 1 - 0.3 * Math.sin(Math.PI * Math.sqrt(x));
}

interface Movimiento {
  balon: Object3D;
  /** Altura de la base del balón en reposo. */
  base: number;
  rebota: boolean;
  t: number;
}

/**
 * @param raiz  la sala ya construida: los balones se buscan por su id.
 */
export function animarBalones(raiz: Object3D): AnimacionSala {
  const balones = new Map<string, Object3D>();
  for (const id of BALONES) {
    const balon = raiz.getObjectByName(id);
    if (balon) balones.set(id, balon);
  }
  const enMovimiento = new Map<string, Movimiento>();
  let ultimo: 'reposo' | 'rebotando' | 'sin-rebote' = 'reposo';

  // La orden de usar un balón llega por el puente, la misma que atiende el controlador.
  const dejarDeEscuchar = escuchar((comando) => {
    if (comando.t !== 'accion' || comando.accion !== 'usar') return;
    const balon = balones.get(comando.objeto);
    if (!balon) return;
    const previo = enMovimiento.get(comando.objeto);
    enMovimiento.set(comando.objeto, {
      balon,
      base: previo ? previo.base : balon.position.y,
      // El que esconde la grabación está desinflado: no rebota.
      rebota: grabacionDeObjeto(comando.objeto) === null,
      t: 0,
    });
  });

  return {
    actualizar(dt) {
      for (const [id, m] of enMovimiento) {
        m.t += dt;
        const duracion = m.rebota ? DURACION_REBOTE_S : DURACION_APLASTON_S;
        if (m.rebota) m.balon.position.y = m.base + alturaDeRebote(m.t);
        else m.balon.scale.y = aplastonEn(m.t);
        ultimo = m.rebota ? 'rebotando' : 'sin-rebote';
        if (m.t >= duracion) {
          m.balon.position.y = m.base;
          m.balon.scale.y = 1;
          enMovimiento.delete(id);
        }
      }
    },
    /** Lo último que hizo un balón: `rebotando` o `sin-rebote`. Antes de tocar alguno, `reposo`. */
    get estado() {
      return ultimo;
    },
    liberar() {
      dejarDeEscuchar();
      enMovimiento.clear();
    },
  };
}
