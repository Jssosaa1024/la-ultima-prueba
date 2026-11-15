import { describe, expect, it } from 'vitest';
import type { PuzzleDe } from '../../src/content/esquema';
import { PUZZLES } from '../../src/content/puzzles';
import { parejas } from '../../src/game/puzzles';
import { EXTRACCIONES, listaDeParejas, simular } from '../../src/ui/mecanismos/urna/simulador';
import { textoRespuesta, textoSimulacion, textoUrna } from '../../src/ui/mecanismos/urna/textos';

// T70: el simulador, «ver parejas» y lo que dice la caja fuerte de la sala 5.

const urna = PUZZLES[4] as PuzzleDe<'urna'>;
const [presentar, torcer, dominar] = urna.etapas.map((e) => e.exito);
if (!presentar || !torcer || !dominar) throw new Error('faltan etapas de la urna');

/** Azar que repite una lista de números, para saber qué fichas salen. */
function azarFijo(valores: number[]): () => number {
  let i = 0;
  return () => valores[i++ % valores.length] ?? 0;
}

describe('simulador de extracciones', () => {
  it('con una sola ficha, o ninguna, no hay pareja que sacar', () => {
    expect(simular(0, 0)).toBeNull();
    expect(simular(1, 0)).toBeNull();
    expect(simular(0, 1)).toBeNull();
  });

  it('con un solo color siempre salen iguales', () => {
    expect(simular(3, 0)).toEqual({ veces: EXTRACCIONES, iguales: 100, distintas: 0 });
    expect(simular(0, 5)).toEqual({ veces: EXTRACCIONES, iguales: 100, distintas: 0 });
  });

  it('con una de cada color nunca salen iguales', () => {
    expect(simular(1, 1)).toEqual({ veces: EXTRACCIONES, iguales: 0, distintas: 100 });
  });

  it('la segunda ficha se saca sin devolver la primera', () => {
    // 2 azules y 1 amarilla. Primera azul (0,1 × 3 < 2); queda 1 azul de 2 fichas.
    // Segunda: 0,6 × 2 = 1,2, que no es menor que 1: sale amarilla. Pareja distinta.
    expect(simular(2, 1, 1, azarFijo([0.1, 0.6]))).toEqual({ veces: 1, iguales: 0, distintas: 1 });
    // Con devolución, 0,6 × 3 = 1,8 < 2 habría dado azul: se comprueba que no se devuelve.
    // Segunda con 0,4 × 2 = 0,8 < 1: azul. Pareja igual.
    expect(simular(2, 1, 1, azarFijo([0.1, 0.4]))).toEqual({ veces: 1, iguales: 1, distintas: 0 });
  });

  it('con muchas extracciones se acerca a la probabilidad de las parejas', () => {
    // Azar reproducible (generador congruencial), para que la prueba no dependa de la suerte.
    let semilla = 12345;
    const azar = (): number => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    const veces = 20_000;
    // 2 y 2: solo 2 de las 6 parejas son iguales (un tercio), no la mitad.
    const dosYDos = simular(2, 2, veces, azar);
    expect((dosYDos?.iguales ?? 0) / veces).toBeCloseTo(1 / 3, 1);
    // 3 y 1: 3 iguales y 3 distintas. Es el juego justo de la etapa «torcer».
    const tresYUno = simular(3, 1, veces, azar);
    expect((tresYUno?.iguales ?? 0) / veces).toBeCloseTo(1 / 2, 1);
  });
});

describe('ver parejas', () => {
  it('lista cada pareja una vez, y cuenta lo mismo que las reglas del juego', () => {
    for (const [a, m] of [
      [0, 0],
      [1, 0],
      [3, 0],
      [2, 2],
      [3, 1],
      [6, 3],
      [10, 10],
    ] as const) {
      const lista = listaDeParejas(a, m);
      const reglas = parejas(a, m);
      expect(lista.iguales, `${a} y ${m}`).toHaveLength(reglas.iguales);
      expect(lista.distintas, `${a} y ${m}`).toHaveLength(reglas.distintas);
    }
  });

  it('las iguales son del mismo color y las distintas, una de cada uno', () => {
    const { iguales, distintas } = listaDeParejas(3, 1);
    expect(iguales).toEqual([
      ['a', 'a'],
      ['a', 'a'],
      ['a', 'a'],
    ]);
    expect(distintas).toEqual([
      ['a', 'm'],
      ['a', 'm'],
      ['a', 'm'],
    ]);
  });
});

describe('textos del panel de la urna', () => {
  it('describe la urna para el lector de pantalla', () => {
    expect(textoUrna({ azules: 0, amarillas: 0 })).toBe('La urna está vacía.');
    expect(textoUrna({ azules: 1, amarillas: 0 })).toBe('En la urna hay 1 ficha azul.');
    expect(textoUrna({ azules: 3, amarillas: 1 })).toBe(
      'En la urna hay 3 fichas azules y 1 ficha amarilla.',
    );
  });

  it('el simulador dice cuántas veces ganó cada uno', () => {
    expect(textoSimulacion({ veces: 100, iguales: 33, distintas: 67 })).toBe(
      'De 100 veces, 33 salieron del mismo color (ganas tú) y 67 de distinto color (gana La Voz).',
    );
    expect(textoSimulacion(null)).toMatch(/menos de dos fichas/);
  });

  it('la caja fuerte cuenta lo que hizo, sin decir «incorrecto»', () => {
    const casos = [
      textoRespuesta({ azules: 0, amarillas: 0 }, presentar, false),
      textoRespuesta({ azules: 2, amarillas: 0 }, presentar, false),
      textoRespuesta({ azules: 2, amarillas: 1 }, presentar, false),
      textoRespuesta({ azules: 2, amarillas: 2 }, torcer, false),
      textoRespuesta({ azules: 4, amarillas: 0 }, torcer, false),
      textoRespuesta({ azules: 5, amarillas: 4 }, dominar, false),
    ];
    for (const frases of casos) {
      const texto = frases.join(' ');
      expect(texto).not.toMatch(/incorrect|error|mal\b|equivoca|fall/i);
      expect(texto).toMatch(/caja/);
    }
  });

  it('con otra cantidad de fichas, dice cuántas contó y cuántas pide la placa', () => {
    const frases = textoRespuesta({ azules: 2, amarillas: 0 }, presentar, false);
    expect(frases[0]).toBe('La caja fuerte contó 2 fichas en la urna. La placa pide 3.');
    expect(frases[1]).toBe('Revisó todas las parejas: 1 del mismo color y 0 de distinto color.');
    expect(frases[2]).toMatch(/No es la cantidad de fichas de la placa/);
  });

  it('con 2 y 2 en la etapa «torcer», muestra que La Voz gana más veces', () => {
    const frases = textoRespuesta({ azules: 2, amarillas: 2 }, torcer, false);
    expect(frases[1]).toBe('Revisó todas las parejas: 2 del mismo color y 4 de distinto color.');
    expect(frases[2]).toMatch(/La Voz gana más veces que tú/);
  });

  it('con 4 del mismo color en un juego que debía ser justo, gana más el jugador', () => {
    expect(textoRespuesta({ azules: 4, amarillas: 0 }, torcer, false)[2]).toMatch(
      /ganas tú más veces que La Voz/,
    );
  });

  it('en «que ganes siempre», una ficha de otro color deja ganar a La Voz', () => {
    expect(textoRespuesta({ azules: 2, amarillas: 1 }, presentar, false)[2]).toMatch(
      /a veces gana La Voz/,
    );
  });

  it('al resolver, la caja se abre', () => {
    const frases = textoRespuesta({ azules: 6, amarillas: 3 }, dominar, true);
    expect(frases[1]).toBe('Revisó todas las parejas: 18 del mismo color y 18 de distinto color.');
    expect(frases[2]).toMatch(/se abrió/);
  });
});
