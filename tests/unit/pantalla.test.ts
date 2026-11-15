import { describe, expect, it } from 'vitest';
import { debeGirar, LADO_CORTO_CELULAR } from '../../src/engine/pantalla';

describe('debeGirar (T41b)', () => {
  it('un celular en vertical debe girarse', () => {
    expect(debeGirar(393, 727, true)).toBe(true);
    expect(debeGirar(375, 667, true)).toBe(true);
  });

  it('un celular en horizontal no', () => {
    expect(debeGirar(727, 393, true)).toBe(false);
    expect(debeGirar(667, 375, true)).toBe(false);
  });

  it('una pantalla cuadrada no', () => {
    expect(debeGirar(400, 400, true)).toBe(false);
  });

  it('un PC con la ventana angosta no: no es táctil', () => {
    expect(debeGirar(390, 800, false)).toBe(false);
  });

  it('una tableta en vertical no: su lado corto es de tableta', () => {
    expect(debeGirar(768, 1024, true)).toBe(false);
    expect(debeGirar(LADO_CORTO_CELULAR, 1000, true)).toBe(false);
    expect(debeGirar(LADO_CORTO_CELULAR - 1, 1000, true)).toBe(true);
  });
});
