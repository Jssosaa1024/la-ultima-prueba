import { describe, expect, it } from 'vitest';
import {
  MS_ENTRE_POSES,
  POSES_POR_SEGUNDO,
  RETRASO_INTERPOLACION_MS,
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

  it('2 por segundo, y todo sale de una sola constante (T82b)', () => {
    expect(POSES_POR_SEGUNDO).toBe(2);
    expect(MS_ENTRE_POSES).toBe(500);
    // Siempre hay una pose después del instante que se dibuja, aunque llegue algo tarde.
    expect(RETRASO_INTERPOLACION_MS).toBeGreaterThan(MS_ENTRE_POSES);
  });

  it('en movimiento, POSES_POR_SEGUNDO por segundo', () => {
    const { envios } = simular(10, (t) => [Math.round(t / 10), 0, 0, 0]);
    // La primera sale de una vez; después, una cada intervalo.
    expect(envios.length).toBeGreaterThanOrEqual(10 * POSES_POR_SEGUNDO - 1);
    expect(envios.length).toBeLessThanOrEqual(10 * POSES_POR_SEGUNDO + 1);
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

  it('girar despacio no manda más de POSES_POR_SEGUNDO por segundo', () => {
    // Un cuadro sí y otro no cambia el giro en una centésima de grado.
    const { envios } = simular(10, (t) => [0, 0, 0, Math.floor(t / 33)]);
    expect(envios.length).toBeLessThanOrEqual(10 * POSES_POR_SEGUNDO + 1);
  });
});

describe('interpolación (T82; con 150 ms de retraso para ver las cuentas)', () => {
  const destino = (): PoseMundo => ({ s: 0, x: 0, y: 0, z: 0, yaw: 0 });

  it('sin poses no hay nada que dibujar', () => {
    expect(crearInterpolador().muestra(1000, destino())).toBe(false);
  });

  it('dibuja la pose de hace 150 ms, entre las dos que la rodean', () => {
    const i = crearInterpolador(150, 0);
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
    const i = crearInterpolador(150, 0);
    i.recibir(0, { s: 1, x: 0, y: 0, z: 0, yaw: 0 });
    i.recibir(250, { s: 1, x: 300, y: 0, z: 0, yaw: 0 });
    const d = destino();
    i.muestra(5000, d);
    expect(d.x).toBeCloseTo(3);
  });

  it('gira por el camino corto al cruzar los 180°', () => {
    const i = crearInterpolador(150, 0);
    i.recibir(0, { s: 1, x: 0, y: 0, z: 0, yaw: 17_000 });
    i.recibir(200, { s: 1, x: 0, y: 0, z: 0, yaw: -17_000 });
    const d = destino();
    i.muestra(250, d);
    expect(Math.abs(Math.abs(d.yaw) - Math.PI)).toBeLessThan(0.01);
    expect(diferenciaAngulo(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });

  it('al cambiar de sala salta, sin cruzar paredes', () => {
    const i = crearInterpolador(150, 0);
    i.recibir(0, { s: 0, x: 0, y: 0, z: 0, yaw: 0 });
    i.recibir(200, { s: 1, x: 1000, y: 0, z: 0, yaw: 0 });
    const d = destino();
    i.muestra(250, d);
    expect(d).toMatchObject({ s: 1, x: 10 });
  });

  it('descarta poses desordenadas y guarda solo las últimas', () => {
    const i = crearInterpolador(150, 0);
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

describe('suavidad a 2 Hz (T82b)', () => {
  const destino = (): PoseMundo => ({ s: 0, x: 0, y: 0, z: 0, yaw: 0 });

  /**
   * Un compañero da vueltas en un círculo de 3 m a 1,4 m/s. Sus poses salen como en el juego y
   * llegan con un retraso de red que varía entre 40 y 160 ms. Devuelve la rapidez con la que se
   * lo ve moverse en cada cuadro (m/s) y el cambio de dirección más brusco entre dos cuadros.
   */
  function verloCaminar(
    retrasoMs?: number,
    suavizadoMs?: number,
  ): { rapideces: number[]; giroMax: number } {
    const radio = 3;
    const rapidez = 1.4;
    const emisor = crearEmisorPoses();
    const interpolador = crearInterpolador(retrasoMs, suavizadoMs);
    const enCamino: { llega: number; pose: ReturnType<typeof emisor.cuadro> }[] = [];
    const rapideces: number[] = [];
    let giroMax = 0;
    let anterior: PoseMundo | null = null;
    let rumbo: number | null = null;
    let azar = 7;
    const ruido = (): number => {
      azar = (azar * 16807) % 2147483647;
      return azar / 2147483647;
    };
    const paso = 1000 / 60;
    for (let t = 0; t < 12_000; t += paso) {
      const a = (rapidez * t) / 1000 / radio;
      const pose = emisor.cuadro(t, 1, aCm(radio * Math.cos(a)), 0, aCm(radio * Math.sin(a)), 0);
      if (pose) enCamino.push({ llega: t + 40 + ruido() * 120, pose });
      for (let k = enCamino.length - 1; k >= 0; k--) {
        const m = enCamino[k];
        if (m && m.llega <= t && m.pose) {
          interpolador.recibir(t, m.pose);
          enCamino.splice(k, 1);
        }
      }
      const d = destino();
      if (!interpolador.muestra(t, d) || t < 2000) continue;
      if (anterior) {
        const dx = d.x - anterior.x;
        const dz = d.z - anterior.z;
        rapideces.push(Math.hypot(dx, dz) / (paso / 1000));
        const nuevo = Math.atan2(dz, dx);
        if (rumbo !== null) giroMax = Math.max(giroMax, Math.abs(diferenciaAngulo(rumbo, nuevo)));
        rumbo = nuevo;
      }
      anterior = { ...d };
    }
    return { rapideces, giroMax };
  }

  it('el compañero nunca se frena entre una pose y la siguiente', () => {
    const { rapideces } = verloCaminar();
    expect(Math.min(...rapideces)).toBeGreaterThan(0.7);
    expect(Math.max(...rapideces)).toBeLessThan(2.4);
  });

  it('dobla en curva, sin quiebres en cada pose', () => {
    const { giroMax } = verloCaminar();
    // Una recta entre poses del círculo quiebra unos 13° en cada una; suavizada, menos de 3°
    // por cuadro.
    expect(giroMax).toBeLessThan((3 * Math.PI) / 180);
    expect(verloCaminar(undefined, 0).giroMax).toBeGreaterThan((10 * Math.PI) / 180);
  });

  it('al detenerse, llega exactamente a la última pose', () => {
    const i = crearInterpolador();
    i.recibir(0, { s: 1, x: 0, y: 0, z: 0, yaw: 0 });
    i.recibir(500, { s: 1, x: 70, y: 0, z: 0, yaw: 4500 });
    i.recibir(620, { s: 1, x: 85, y: 0, z: 0, yaw: 4500 });
    const d = { s: 0, x: 0, y: 0, z: 0, yaw: 0 };
    for (let t = 0; t <= 3000; t += 16) i.muestra(t, d);
    expect(d.x).toBeCloseTo(0.85, 3);
    expect(d.yaw).toBeCloseTo(Math.PI / 4, 3);
  });

  it('al cambiar de sala salta, sin suavizar a través de las paredes', () => {
    const i = crearInterpolador();
    i.recibir(0, { s: 0, x: 0, y: 0, z: 0, yaw: 0 });
    const d = { s: 0, x: 0, y: 0, z: 0, yaw: 0 };
    for (let t = 0; t < 1000; t += 16) i.muestra(t, d);
    i.recibir(1000, { s: 1, x: 500, y: 0, z: 0, yaw: 0 });
    for (let t = 1000; t < 2000; t += 16) {
      i.muestra(t, d);
      // Nunca se dibuja a mitad de camino entre la portería y la sala.
      expect(d.x === 0 || d.x === 5).toBe(true);
    }
    expect(d).toMatchObject({ s: 1, x: 5 });
  });

  it('con el retraso de 4 Hz (150 ms) y sin suavizar, a 2 Hz se frenaría', () => {
    const { rapideces } = verloCaminar(150, 0);
    expect(Math.min(...rapideces)).toBeLessThan(0.1);
  });
});
