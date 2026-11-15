import { afterEach, describe, expect, it } from 'vitest';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { liberarObjeto } from '../../src/engine/carga/liberar';
import { idaYVuelta, mezclar, suave } from '../../src/engine/mecanismos/curvas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { animarTanques, DURACION_BANDEJA_S, PAUSA_S } from '../../src/engine/mecanismos/tanques';
import { construirSala } from '../../src/engine/salas/construir';
import { salaPorId } from '../../src/content/salas';
import { etapa, reiniciarMecanismo, resultado } from '../../src/signals/mecanismo';
import type { ResultadoMecanismo } from '../../src/signals/mecanismo';
import { sellos } from '../../src/signals/partida';

// T52: los tanques en 3D solo animan lo que pasó en el panel.

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
    liquidoA: pieza(raiz, 'liquido-s2-tanque-a'),
    liquidoB: pieza(raiz, 'liquido-s2-tanque-b'),
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

  it('los tanques son de vidrio y en reposo muestran cómo empieza la etapa', () => {
    enEtapa(1);
    const { raiz, animacion, liquidoA, liquidoB } = montar();
    expect(material(pieza(raiz, 's2-tanque-a')).transparent).toBe(true);
    expect(material(pieza(raiz, 's2-tanque-a')).opacity).toBeLessThan(1);
    // Etapa 2: A empieza en 10 cm y B en 50 cm, de 60.
    expect(liquidoA.visible).toBe(true);
    expect(liquidoB.visible).toBe(true);
    expect(liquidoB.scale.y / liquidoA.scale.y).toBeCloseTo(5);

    // Etapa 1: A vacío y no hay tanque B.
    enEtapa(0);
    expect(liquidoA.visible).toBe(false);
    expect(liquidoB.visible).toBe(false);
    animacion.liberar();
  });

  it('el tanque tapado con cinta se ve opaco y no deja ver su líquido', () => {
    enEtapa(2);
    const { raiz, animacion, liquidoB } = montar();
    expect(liquidoB.visible).toBe(false);
    expect(material(pieza(raiz, 's2-tanque-b')).opacity).toBe(1);
    // Al cambiar de etapa vuelve a ser de vidrio, con su color.
    const cinta = material(pieza(raiz, 's2-tanque-b')).color.getHex();
    enEtapa(1);
    expect(material(pieza(raiz, 's2-tanque-b')).opacity).toBeLessThan(1);
    expect(material(pieza(raiz, 's2-tanque-b')).color.getHex()).not.toBe(cinta);
    animacion.liberar();
  });

  it('la corrida dura hasta la campana, se queda quieta y los tanques vuelven a su nivel', () => {
    enEtapa(0);
    const { animacion, liquidoA } = montar();
    // Etapa 1 con caudal 3: de 0 a 30 cm en 10 s.
    responder(1, { resuelta: false, condiciones: { nivel: false } });
    avanzar(animacion, 5);
    expect(animacion.estado).toBe('corriendo');
    const mitad = liquidoA.scale.y;
    expect(liquidoA.visible).toBe(true);

    avanzar(animacion, 5.5);
    expect(animacion.estado).toBe('campana');
    expect(liquidoA.scale.y).toBeCloseTo(mitad * 2, 1);
    // Tras la campana los niveles no cambian.
    const alSonar = liquidoA.scale.y;
    avanzar(animacion, 1);
    expect(liquidoA.scale.y).toBe(alSonar);

    avanzar(animacion, PAUSA_S);
    expect(animacion.estado).toBe('reposo');
    expect(liquidoA.visible).toBe(false);
    animacion.liberar();
  });

  it('la palanca baja al arrancar y la campana se sacude al sonar', () => {
    enEtapa(0);
    const { raiz, animacion } = montar();
    const palanca = pieza(raiz, 's2-palanca');
    const campana = pieza(raiz, 's2-campana');
    responder(1);
    avanzar(animacion, 0.35);
    expect(palanca.rotation.x).toBeGreaterThan(0.9);
    expect(campana.rotation.z).toBe(0);
    avanzar(animacion, 9.8);
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

  it('con el sello, la incubadora se abre cuando termina la corrida', () => {
    enEtapa(2);
    const { raiz, animacion } = montar();
    const bandeja = pieza(raiz, 'bandeja-incubadora');
    expect(bandeja.visible).toBe(false);
    expect(bandeja.parent?.name).toBe('s2-incubadora');

    responder(1, {
      etapa: 2,
      estado: {
        a: { nivel: 0, caudal: 2, visible: true },
        b: { nivel: 48, caudal: -2, visible: false },
      },
      sello: true,
    });
    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    etapa.value = null;
    // La corrida de la etapa 3 dura 12 s: mientras tanto la incubadora sigue cerrada.
    avanzar(animacion, 12.5);
    expect(bandeja.visible).toBe(false);
    avanzar(animacion, PAUSA_S + DURACION_BANDEJA_S + 0.2);
    expect(animacion.estado).toBe('incubadora-abierta');
    expect(bandeja.visible).toBe(true);
    animacion.liberar();
  });

  it('al volver a la sala con sello, la incubadora ya está abierta y los tanques vacíos', () => {
    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    const { animacion, liquidoA, liquidoB } = montar();
    expect(animacion.estado).toBe('incubadora-abierta');
    expect(liquidoA.visible).toBe(false);
    expect(liquidoB.visible).toBe(false);
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
    // Dos líquidos, la bandeja y la gota.
    expect(contar()).toBe(antes + 4);
    animacion.liberar();
    expect(liberarObjeto(raiz).geometrias).toBeGreaterThanOrEqual(antes + 4);
  });
});
