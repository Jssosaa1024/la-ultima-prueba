import { afterEach, describe, expect, it } from 'vitest';
import type { Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import {
  ANGULO_ABIERTA,
  animarCajaFuerte,
  anguloPuerta,
  DURACION_APERTURA_S,
} from '../../src/engine/mecanismos/caja-fuerte';
import { construirSala } from '../../src/engine/salas/construir';
import { panel, reiniciarInterfaz } from '../../src/signals/interfaz';
import { reiniciarPartida, sellos } from '../../src/signals/partida';

// Hito 1, punto 17: la caja fuerte de la sala 5 se abre en 3D al resolver.

afterEach(() => {
  reiniciarPartida();
  reiniciarInterfaz();
});

const rectoria = (): Object3D => construirSala(salaPorId('s5-rectoria')).raiz;
const visible = (raiz: Object3D, nombre: string): boolean | undefined =>
  raiz.getObjectByName(nombre)?.visible;

describe('caja fuerte', () => {
  it('la puerta gira hacia afuera de 0 a unos 110°', () => {
    expect(anguloPuerta(0)).toBeCloseTo(0);
    expect(anguloPuerta(1)).toBeCloseTo(-ANGULO_ABIERTA);
    expect(Math.abs(anguloPuerta(0.5))).toBeLessThan(ANGULO_ABIERTA);
  });

  it('cerrada sin el sello; con el sello y sin panel, se abre y deja ver la llave', () => {
    const raiz = rectoria();
    const caja = animarCajaFuerte(raiz);
    caja.actualizar(DURACION_APERTURA_S);
    expect(caja.estado).toBe('caja-cerrada');
    expect(visible(raiz, 'caja-fuerte-llave')).toBe(false);

    sellos.value = [
      's1-cooperativa',
      's2-laboratorio',
      's3-gimnasio',
      's4-biblioteca',
      's5-rectoria',
    ];
    caja.actualizar(DURACION_APERTURA_S / 2);
    expect(caja.estado).toBe('caja-abriendo');
    expect(visible(raiz, 'caja-fuerte-llave')).toBe(true);
    caja.actualizar(DURACION_APERTURA_S);
    expect(caja.estado).toBe('caja-abierta');
    expect(raiz.getObjectByName('caja-fuerte-bisagra')?.rotation.y).toBeCloseTo(-ANGULO_ABIERTA);
    caja.liberar();
  });

  it('con el panel abierto espera a que se cierre', () => {
    const raiz = rectoria();
    const caja = animarCajaFuerte(raiz);
    panel.value = 'mecanismo';
    sellos.value = ['s5-rectoria'];
    caja.actualizar(DURACION_APERTURA_S * 2);
    expect(caja.estado).toBe('caja-cerrada');
    panel.value = null;
    caja.actualizar(DURACION_APERTURA_S);
    expect(caja.estado).toBe('caja-abierta');
    caja.liberar();
  });

  it('si la sala ya tenía el sello al entrar, está abierta desde el principio', () => {
    sellos.value = ['s5-rectoria'];
    const caja = animarCajaFuerte(rectoria());
    expect(caja.estado).toBe('caja-abierta');
    caja.liberar();
  });

  it('el motor la anima en la rectoría junto con la urna (data-detalle)', () => {
    const anim = animacionDeSala('s5-rectoria', rectoria());
    expect(anim?.detalle).toBe('caja-cerrada');
    anim?.liberar();
  });
});
