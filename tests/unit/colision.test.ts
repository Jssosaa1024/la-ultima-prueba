import { describe, expect, it } from 'vitest';
import {
  CAPSULA_JUGADOR,
  moverConColision,
  resolverSolapes,
} from '../../src/engine/jugador/colision';
import type { Caja } from '../../src/engine/jugador/colision';

const R = CAPSULA_JUGADOR.radio;

/** Pared de 10 cm de grosor en z = −2, de x = −5 a 5 y 3 m de alto. */
const PARED: Caja = { minX: -5, maxX: 5, minY: 0, maxY: 3, minZ: -2.1, maxZ: -2 };

describe('colisión de cápsula contra cajas', () => {
  it('sin cajas, se mueve libre', () => {
    const p = moverConColision(0, 0, 1, -2, 0, []);
    expect(p.x).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(-2);
  });

  it('una pared detiene al jugador a un radio de distancia', () => {
    const p = moverConColision(0, 0, 0, -5, 0, [PARED]);
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(-2 + R);
  });

  it('caminando en diagonal contra la pared, se desliza a lo largo de ella', () => {
    const p = moverConColision(0, -1.5, 2, -2, 0, [PARED]);
    expect(p.z).toBeCloseTo(-2 + R);
    expect(p.x).toBeCloseTo(2);
  });

  it('un tirón grande no atraviesa una pared delgada', () => {
    const p = moverConColision(0, 0, 0, -50, 0, [PARED]);
    expect(p.z).toBeGreaterThan(-2);
  });

  it('en una esquina queda fuera de las dos paredes', () => {
    const lateral: Caja = { minX: 1, maxX: 1.1, minY: 0, maxY: 3, minZ: -5, maxZ: 5 };
    const p = moverConColision(0, 0, 3, -3, 0, [PARED, lateral]);
    expect(p.x).toBeCloseTo(1 - R);
    expect(p.z).toBeCloseTo(-2 + R);
  });

  it('si aparece dentro de una caja, sale por la cara más cercana', () => {
    const mesa: Caja = { minX: -1, maxX: 1, minY: 0, maxY: 0.75, minZ: -0.5, maxZ: 0.5 };
    const p = resolverSolapes(0.9, 0, 0, [mesa]);
    expect(p).toEqual({ x: 1 + R, z: 0 });
  });

  it('ignora lo que no ocupa la altura del jugador: un tapete y una lámpara colgante', () => {
    const tapete: Caja = { minX: -1, maxX: 1, minY: 0, maxY: 0.02, minZ: -1, maxZ: 1 };
    const lampara: Caja = { minX: -1, maxX: 1, minY: 2.2, maxY: 2.5, minZ: -1, maxZ: 1 };
    const p = moverConColision(-2, 0, 4, 0, 0, [tapete, lampara]);
    expect(p.x).toBeCloseTo(2);
    expect(p.z).toBeCloseTo(0);
  });

  it('choca con una mesa baja (75 cm)', () => {
    const mesa: Caja = { minX: -1, maxX: 1, minY: 0, maxY: 0.75, minZ: -0.5, maxZ: 0.5 };
    const p = moverConColision(-3, 0, 4, 0, 0, [mesa]);
    expect(p.x).toBeCloseTo(-1 - R);
  });
});
