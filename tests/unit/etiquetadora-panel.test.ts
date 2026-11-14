import { describe, expect, it } from 'vitest';
import { precioImpreso } from '../../src/game/puzzles';
import {
  pesos,
  textoImpresion,
  textoRodillo,
  textoRodillos,
  tituloEtiqueta,
} from '../../src/ui/mecanismos/etiquetadora/textos';

// T45: los textos del panel de la etiquetadora.

describe('textos del panel de la etiquetadora', () => {
  it('escribe los precios como en Colombia', () => {
    expect(pesos(1600)).toBe('$1.600');
    expect(pesos(800)).toBe('$800');
    expect(pesos(1234567)).toBe('$1.234.567');
    expect(pesos(0)).toBe('$0');
  });

  it('escribe cada rodillo como está marcado en la caja', () => {
    expect(textoRodillo(-20)).toBe('−20 %');
    expect(textoRodillo(25)).toBe('+25 %');
  });

  it('nombra el producto de la etiqueta', () => {
    expect(tituloEtiqueta('jugo')).toBe('Etiqueta del jugo');
    expect(tituloEtiqueta('empanada')).toBe('Etiqueta de la empanada');
    expect(tituloEtiqueta('combo')).toBe('Etiqueta del combo');
    expect(tituloEtiqueta('arepa')).toBe('Etiqueta de arepa');
  });

  it('dice con qué rodillos se imprimió', () => {
    expect(textoRodillos([])).toBe('sin rodillos');
    expect(textoRodillos([-20])).toBe('con el rodillo −20 %');
    expect(textoRodillos([-50, 50])).toBe('con los rodillos −50 % y +50 %');
    expect(textoRodillos([-50, 50, 25])).toBe('con los rodillos −50 %, +50 % y +25 %');
  });

  it('cuenta lo que pasó sin decir si estuvo bien o mal', () => {
    // El «ajá» de la etapa 2: +20 % sobre $1.600 no devuelve los $2.000.
    const impreso = precioImpreso(1600, [20]);
    const texto = textoImpresion(1600, [20], impreso);
    expect(texto).toBe('Con el rodillo +20 %, la etiqueta pasó de $1.600 a $1.920: subió $320.');
    expect(texto).not.toMatch(/incorrect|mal|error|fall/i);

    expect(textoImpresion(2000, [-20], 1600)).toBe(
      'Con el rodillo −20 %, la etiqueta pasó de $2.000 a $1.600: bajó $400.',
    );
    // −50 % y +50 % no se anulan.
    expect(textoImpresion(4000, [-50, 50], precioImpreso(4000, [-50, 50]))).toBe(
      'Con los rodillos −50 % y +50 %, la etiqueta pasó de $4.000 a $3.000: bajó $1.000.',
    );
    // −20 % y +25 % sí.
    expect(textoImpresion(2000, [-20, 25], precioImpreso(2000, [-20, 25]))).toBe(
      'Con los rodillos −20 % y +25 %, la etiqueta pasó de $2.000 a $2.000: quedó igual.',
    );
    expect(textoImpresion(2000, [], 2000)).toBe(
      'Sin rodillos, la etiqueta salió con el mismo precio: $2.000.',
    );
  });
});
