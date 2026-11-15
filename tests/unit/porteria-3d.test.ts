import { afterEach, describe, expect, it } from 'vitest';
import type { InstancedMesh, Mesh, MeshLambertMaterial, Object3D } from 'three';
import { Color } from 'three';
import { salaPorId } from '../../src/content/salas';
import {
  animarPorteria,
  DURACION_PIEZA_S,
  lucesDePuertas,
} from '../../src/engine/mecanismos/porteria';
import { construirSala } from '../../src/engine/salas/construir';
import { reiniciarPartida, sellos } from '../../src/signals/partida';

// Hito 1, punto 16: el mural de la portería muestra los sellos ganados y se enciende la luz
// sobre la puerta que toca abrir.

const S = ['s1-cooperativa', 's2-laboratorio', 's3-gimnasio', 's4-biblioteca', 's5-rectoria'];

afterEach(() => reiniciarPartida());

describe('lucesDePuertas', () => {
  it('al empezar, solo la puerta 1', () => {
    expect(lucesDePuertas([])).toEqual([
      'siguiente',
      'apagada',
      'apagada',
      'apagada',
      'apagada',
      'apagada',
    ]);
  });

  it('con dos sellos, las salas resueltas quedan hechas y toca la puerta 3', () => {
    expect(lucesDePuertas(S.slice(0, 2))).toEqual([
      'hecha',
      'hecha',
      'siguiente',
      'apagada',
      'apagada',
      'apagada',
    ]);
  });

  it('con los cinco sellos se enciende la salida', () => {
    expect(lucesDePuertas(S)).toEqual(['hecha', 'hecha', 'hecha', 'hecha', 'hecha', 'siguiente']);
  });
});

describe('animarPorteria', () => {
  const pieza = (raiz: Object3D, n: number) =>
    raiz.getObjectByName(`mural-pieza-${n}`) as Mesh<never, MeshLambertMaterial>;

  it('cada sello ganado se enciende en su hueco, y la luz pasa a la puerta siguiente', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    const anim = animarPorteria(raiz);
    expect(anim.estado).toBe('mural-0');
    expect(anim.detalle).toBe('luz-puerta-1');
    expect(pieza(raiz, 1).visible).toBe(false);

    sellos.value = ['s1-cooperativa'];
    expect(anim.detalle).toBe('luz-puerta-2');
    anim.actualizar(DURACION_PIEZA_S / 2);
    expect(pieza(raiz, 1).visible).toBe(true);
    expect(anim.estado).toBe('mural-0');
    anim.actualizar(DURACION_PIEZA_S);
    expect(anim.estado).toBe('mural-1');
    expect(pieza(raiz, 2).visible).toBe(false);
    anim.liberar();
  });

  it('las luces son una sola malla: apagadas, la que toca en ámbar y las hechas en verde', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    sellos.value = ['s1-cooperativa'];
    const anim = animarPorteria(raiz);
    const luces = raiz.getObjectByName('porteria-luces') as InstancedMesh;
    expect(luces.count).toBe(7);
    const color = new Color();
    luces.getColorAt(0, color);
    expect(color.g).toBeGreaterThan(color.r);
    luces.getColorAt(1, color);
    expect(color.r).toBeGreaterThan(0.5);
    luces.getColorAt(2, color);
    expect(color.r).toBeLessThan(0.3);
    anim.liberar();
  });

  it('al volver a la portería reutiliza las piezas y no repite la animación', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    sellos.value = ['s1-cooperativa'];
    const primera = animarPorteria(raiz);
    primera.actualizar(DURACION_PIEZA_S);
    primera.liberar();
    const hijos = raiz.children.length;

    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    const segunda = animarPorteria(raiz);
    expect(raiz.children.length).toBe(hijos);
    // La moneda ya se había visto: sigue encendida. La gota, nueva, se enciende ahora.
    expect(segunda.estado).toBe('mural-1');
    segunda.actualizar(DURACION_PIEZA_S);
    expect(segunda.estado).toBe('mural-2');
    segunda.liberar();
  });

  it('en una partida nueva las piezas se apagan', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    sellos.value = S;
    const anim = animarPorteria(raiz);
    anim.actualizar(DURACION_PIEZA_S);
    expect(anim.estado).toBe('mural-5');
    expect(anim.detalle).toBe('luz-salida');
    sellos.value = [];
    expect(anim.estado).toBe('mural-0');
    expect(pieza(raiz, 5).visible).toBe(false);
    anim.liberar();
  });
});
