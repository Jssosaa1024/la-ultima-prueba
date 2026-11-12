import { describe, expect, it } from 'vitest';
import {
  PITCH_MAX,
  SENSIBILIDAD_TACTIL,
  adelante,
  aplicarACamara,
  girar,
} from '../../src/engine/jugador/camara';
import { consumirMirada, crearEntrada } from '../../src/input/entrada';

describe('cámara en primera persona', () => {
  it('arrastrar a la derecha gira a la derecha y hacia abajo mira abajo', () => {
    const o = girar({ yaw: 0, pitch: 0 }, 100, 50);
    expect(o.yaw).toBeCloseTo(-100 * SENSIBILIDAD_TACTIL);
    expect(o.pitch).toBeCloseTo(-50 * SENSIBILIDAD_TACTIL);
    // yaw negativo: «adelante» apunta hacia +X (derecha) partiendo de −Z.
    expect(adelante(o.yaw).x).toBeGreaterThan(0);
  });

  it('limita el giro vertical a ±80°', () => {
    expect(girar({ yaw: 0, pitch: 0 }, 0, -100_000).pitch).toBe(PITCH_MAX);
    expect(girar({ yaw: 0, pitch: 0 }, 0, 100_000).pitch).toBe(-PITCH_MAX);
  });

  it('mantiene el giro horizontal entre −π y π', () => {
    let o = { yaw: 0, pitch: 0 };
    for (let i = 0; i < 50; i++) o = girar(o, 300, 0);
    expect(Math.abs(o.yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it('adelante con yaw 0 mira hacia −Z', () => {
    const { x, z } = adelante(0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it('aplica la orientación con orden YXZ', () => {
    const llamadas: number[][] = [];
    const camara = { rotation: { order: 'XYZ', set: (...v: number[]) => llamadas.push(v) } };
    aplicarACamara(camara, { yaw: 1, pitch: 0.5 });
    expect(camara.rotation.order).toBe('YXZ');
    expect(llamadas).toEqual([[0.5, 1, 0]]);
  });
});

describe('entrada', () => {
  it('consumir la mirada devuelve lo acumulado, aplica la escala y lo pone en cero', () => {
    const e = crearEntrada();
    e.miradaX += 10;
    e.miradaX += 5;
    e.miradaY -= 4;
    e.escalaMirada = 2;
    expect(consumirMirada(e)).toEqual({ dx: 30, dy: -8 });
    expect(consumirMirada(e)).toEqual({ dx: 0, dy: 0 });
  });
});
