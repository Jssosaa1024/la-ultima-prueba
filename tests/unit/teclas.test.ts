import { describe, expect, it } from 'vitest';
import { TECLAS_MOVIMIENTO, vectorTeclas } from '../../src/input/teclas';

const con = (...teclas: string[]) => vectorTeclas(new Set(teclas));

describe('teclado', () => {
  it('W y flecha arriba van adelante; S y flecha abajo, atrás', () => {
    expect(con('KeyW')).toEqual({ x: 0, y: 1 });
    expect(con('ArrowUp')).toEqual({ x: 0, y: 1 });
    expect(con('KeyS')).toEqual({ x: 0, y: -1 });
    expect(con('ArrowDown')).toEqual({ x: 0, y: -1 });
  });

  it('A y D se mueven de lado', () => {
    expect(con('KeyA')).toEqual({ x: -1, y: 0 });
    expect(con('KeyD', 'KeyW')).toEqual({ x: 1, y: 1 });
  });

  it('dos teclas opuestas se anulan, y W con flecha arriba no suman', () => {
    expect(con('KeyW', 'KeyS')).toEqual({ x: 0, y: 0 });
    expect(con('KeyW', 'ArrowUp')).toEqual({ x: 0, y: 1 });
  });

  it('otras teclas no mueven', () => {
    expect(con('KeyE', 'Space', 'Escape')).toEqual({ x: 0, y: 0 });
    expect(TECLAS_MOVIMIENTO.has('KeyE')).toBe(false);
  });
});

describe('joystick y teclado juntos', () => {
  it('se suman y nunca pasan de largo 1', async () => {
    const { crearEntrada, movimiento } = await import('../../src/input/entrada');
    const e = crearEntrada();
    e.teclasY = 1;
    expect(movimiento(e)).toEqual({ x: 0, y: 1 });
    e.teclasX = 1;
    const diagonal = movimiento(e);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    e.teclasX = 0;
    e.moverY = 0.5;
    expect(movimiento(e)).toEqual({ x: 0, y: 1 });
    e.teclasY = 0;
    expect(movimiento(e)).toEqual({ x: 0, y: 0.5 });
  });
});
