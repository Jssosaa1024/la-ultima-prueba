import { describe, expect, it } from 'vitest';
import {
  ESCALA_MAXIMA,
  VELOCIDAD_PARA_CAMINAR,
  crearAndar,
  saludosNuevos,
  varianteDe,
} from '../../src/engine/coop/animacion-personaje';
import { crearInterpolador, MS_ENTRE_POSES } from '../../src/engine/coop/poses';
import type { PoseMundo } from '../../src/engine/coop/poses';

// T83c: quieto o caminando según la velocidad de las poses, sin patinar, y el saludo.

/** Avanza `ms` a 60 cuadros por segundo moviendo a velocidad `v` (m/s) en x. */
function andarA(andar: ReturnType<typeof crearAndar>, desde: number, ms: number, v: number) {
  let t = desde;
  for (; t < desde + ms; t += 1000 / 60) andar.medir(t, (t * v) / 1000, 0);
  return t;
}

describe('andar de los personajes (T83c)', () => {
  it('quieto al empezar y al no moverse', () => {
    const a = crearAndar(1.2);
    a.medir(0, 3, 4);
    a.medir(16, 3, 4);
    expect(a.paso).toBe('quieto');
    expect(a.velocidad).toBe(0);
  });

  it('camina a la velocidad del jugador y el clip va a la rapidez que no patina', () => {
    const a = crearAndar(1.2);
    andarA(a, 0, 1500, 1.2);
    expect(a.paso).toBe('caminar');
    expect(a.velocidad).toBeCloseTo(1.2, 1);
    expect(a.escala).toBeCloseTo(1, 1);
    // A 2 m/s (la del jugador) el clip va más rápido, con un tope.
    const b = crearAndar(1.2);
    andarA(b, 0, 1500, 2);
    expect(b.escala).toBeCloseTo(2 / 1.2, 1);
    const c = crearAndar(0.5);
    andarA(c, 0, 1500, 2);
    expect(c.escala).toBe(ESCALA_MAXIMA);
  });

  it('no parpadea entre quieto y caminar cerca del umbral', () => {
    const a = crearAndar(1.2);
    andarA(a, 0, 1000, 1);
    expect(a.paso).toBe('caminar');
    // Entre los dos umbrales sigue caminando.
    andarA(a, 1000, 1000, VELOCIDAD_PARA_CAMINAR * 0.8);
    expect(a.paso).toBe('caminar');
    // Al detenerse, para.
    for (let t = 2000; t < 3000; t += 16) a.medir(t, 2, 0);
    expect(a.paso).toBe('quieto');
  });

  it('un salto (otra sala) o un rato sin verlo no cuenta como caminar', () => {
    const a = crearAndar(1.2);
    a.medir(0, 0, 0);
    a.medir(16, 5, 0);
    expect(a.paso).toBe('quieto');
    expect(a.velocidad).toBe(0);
    a.medir(5000, 5.5, 0);
    expect(a.velocidad).toBe(0);
  });

  it('con poses a 2 Hz interpoladas, camina todo el trayecto sin detenerse entre poses', () => {
    const interpolador = crearInterpolador();
    const a = crearAndar(1.2);
    const m: PoseMundo = { s: 0, x: 0, y: 0, z: 0, yaw: 0 };
    // El jugador camina a 2 m/s durante 3 s: una pose cada 500 ms.
    for (let t = 0; t <= 3000; t += MS_ENTRE_POSES) {
      interpolador.recibir(t, { s: 1, x: Math.round(t * 0.2), y: 0, z: 0, yaw: 0 });
    }
    const pasos: string[] = [];
    for (let t = 0; t < 4500; t += 1000 / 60) {
      if (!interpolador.muestra(t, m)) continue;
      a.medir(t, m.x, m.z);
      if (t > 1200 && t < 3200) pasos.push(a.paso);
    }
    expect(new Set(pasos)).toEqual(new Set(['caminar']));
    expect(a.paso).toBe('quieto');
  });
});

describe('saludo por frase rápida (T83c)', () => {
  const senal = (n: number, jugador: string, frase: string | null) => ({ n, jugador, frase });

  it('saluda quien manda una frase nueva, una vez', () => {
    const lista = [senal(1, 'j_a', 'aqui'), senal(2, 'j_b', null), senal(3, 'j_a', 'mira')];
    expect(saludosNuevos(lista, 0)).toEqual({ vistas: 3, jugadores: ['j_a'] });
    expect(saludosNuevos(lista, 3)).toEqual({ vistas: 3, jugadores: null });
    expect(saludosNuevos([...lista, senal(4, 'j_c', 'ven')], 3)).toEqual({
      vistas: 4,
      jugadores: ['j_c'],
    });
  });

  it('un punto sin frase no saluda', () => {
    expect(saludosNuevos([senal(5, 'j_a', null)], 4)).toEqual({ vistas: 5, jugadores: null });
    expect(saludosNuevos([], 4)).toEqual({ vistas: 4, jugadores: null });
  });
});

describe('qué personaje le toca a cada jugador (T83c)', () => {
  it('colores distintos dan personajes distintos y el mismo color, el mismo', () => {
    const con4 = [0, 1, 2, 3].map((c) => varianteDe(c, 4));
    expect(new Set(con4).size).toBe(4);
    expect(varianteDe(2, 4)).toBe(varianteDe(2, 4));
    expect(varianteDe(3, 2)).toBe(1);
    expect(varianteDe(1, 0)).toBe(0);
  });
});
