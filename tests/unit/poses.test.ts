import { describe, expect, it } from 'vitest';
import {
  MS_ENTRE_POSES,
  aCm,
  centesimasARad,
  crearEmisorPoses,
  crearInterpolador,
  diferenciaAngulo,
  yawACentesimas,
} from '../../src/engine/coop/poses';
import type { PoseMundo } from '../../src/engine/coop/poses';
import { validar, directo } from '../../src/net/protocolo';

describe('cuantización de la pose (T82)', () => {
  it('centímetros enteros y centésimas de grado entre −180° y 180°', () => {
    expect(aCm(1.234)).toBe(123);
    expect(aCm(-0.005)).toBe(-0);
    expect(aCm(500)).toBe(10_000);
    expect(yawACentesimas(Math.PI / 2)).toBe(9000);
    expect(yawACentesimas(-Math.PI / 2)).toBe(-9000);
    expect(yawACentesimas((3 * Math.PI) / 2)).toBe(-9000);
    expect(centesimasARad(18_000)).toBeCloseTo(Math.PI);
  });

  it('la pose cuantizada pasa la validación del protocolo', () => {
    const emisor = crearEmisorPoses();
    const pose = emisor.cuadro(0, 1, aCm(3.21), 0, aCm(-7.5), yawACentesimas(2.5));
    expect(pose).not.toBeNull();
    if (!pose) return;
    const r = validar('dir', directo('j_3f9a', { t: 'pose', p: pose }));
    expect(r.ok).toBe(true);
  });
});

describe('envío de la pose propia (T82)', () => {
  /** Simula `segundos` a 60 cuadros por segundo y devuelve los instantes de cada envío. */
  function simular(
    segundos: number,
    pose: (t: number) => [number, number, number, number],
  ): { envios: number[] } {
    const emisor = crearEmisorPoses();
    const envios: number[] = [];
    for (let t = 0; t <= segundos * 1000; t += 1000 / 60) {
      const [x, y, z, yaw] = pose(t);
      if (emisor.cuadro(t, 1, x, y, z, yaw)) envios.push(t);
    }
    return { envios };
  }

  it('en movimiento, 4 por segundo', () => {
    const { envios } = simular(10, (t) => [Math.round(t / 10), 0, 0, 0]);
    // La primera sale de una vez; después, una cada 250 ms.
    expect(envios.length).toBeGreaterThanOrEqual(39);
    expect(envios.length).toBeLessThanOrEqual(41);
    for (let i = 1; i < envios.length; i++) {
      expect((envios[i] ?? 0) - (envios[i - 1] ?? 0)).toBeGreaterThanOrEqual(MS_ENTRE_POSES - 1);
    }
  });

  it('quieto, ninguna después de la primera', () => {
    const { envios } = simular(5, () => [100, 0, 200, 0]);
    expect(envios).toEqual([0]);
  });

  it('al detenerse sale una más con la pose final', () => {
    const emisor = crearEmisorPoses();
    const enviadas: number[] = [];
    let t = 0;
    for (; t < 1000; t += 16) {
      const p = emisor.cuadro(t, 1, Math.round(t / 10), 0, 0, 0);
      if (p) enviadas.push(p.x);
    }
    const final = Math.round((t - 16) / 10);
    for (; t < 2000; t += 16) {
      const p = emisor.cuadro(t, 1, final, 0, 0, 0);
      if (p) enviadas.push(p.x);
    }
    expect(enviadas.at(-1)).toBe(final);
    // En el segundo quieto solo salió esa.
    expect(enviadas.filter((x) => x === final)).toHaveLength(1);
  });

  it('girar despacio no manda más de 4 por segundo', () => {
    // Un cuadro sí y otro no cambia el giro en una centésima de grado.
    const { envios } = simular(10, (t) => [0, 0, 0, Math.floor(t / 33)]);
    expect(envios.length).toBeLessThanOrEqual(41);
  });
});

describe('interpolación con 150 ms de retraso (T82)', () => {
  const destino = (): PoseMundo => ({ s: 0, x: 0, y: 0, z: 0, yaw: 0 });

  it('sin poses no hay nada que dibujar', () => {
    expect(crearInterpolador().muestra(1000, destino())).toBe(false);
  });

  it('dibuja la pose de hace 150 ms, entre las dos que la rodean', () => {
    const i = crearInterpolador();
    i.recibir(0, { s: 1, x: 0, y: 0, z: 0, yaw: 0 });
    i.recibir(250, { s: 1, x: 100, y: 0, z: -200, yaw: 9000 });
    const d = destino();
    // A los 275 ms se dibuja el instante 125: la mitad del camino.
    expect(i.muestra(275, d)).toBe(true);
    expect(d.x).toBeCloseTo(0.5);
    expect(d.z).toBeCloseTo(-1);
    expect(d.yaw).toBeCloseTo(Math.PI / 4);
    expect(d.s).toBe(1);
  });

  it('después de la última pose se queda quieto (no adivina)', () => {
    const i = crearInterpolador();
    i.recibir(0, { s: 1, x: 0, y: 0, z: 0, yaw: 0 });
    i.recibir(250, { s: 1, x: 300, y: 0, z: 0, yaw: 0 });
    const d = destino();
    i.muestra(5000, d);
    expect(d.x).toBeCloseTo(3);
  });

  it('gira por el camino corto al cruzar los 180°', () => {
    const i = crearInterpolador();
    i.recibir(0, { s: 1, x: 0, y: 0, z: 0, yaw: 17_000 });
    i.recibir(200, { s: 1, x: 0, y: 0, z: 0, yaw: -17_000 });
    const d = destino();
    i.muestra(250, d);
    expect(Math.abs(Math.abs(d.yaw) - Math.PI)).toBeLessThan(0.01);
    expect(diferenciaAngulo(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });

  it('al cambiar de sala salta, sin cruzar paredes', () => {
    const i = crearInterpolador();
    i.recibir(0, { s: 0, x: 0, y: 0, z: 0, yaw: 0 });
    i.recibir(200, { s: 1, x: 1000, y: 0, z: 0, yaw: 0 });
    const d = destino();
    i.muestra(250, d);
    expect(d).toMatchObject({ s: 1, x: 10 });
  });

  it('descarta poses desordenadas y guarda solo las últimas', () => {
    const i = crearInterpolador();
    for (let k = 0; k < 20; k++) i.recibir(k * 250, { s: 1, x: k * 100, y: 0, z: 0, yaw: 0 });
    i.recibir(100, { s: 1, x: -9999, y: 0, z: 0, yaw: 0 });
    const d = destino();
    i.muestra(19 * 250 + 150, d);
    expect(d.x).toBeCloseTo(19);
    // La más vieja que queda es la 12 (8 guardadas): antes de ella, se queda en ella.
    i.muestra(0, d);
    expect(d.x).toBeCloseTo(12);
  });
});
