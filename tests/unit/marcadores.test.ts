import { describe, expect, it } from 'vitest';
import {
  DURACION_SENAL_MS,
  MAX_MARCADORES,
  crearMarcadores,
  escalaMarcador,
  senalConPunto,
} from '../../src/engine/coop/marcadores';
import type { SenalCoop } from '../../src/signals/coop';

const senal = (n: number, cambios: Partial<SenalCoop> = {}): SenalCoop => ({
  n,
  jugador: 'j_buho',
  s: 1,
  x: 150,
  y: 90,
  z: -300,
  frase: null,
  en: 0,
  ...cambios,
});

describe('señales en la escena (T91)', () => {
  it('cada señal se ve 5 s, late y al final se encoge', () => {
    expect(escalaMarcador(0)).toBeCloseTo(1);
    expect(escalaMarcador(2000)).toBeGreaterThan(0.8);
    expect(escalaMarcador(DURACION_SENAL_MS - 100)).toBeLessThan(0.4);
    expect(escalaMarcador(DURACION_SENAL_MS)).toBe(0);
    expect(escalaMarcador(-1)).toBe(0);
  });

  it('solo se dibujan las de la sala propia y con punto', () => {
    expect(senalConPunto(senal(1), 1)).toBe(true);
    expect(senalConPunto(senal(1), 2)).toBe(false);
    expect(senalConPunto(senal(1, { x: 0, y: 0, z: 0 }), 1)).toBe(false);
  });

  it('todas son una sola malla instanciada, en su punto', () => {
    const m = crearMarcadores();
    const lista = [
      senal(1),
      senal(2, { s: 3 }),
      senal(3, { en: -10_000 }),
      senal(4, { jugador: 'j_otro' }),
    ];
    const vistas = m.cuadro(1000, 1, lista, (j) => (j === 'j_buho' ? 'coral' : null));
    expect(vistas).toBe(2);
    expect(m.malla.count).toBe(2);
    expect(m.malla.instanceMatrix.count).toBe(MAX_MARCADORES);
    const pos = m.malla.instanceMatrix.array.slice(12, 15);
    expect(pos[0]).toBeCloseTo(1.5);
    expect(pos[1]).toBeCloseTo(0.9);
    expect(pos[2]).toBeCloseTo(-3);
    expect(m.cuadro(60_000, 1, lista, () => null)).toBe(0);
    m.liberar();
  });
});
