import { describe, expect, it } from 'vitest';
import { DURACION_MAX_TOQUE, MOVIMIENTO_MAX_TOQUE, esToque } from '../../src/input/toque';

const en = (x: number, y: number, tiempo: number) => ({ x, y, tiempo });

describe('toque o arrastre', () => {
  it('bajar y subir rápido en el mismo lugar es un toque', () => {
    expect(esToque(en(100, 100, 0), en(103, 101, 120), 4)).toBe(true);
  });

  it('si tarda demasiado, no es un toque', () => {
    expect(esToque(en(100, 100, 0), en(100, 100, DURACION_MAX_TOQUE + 1), 0)).toBe(false);
  });

  it('si se movió, no es un toque', () => {
    expect(esToque(en(100, 100, 0), en(100 + MOVIMIENTO_MAX_TOQUE + 1, 100, 100), 13)).toBe(false);
  });

  it('si fue y volvió al mismo lugar, tampoco: cuenta el recorrido', () => {
    expect(esToque(en(100, 100, 0), en(100, 100, 200), 60)).toBe(false);
  });
});
