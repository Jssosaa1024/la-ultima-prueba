import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { liberarObjeto } from '../../src/engine/carga/liberar';
import {
  animarEtiquetadora,
  DURACION_CAJON_S,
  DURACION_IMPRESION_S,
  etiquetaEn,
  palancaEn,
} from '../../src/engine/mecanismos/etiquetadora';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { construirSala } from '../../src/engine/salas/construir';
import { salaPorId } from '../../src/content/salas';
import { reiniciarMecanismo, resultado } from '../../src/signals/mecanismo';
import type { ResultadoMecanismo } from '../../src/signals/mecanismo';
import { sellos } from '../../src/signals/partida';

// T45: la etiquetadora en 3D solo anima lo que pasó en el panel.

function responder(n: number, cambios: Partial<ResultadoMecanismo> = {}): void {
  resultado.value = {
    n,
    sala: 's1-cooperativa',
    puzzle: 's1-etiquetadora',
    etapa: 0,
    estado: { producto: 'jugo', precio: 2000, rodillos: [20] },
    condiciones: { precio: false },
    resuelta: false,
    sello: false,
    ...cambios,
  };
}

/** Avanza la animación `segundos`, en cuadros de 50 ms. */
function avanzar(animacion: { actualizar(dt: number): void }, segundos: number): void {
  for (let t = 0; t < segundos - 1e-9; t += 0.05) animacion.actualizar(0.05);
}

const pieza = (raiz: Object3D, nombre: string): Object3D => {
  const o = raiz.getObjectByName(nombre);
  if (!o) throw new Error(`falta ${nombre}`);
  return o;
};

afterEach(() => {
  reiniciarMecanismo();
  sellos.value = [];
});

describe('curvas de la impresión', () => {
  it('la palanca baja, llega abajo y vuelve a subir', () => {
    expect(palancaEn(0)).toBe(0);
    expect(palancaEn(DURACION_IMPRESION_S * 0.4)).toBeCloseTo(1);
    expect(palancaEn(DURACION_IMPRESION_S * 0.2)).toBeGreaterThan(0);
    expect(palancaEn(DURACION_IMPRESION_S)).toBe(0);
    expect(palancaEn(99)).toBe(0);
  });

  it('la etiqueta sale cuando la palanca ya bajó, y se queda afuera', () => {
    expect(etiquetaEn(0)).toBe(0);
    expect(etiquetaEn(DURACION_IMPRESION_S * 0.4)).toBe(0);
    expect(etiquetaEn(DURACION_IMPRESION_S * 0.7)).toBeGreaterThan(0);
    expect(etiquetaEn(DURACION_IMPRESION_S)).toBe(1);
    expect(etiquetaEn(99)).toBe(1);
  });
});

describe('animación de la etiquetadora en la sala 1', () => {
  it('la cooperativa tiene animación y las salas sin máquina hecha, no', () => {
    const cooperativa = construirSala(salaPorId('s1-cooperativa'));
    const animacion = animacionDeSala('s1-cooperativa', cooperativa.raiz);
    expect(animacion?.estado).toBe('reposo');
    animacion?.liberar();
    expect(animacionDeSala('porteria', new Group())).toBeNull();
    liberarObjeto(cooperativa.raiz);
  });

  it('al responder la máquina, la palanca baja y vuelve, y queda una etiqueta afuera', () => {
    const { raiz } = construirSala(salaPorId('s1-cooperativa'));
    const animacion = animarEtiquetadora(raiz);
    const palanca = pieza(raiz, 's1-palanca');
    const etiqueta = pieza(raiz, 'etiqueta-impresa');
    expect(etiqueta.visible).toBe(false);
    expect(etiqueta.parent?.name).toBe('s1-etiquetadora');

    responder(1);
    avanzar(animacion, DURACION_IMPRESION_S * 0.4);
    expect(animacion.estado).toBe('imprimiendo');
    expect(palanca.rotation.x).toBeGreaterThan(0.9);

    avanzar(animacion, DURACION_IMPRESION_S);
    expect(animacion.estado).toBe('etiqueta-impresa');
    expect(palanca.rotation.x).toBe(0);
    expect(etiqueta.visible).toBe(true);
    const afuera = etiqueta.position.z;

    // Otra impresión: la etiqueta anterior desaparece y sale una nueva al mismo sitio.
    responder(2);
    avanzar(animacion, 0.1);
    expect(etiqueta.visible).toBe(false);
    avanzar(animacion, DURACION_IMPRESION_S);
    expect(etiqueta.visible).toBe(true);
    expect(etiqueta.position.z).toBeCloseTo(afuera);
    animacion.liberar();
  });

  it('no anima un resultado viejo ni el de otra sala', () => {
    responder(7);
    const { raiz } = construirSala(salaPorId('s1-cooperativa'));
    const animacion = animarEtiquetadora(raiz);
    avanzar(animacion, 0.2);
    expect(animacion.estado).toBe('reposo');

    responder(8, { sala: 's2-laboratorio', puzzle: 's2-tanques' });
    avanzar(animacion, 0.2);
    expect(animacion.estado).toBe('reposo');
    animacion.liberar();
  });

  it('con el sello, el cajón de la registradora se abre después de imprimir', () => {
    const { raiz } = construirSala(salaPorId('s1-cooperativa'));
    const animacion = animarEtiquetadora(raiz);
    const cajon = pieza(raiz, 'cajon-registradora');
    expect(cajon.visible).toBe(false);
    expect(cajon.parent?.name).toBe('s1-registradora');
    const cerrado = cajon.position.z;

    responder(1, { etapa: 2, resuelta: true, sello: true });
    sellos.value = ['s1-cooperativa'];
    // Mientras imprime, el cajón espera.
    avanzar(animacion, DURACION_IMPRESION_S * 0.5);
    expect(cajon.visible).toBe(false);

    avanzar(animacion, DURACION_IMPRESION_S + DURACION_CAJON_S);
    expect(animacion.estado).toBe('registradora-abierta');
    expect(cajon.visible).toBe(true);
    expect(cajon.position.z).toBeGreaterThan(cerrado + 0.2);
    animacion.liberar();
  });

  it('al volver a una sala con sello, la registradora ya está abierta', () => {
    sellos.value = ['s1-cooperativa'];
    const { raiz } = construirSala(salaPorId('s1-cooperativa'));
    const animacion = animarEtiquetadora(raiz);
    expect(animacion.estado).toBe('registradora-abierta');
    expect(pieza(raiz, 'cajon-registradora').visible).toBe(true);
    animacion.liberar();
  });

  it('las piezas nuevas se liberan con la sala y dejar de escuchar detiene la animación', () => {
    const { raiz } = construirSala(salaPorId('s1-cooperativa'));
    const antes = contar(raiz);
    const animacion = animarEtiquetadora(raiz);
    // Etiqueta, cajón y moneda cuelgan de la sala: `liberarObjeto` las encuentra.
    expect(contar(raiz)).toBe(antes + 3);
    expect(liberarObjeto(raiz).geometrias).toBeGreaterThanOrEqual(antes + 3);

    animacion.liberar();
    responder(1);
    avanzar(animacion, 0.2);
    expect(animacion.estado).toBe('reposo');
  });

  it('si a la sala le falta la máquina, no falla', () => {
    const vacia = new Group();
    vacia.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial()));
    const animacion = animarEtiquetadora(vacia);
    responder(1);
    expect(() => avanzar(animacion, DURACION_IMPRESION_S + 0.1)).not.toThrow();
    animacion.liberar();
  });
});

function contar(raiz: Object3D): number {
  let mallas = 0;
  raiz.traverse((o) => {
    if ((o as Mesh).isMesh) mallas++;
  });
  return mallas;
}
