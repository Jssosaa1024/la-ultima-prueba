import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/content/esquema';
import { PUZZLES } from '../../src/content/puzzles';
import { anotacionDeEtapa, descubrimientos } from '../../src/ui/cuaderno/descubrimientos';

// T38: lo que el cuaderno escribe solo al resolver. El concepto se nombra después.

const s1 = PUZZLES[0] as Puzzle;
const s2 = PUZZLES[1] as Puzzle;

const avance = (cambios: Record<string, number> = {}): Record<string, number> => ({
  's1-cooperativa': 0,
  's2-laboratorio': 0,
  's3-gimnasio': 0,
  's4-biblioteca': 0,
  's5-rectoria': 0,
  ...cambios,
});

describe('descubrimientos', () => {
  it('sin etapas resueltas, el cuaderno no escribe nada', () => {
    expect(descubrimientos(avance(), PUZZLES)).toEqual([]);
  });

  it('con una etapa resuelta anota lo que pasó, sin nombrar el concepto', () => {
    const lista = descubrimientos(avance({ 's1-cooperativa': 1 }), PUZZLES);
    expect(lista).toEqual([
      {
        id: 's1-etiquetadora',
        sala: 1,
        titulo: s1.titulo,
        etapas: [s1.etapas[0]?.aja],
        concepto: null,
      },
    ]);
    expect(JSON.stringify(lista)).not.toContain(s1.cuaderno.concepto);
    expect(JSON.stringify(lista)).not.toContain(s1.cuaderno.texto);
  });

  it('el concepto aparece solo con la sala resuelta', () => {
    const dos = descubrimientos(avance({ 's1-cooperativa': 2 }), PUZZLES)[0];
    expect(dos?.etapas).toHaveLength(2);
    expect(dos?.concepto).toBeNull();
    const tres = descubrimientos(avance({ 's1-cooperativa': 3 }), PUZZLES)[0];
    expect(tres?.etapas).toEqual(s1.etapas.map((e) => e.aja));
    expect(tres?.concepto).toEqual({ nombre: s1.cuaderno.concepto, texto: s1.cuaderno.texto });
  });

  it('va en el orden de las salas y tolera datos raros', () => {
    const lista = descubrimientos(
      avance({ 's1-cooperativa': 3, 's2-laboratorio': 1, 's5-rectoria': 99, otra: 2 }),
      PUZZLES,
    );
    expect(lista.map((d) => d.sala)).toEqual([1, 2, 5]);
    expect(lista[1]?.etapas).toEqual([s2.etapas[0]?.aja]);
    // Un número mayor que las etapas no inventa etapas.
    expect(lista[2]?.etapas).toHaveLength(3);
  });
});

describe('anotacionDeEtapa', () => {
  it('al resolver una etapa cualquiera solo dice lo que pasó', () => {
    expect(anotacionDeEtapa(s1, 1, false)).toEqual({ paso: s1.etapas[1]?.aja, concepto: null });
  });

  it('con el sello nombra el concepto', () => {
    expect(anotacionDeEtapa(s1, 2, true)).toEqual({
      paso: s1.etapas[2]?.aja,
      concepto: { nombre: s1.cuaderno.concepto, texto: s1.cuaderno.texto },
    });
  });

  it('una etapa que no existe no anota nada', () => {
    expect(anotacionDeEtapa(s1, 7, false)).toBeNull();
  });
});
