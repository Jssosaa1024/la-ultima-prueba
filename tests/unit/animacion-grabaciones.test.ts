import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import type { Mesh, Object3D } from 'three';
import { OBJETO_LINTERNA } from '../../src/content/grabaciones';
import { salaPorId } from '../../src/content/salas';
import { liberarObjeto } from '../../src/engine/carga/liberar';
import { crearInteraccion } from '../../src/engine/interaccion/interaccion';
import { animacionDeSala, conDetalle } from '../../src/engine/mecanismos';
import {
  alturaDeRebote,
  animarBalones,
  aplastonEn,
  DURACION_APLASTON_S,
  DURACION_REBOTE_S,
} from '../../src/engine/mecanismos/balones';
import {
  animarFlechas,
  CANTIDAD_FLECHAS,
  geometriaDeFlechas,
  RUTA_FLECHAS,
} from '../../src/engine/mecanismos/flechas';
import { construirSala } from '../../src/engine/salas/construir';
import { enfocado } from '../../src/signals/interfaz';
import { reiniciarMecanismo } from '../../src/signals/mecanismo';
import { inventario } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';

// T75: lo que el motor anima alrededor de las grabaciones.

const pieza = (raiz: Object3D, nombre: string): Object3D => {
  const o = raiz.getObjectByName(nombre);
  if (!o) throw new Error(`falta ${nombre}`);
  return o;
};

/** Avanza la animación `segundos`, en cuadros de 50 ms. */
function avanzar(animacion: { actualizar(dt: number): void }, segundos: number): void {
  for (let t = 0; t < segundos - 1e-9; t += 0.05) animacion.actualizar(0.05);
}

const tocarBalon = (id: string): void => enviar({ t: 'accion', objeto: id, accion: 'usar' });

afterEach(() => {
  inventario.value = [];
  enfocado.value = null;
  reiniciarMecanismo();
});

describe('la esfera como forma de las salas', () => {
  it('un balón es una esfera de su diámetro, apoyada en su base', () => {
    const { raiz } = construirSala(salaPorId('s3-gimnasio'));
    const balon = pieza(raiz, 's3-balon-1') as Mesh;
    balon.geometry.computeBoundingBox();
    const caja = balon.geometry.boundingBox;
    expect(caja?.min.y).toBeCloseTo(0);
    expect(caja?.max.y).toBeCloseTo(0.24);
    expect(caja?.max.x).toBeCloseTo(0.12);
    // Está sobre el carro (0,9 m) y se puede tocar.
    expect(balon.position.y).toBeCloseTo(0.9);
    expect(balon.userData['interactivo']).toMatchObject({ id: 's3-balon-1', accion: 'usar' });
    liberarObjeto(raiz);
  });

  it('los cuatro balones caben en el presupuesto de triángulos', () => {
    const { raiz, triangulos } = construirSala(salaPorId('s3-gimnasio'));
    const balon = pieza(raiz, 's3-balon-1') as Mesh;
    const delBalon = (balon.geometry.index?.count ?? 0) / 3;
    expect(delBalon).toBeGreaterThan(50);
    expect(delBalon).toBeLessThan(200);
    expect(triangulos).toBeLessThan(90_000);
    liberarObjeto(raiz);
  });
});

describe('curvas de los balones', () => {
  it('el rebote sube, cae y cada salto es más bajo', () => {
    expect(alturaDeRebote(0)).toBe(0);
    const primero = alturaDeRebote((DURACION_REBOTE_S * 2) / 7);
    const segundo = alturaDeRebote((DURACION_REBOTE_S * 5) / 7);
    expect(primero).toBeGreaterThan(0.4);
    expect(segundo).toBeGreaterThan(0);
    expect(segundo).toBeLessThan(primero);
    expect(alturaDeRebote(DURACION_REBOTE_S)).toBe(0);
    // Entre saltos toca el carro.
    expect(alturaDeRebote((DURACION_REBOTE_S * 4) / 7)).toBeCloseTo(0);
  });

  it('el balón desinflado se aplasta y vuelve a su forma, sin levantarse', () => {
    expect(aplastonEn(0)).toBe(1);
    expect(aplastonEn(DURACION_APLASTON_S * 0.25)).toBeLessThan(0.8);
    expect(aplastonEn(DURACION_APLASTON_S)).toBe(1);
  });
});

describe('animación de los balones en el gimnasio', () => {
  it('un balón normal rebota al tocarlo y vuelve a su sitio', () => {
    const { raiz } = construirSala(salaPorId('s3-gimnasio'));
    const animacion = animacionDeSala('s3-gimnasio', raiz);
    if (!animacion) throw new Error('el gimnasio no tiene animación');
    const balon = pieza(raiz, 's3-balon-1');
    const base = balon.position.y;
    // En el gimnasio los balones van junto al reflector, que es la máquina de la sala.
    expect(animacion.detalle).toBe('reposo');

    tocarBalon('s3-balon-1');
    avanzar(animacion, DURACION_REBOTE_S * 0.3);
    expect(animacion.detalle).toBe('rebotando');
    expect(balon.position.y).toBeGreaterThan(base + 0.3);
    // Los demás no se mueven.
    expect(pieza(raiz, 's3-balon-2').position.y).toBe(base);

    avanzar(animacion, DURACION_REBOTE_S);
    expect(balon.position.y).toBe(base);
    animacion.liberar();
  });

  it('el balón que esconde la grabación no rebota: solo se aplasta', () => {
    const { raiz } = construirSala(salaPorId('s3-gimnasio'));
    const animacion = animarBalones(raiz);
    const balon = pieza(raiz, 's3-balon-3');
    const base = balon.position.y;

    tocarBalon('s3-balon-3');
    avanzar(animacion, DURACION_APLASTON_S * 0.3);
    expect(animacion.estado).toBe('sin-rebote');
    expect(balon.position.y).toBe(base);
    expect(balon.scale.y).toBeLessThan(0.85);

    avanzar(animacion, DURACION_APLASTON_S);
    expect(balon.scale.y).toBe(1);
    animacion.liberar();
  });

  it('tocarlo dos veces seguidas no lo deja flotando', () => {
    const { raiz } = construirSala(salaPorId('s3-gimnasio'));
    const animacion = animarBalones(raiz);
    const balon = pieza(raiz, 's3-balon-2');
    const base = balon.position.y;
    tocarBalon('s3-balon-2');
    avanzar(animacion, DURACION_REBOTE_S * 0.3);
    tocarBalon('s3-balon-2');
    avanzar(animacion, DURACION_REBOTE_S + 0.1);
    expect(balon.position.y).toBe(base);
    animacion.liberar();
  });

  it('usar otra cosa no mueve ningún balón, y al liberar deja de escuchar', () => {
    const { raiz } = construirSala(salaPorId('s3-gimnasio'));
    const animacion = animarBalones(raiz);
    const balon = pieza(raiz, 's3-balon-1');
    const base = balon.position.y;
    tocarBalon('s3-polea');
    enviar({ t: 'accion', objeto: 's3-balon-1', accion: 'examinar' });
    avanzar(animacion, 0.3);
    expect(animacion.estado).toBe('reposo');

    animacion.liberar();
    tocarBalon('s3-balon-1');
    avanzar(animacion, 0.3);
    expect(balon.position.y).toBe(base);
  });
});

describe('las flechas del laboratorio', () => {
  it('son una sola malla con cinco flechas, de la entrada al gabinete', () => {
    const g = geometriaDeFlechas();
    // Cada flecha: dos triángulos de cola y uno de punta.
    expect(g.getAttribute('position').count).toBe(CANTIDAD_FLECHAS * 9);
    g.computeBoundingBox();
    const caja = g.boundingBox;
    if (!caja) throw new Error('sin caja');
    // Pegadas al piso y dentro del laboratorio (9 × 6 m).
    expect(caja.max.y).toBeLessThan(0.05);
    expect(caja.min.x).toBeGreaterThan(-4.5);
    expect(caja.max.z).toBeLessThan(3);
    // Terminan cerca del gabinete (x = −4,2; z = −2,4).
    const [x, z] = RUTA_FLECHAS.hasta;
    expect(Math.hypot(x + 4.2, z + 2.4)).toBeLessThan(1);
    g.dispose();
  });

  it('solo se ven con la linterna en el inventario', () => {
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const animacion = animarFlechas(raiz);
    const flechas = pieza(raiz, 'flechas-linterna');
    expect(flechas.visible).toBe(false);
    expect(animacion.estado).toBe('sin-flechas');

    inventario.value = [{ id: OBJETO_LINTERNA, nombre: 'Linterna' }];
    expect(flechas.visible).toBe(true);
    expect(animacion.estado).toBe('flechas');

    inventario.value = [];
    expect(flechas.visible).toBe(false);
    animacion.liberar();
    inventario.value = [{ id: OBJETO_LINTERNA, nombre: 'Linterna' }];
    expect(flechas.visible).toBe(false);
  });

  it('en el laboratorio van junto a los tanques: el estado es el de la máquina', () => {
    inventario.value = [{ id: OBJETO_LINTERNA, nombre: 'Linterna' }];
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const animacion = animacionDeSala('s2-laboratorio', raiz);
    expect(animacion?.estado).toBe('reposo');
    expect(animacion?.detalle).toBe('flechas');
    animacion?.liberar();
    liberarObjeto(raiz);
  });

  it('un toque sobre una flecha la atraviesa: no tapa lo que hay en la sala', () => {
    inventario.value = [{ id: OBJETO_LINTERNA, nombre: 'Linterna' }];
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const animacion = animarFlechas(raiz);
    raiz.updateMatrixWorld(true);
    // Desde arriba de la primera flecha, mirando al piso.
    const [x0, z0] = RUTA_FLECHAS.desde;
    const [x1, z1] = RUTA_FLECHAS.hasta;
    const f = 0.5 / CANTIDAD_FLECHAS;
    const camara = new PerspectiveCamera(70, 1, 0.05, 50);
    camara.position.set(x0 + (x1 - x0) * f, 1.6, z0 + (z1 - z0) * f);
    camara.lookAt(camara.position.x, 0, camara.position.z);
    camara.updateMatrixWorld();
    const interaccion = crearInteraccion(camara, raiz);
    interaccion.tocar(0, 0);
    expect(enfocado.value).toBeNull();
    interaccion.liberar();
    animacion.liberar();
  });

  it('juntar dos animaciones avanza y libera las dos', () => {
    const llamadas: string[] = [];
    const falsa = (nombre: string) => ({
      actualizar: () => void llamadas.push(`${nombre}:actualizar`),
      estado: nombre,
      liberar: () => void llamadas.push(`${nombre}:liberar`),
    });
    const junta = conDetalle(falsa('maquina'), falsa('extra'));
    junta.actualizar(0.1);
    junta.liberar();
    expect(junta.estado).toBe('maquina');
    expect(junta.detalle).toBe('extra');
    expect(llamadas).toEqual([
      'maquina:actualizar',
      'extra:actualizar',
      'maquina:liberar',
      'extra:liberar',
    ]);
  });
});
