import { afterEach, describe, expect, it } from 'vitest';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { liberarObjeto } from '../../src/engine/carga/liberar';
import { idaYVuelta, mezclar, suave } from '../../src/engine/mecanismos/curvas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { animarTanques, PAUSA_S } from '../../src/engine/mecanismos/tanques';
import { construirSala } from '../../src/engine/salas/construir';
import { salaPorId } from '../../src/content/salas';
import { etapa, reiniciarMecanismo, resultado } from '../../src/signals/mecanismo';
import type { ResultadoMecanismo } from '../../src/signals/mecanismo';
import { sellos } from '../../src/signals/partida';

// T52: los tanques en 3D solo animan lo que pasó en el panel. Desde la corrección del 25 de
// noviembre hay una estación por etapa, con sus tanques y su palanca.

const enEtapa = (n: number): void => {
  etapa.value = { sala: 's2-laboratorio', puzzle: 's2-tanques', etapa: n };
};

function responder(n: number, cambios: Partial<ResultadoMecanismo> = {}): void {
  resultado.value = {
    n,
    sala: 's2-laboratorio',
    puzzle: 's2-tanques',
    etapa: 0,
    estado: { a: { nivel: 0, caudal: 3, visible: true }, b: null },
    condiciones: { nivel: true },
    resuelta: true,
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

const material = (o: Object3D): MeshLambertMaterial => (o as Mesh).material as MeshLambertMaterial;

function montar() {
  const { raiz } = construirSala(salaPorId('s2-laboratorio'));
  const animacion = animarTanques(raiz);
  return {
    raiz,
    animacion,
    liquido: (tanque: string) => pieza(raiz, `liquido-s2-tanque-${tanque}`),
  };
}

afterEach(() => {
  reiniciarMecanismo();
  sellos.value = [];
});

describe('curvas comunes', () => {
  it('suave va de 0 a 1 sin salirse', () => {
    expect(suave(-1)).toBe(0);
    expect(suave(0.5)).toBeCloseTo(0.5);
    expect(suave(2)).toBe(1);
    expect(mezclar(2, 4, 0.5)).toBe(3);
  });

  it('idaYVuelta sube, llega a 1 y vuelve a 0', () => {
    expect(idaYVuelta(0, 1)).toBe(0);
    expect(idaYVuelta(0.4, 1)).toBeCloseTo(1);
    expect(idaYVuelta(0.7, 1)).toBeGreaterThan(0);
    expect(idaYVuelta(1, 1)).toBe(0);
  });
});

describe('animación de los tanques en la sala 2', () => {
  it('el laboratorio tiene animación', () => {
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const animacion = animacionDeSala('s2-laboratorio', raiz);
    expect(animacion?.estado).toBe('reposo');
    animacion?.liberar();
    liberarObjeto(raiz);
  });

  it('cada estación muestra cómo empieza su etapa, y las resueltas cómo quedaron', () => {
    enEtapa(1);
    const { raiz, animacion, liquido } = montar();
    expect(material(pieza(raiz, 's2-tanque-a-2')).transparent).toBe(true);
    expect(material(pieza(raiz, 's2-tanque-a-2')).opacity).toBeLessThan(1);
    // Estación 2 (etapa en curso): A empieza en 10 cm y B en 50 cm, de 60.
    expect(liquido('a-2').visible).toBe(true);
    expect(liquido('b-2').visible).toBe(true);
    expect(liquido('b-2').scale.y / liquido('a-2').scale.y).toBeCloseTo(5);
    // Estación 1 (resuelta): A quedó en la línea roja, 30 cm.
    expect(liquido('a-1').scale.y / liquido('a-2').scale.y).toBeCloseTo(3);
    // Estación 3 (apagada): A vacío y B tapado con cinta.
    expect(liquido('a-3').visible).toBe(false);
    expect(liquido('b-3').visible).toBe(false);

    // Al empezar la sala, la estación 1 está vacía.
    enEtapa(0);
    expect(liquido('a-1').visible).toBe(false);
    animacion.liberar();
  });

  it('el tanque tapado con cinta se ve opaco y no deja ver su líquido', () => {
    enEtapa(2);
    const { raiz, animacion, liquido } = montar();
    expect(liquido('b-3').visible).toBe(false);
    expect(material(pieza(raiz, 's2-tanque-b-3')).opacity).toBe(1);
    // El B de la estación 2 es de vidrio, con su color.
    expect(material(pieza(raiz, 's2-tanque-b-2')).opacity).toBeLessThan(1);
    animacion.liberar();
  });

  it('la corrida mueve solo la estación de su etapa, hasta la campana, y vuelve al reposo', () => {
    enEtapa(0);
    const { animacion, liquido } = montar();
    // Etapa 1 con caudal 3: de 0 a 30 cm en 10 s.
    responder(1, { resuelta: false, condiciones: { nivel: false } });
    avanzar(animacion, 5);
    expect(animacion.estado).toBe('corriendo');
    expect(animacion.animando).toBe(true);
    const mitad = liquido('a-1').scale.y;
    expect(liquido('a-1').visible).toBe(true);
    // Las otras estaciones no se mueven.
    expect(liquido('a-3').visible).toBe(false);

    avanzar(animacion, 5.5);
    expect(animacion.estado).toBe('campana');
    expect(liquido('a-1').scale.y).toBeCloseTo(mitad * 2, 1);
    // Tras la campana los niveles no cambian, y la máquina deja de animarse.
    const alSonar = liquido('a-1').scale.y;
    avanzar(animacion, 1);
    expect(liquido('a-1').scale.y).toBe(alSonar);
    expect(animacion.animando).toBe(false);

    avanzar(animacion, PAUSA_S);
    expect(animacion.estado).toBe('reposo');
    expect(liquido('a-1').visible).toBe(false);
    animacion.liberar();
  });

  it('baja la palanca de la estación de la etapa y la campana se sacude al sonar', () => {
    enEtapa(1);
    const { raiz, animacion } = montar();
    const palanca = pieza(raiz, 's2-palanca-2');
    const otra = pieza(raiz, 's2-palanca-1');
    const campana = pieza(raiz, 's2-campana');
    responder(1, {
      etapa: 1,
      estado: {
        a: { nivel: 10, caudal: 3, visible: true },
        b: { nivel: 50, caudal: -2, visible: true },
      },
    });
    avanzar(animacion, 0.35);
    expect(palanca.rotation.x).toBeGreaterThan(0.9);
    expect(otra.rotation.x).toBe(0);
    expect(campana.rotation.z).toBe(0);
    avanzar(animacion, 7.8);
    expect(palanca.rotation.x).toBe(0);
    expect(campana.rotation.z).not.toBe(0);
    avanzar(animacion, PAUSA_S + 0.2);
    expect(campana.rotation.z).toBe(0);
    animacion.liberar();
  });

  it('no anima un resultado viejo ni el de otra sala', () => {
    responder(4);
    const { animacion } = montar();
    avanzar(animacion, 0.2);
    expect(animacion.estado).toBe('reposo');
    responder(5, { sala: 's1-cooperativa', puzzle: 's1-etiquetadora' });
    avanzar(animacion, 0.2);
    expect(animacion.estado).toBe('reposo');
    animacion.liberar();
  });

  it('con el sello, las tres estaciones quedan como se resolvieron', () => {
    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    const { animacion, liquido } = montar();
    expect(animacion.estado).toBe('sellada');
    expect(liquido('a-1').visible).toBe(true);
    expect(liquido('a-2').visible).toBe(true);
    expect(liquido('b-2').visible).toBe(true);
    // A y B de la estación 2 se cruzaron: quedaron a la misma altura.
    expect(liquido('a-2').scale.y).toBeCloseTo(liquido('b-2').scale.y);
    expect(liquido('a-3').visible).toBe(true);
    // El B de la estación 3 sigue tapado.
    expect(liquido('b-3').visible).toBe(false);
    animacion.liberar();
  });

  it('las piezas nuevas se liberan con la sala', () => {
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const contar = (): number => {
      let mallas = 0;
      raiz.traverse((o) => {
        if ((o as Mesh).isMesh) mallas++;
      });
      return mallas;
    };
    const antes = contar();
    const animacion = animarTanques(raiz);
    // El líquido de cada uno de los cinco tanques.
    expect(contar()).toBe(antes + 5);
    animacion.liberar();
    expect(liberarObjeto(raiz).geometrias).toBeGreaterThanOrEqual(antes + 5);
  });
});
