import { describe, expect, it } from 'vitest';
import { areaVisible, debeGirar, LADO_CORTO_CELULAR } from '../../src/engine/pantalla';

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

describe('areaVisible (corrección del 25 de noviembre: pantalla corrida)', () => {
  it('sin zoom, el juego toma el tamaño de lo que se ve', () => {
    expect(areaVisible({ width: 851, height: 393, scale: 1 }, false)).toEqual({
      ancho: 851,
      alto: 393,
    });
    expect(areaVisible({ width: 850.6, height: 360.4, scale: 1 }, false)).toEqual({
      ancho: 851,
      alto: 360,
    });
  });

  it('sin visualViewport, con zoom o escribiendo se deja el CSS de siempre', () => {
    expect(areaVisible(null, false)).toBeNull();
    expect(areaVisible({ width: 425, height: 196, scale: 2 }, false)).toBeNull();
    // El teclado achica lo visible: el formulario no debe encogerse por eso.
    expect(areaVisible({ width: 851, height: 150, scale: 1 }, true)).toBeNull();
  });

  it('un tamaño vacío no se usa', () => {
    expect(areaVisible({ width: 0, height: 393, scale: 1 }, false)).toBeNull();
  });
});
