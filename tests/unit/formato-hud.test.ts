import { describe, expect, it } from 'vitest';
import { formatoReloj, relojEnPalabras } from '../../src/ui/hud/formato';

describe('formatoReloj', () => {
  it('muestra minutos y segundos con dos cifras', () => {
    expect(formatoReloj(40 * 60 * 1000)).toBe('40:00');
    expect(formatoReloj(65_000)).toBe('01:05');
  });

  it('redondea hacia arriba: 00:00 solo al acabarse', () => {
    expect(formatoReloj(1)).toBe('00:01');
    expect(formatoReloj(0)).toBe('00:00');
    expect(formatoReloj(-500)).toBe('00:00');
  });
});

describe('relojEnPalabras', () => {
  it('lee singular y plural', () => {
    expect(relojEnPalabras(61_000)).toBe('1 minuto y 1 segundo');
    expect(relojEnPalabras(38 * 60_000 + 5_000)).toBe('38 minutos y 5 segundos');
    expect(relojEnPalabras(120_000)).toBe('2 minutos');
    expect(relojEnPalabras(9_000)).toBe('9 segundos');
  });
});
