import { describe, expect, it } from 'vitest';
import { desplazamiento, VELOCIDAD } from '../../src/engine/jugador/movimiento';
import { soltarTodo, crearEntrada } from '../../src/input/entrada';
import { RADIO_JOYSTICK, ZONA_MUERTA, perilla, vectorJoystick } from '../../src/input/joystick';

describe('joystick virtual', () => {
  it('ignora la zona muerta', () => {
    expect(vectorJoystick(RADIO_JOYSTICK * ZONA_MUERTA * 0.9, 0)).toEqual({ x: 0, y: 0 });
  });

  it('arriba es adelante y llega a 1 en el borde', () => {
    const v = vectorJoystick(0, -RADIO_JOYSTICK);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it('nunca pasa de largo 1, aunque el dedo se aleje mucho', () => {
    const v = vectorJoystick(300, -300);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it('crece de forma continua después de la zona muerta', () => {
    const medio = vectorJoystick(0, -RADIO_JOYSTICK * 0.56);
    expect(medio.y).toBeGreaterThan(0.4);
    expect(medio.y).toBeLessThan(0.6);
  });

  it('la perilla se queda dentro de la base', () => {
    expect(perilla(10, 0)).toEqual({ x: 10, y: 0 });
    const p = perilla(300, 400);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(RADIO_JOYSTICK);
  });

  it('soltarTodo detiene el movimiento', () => {
    const e = crearEntrada();
    e.moverX = 0.5;
    e.moverY = 1;
    e.joystick = { baseX: 1, baseY: 2, perillaX: 3, perillaY: 4 };
    soltarTodo(e);
    expect(e).toMatchObject({ moverX: 0, moverY: 0, joystick: null });
  });
});

describe('caminar', () => {
  it('adelante con yaw 0 avanza hacia −Z a la velocidad dada', () => {
    const d = desplazamiento(0, 0, 1, 0.5);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-VELOCIDAD * 0.5);
  });

  it('a la derecha con yaw 0 avanza hacia +X', () => {
    const d = desplazamiento(0, 1, 0, 1);
    expect(d.x).toBeCloseTo(VELOCIDAD);
    expect(d.z).toBeCloseTo(0);
  });

  it('girado 90° a la derecha, adelante es +X y derecha es +Z', () => {
    const yaw = -Math.PI / 2;
    expect(desplazamiento(yaw, 0, 1, 1).x).toBeCloseTo(VELOCIDAD);
    expect(desplazamiento(yaw, 1, 0, 1).z).toBeCloseTo(VELOCIDAD);
  });

  it('en diagonal no camina más rápido', () => {
    const d = desplazamiento(0, 1, 1, 1);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(VELOCIDAD);
  });
});
