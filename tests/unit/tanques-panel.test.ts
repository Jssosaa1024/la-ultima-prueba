import { describe, expect, it } from 'vitest';
import type { EstadoDe, EtapaDe, PuzzleDe } from '../../src/content/esquema';
import { PUZZLES } from '../../src/content/puzzles';
import { duracionCorridaS, evaluarTanques } from '../../src/game/puzzles';
import {
  EJE_S,
  lineasDeResultado,
  textoCaudal,
  textoNivel,
  textoRitmo,
  trazo,
} from '../../src/ui/mecanismos/tanques/corrida';

// T52: lo que dibuja el graficador y lo que dice la máquina al sonar la campana.

const puzzle = PUZZLES.find((p): p is PuzzleDe<'tanques'> => p.mecanismo === 'tanques');
if (!puzzle) throw new Error('falta el puzzle de los tanques');
const [presentar, torcer, dominar] = puzzle.etapas as [
  EtapaDe<'tanques'>,
  EtapaDe<'tanques'>,
  EtapaDe<'tanques'>,
];

/** El estado inicial de la etapa con otro caudal en A. */
const conCaudal = (etapa: EtapaDe<'tanques'>, caudal: number): EstadoDe<'tanques'> => ({
  ...etapa.estado_inicial,
  a: { ...etapa.estado_inicial.a, caudal },
});

const lineas = (etapa: EtapaDe<'tanques'>, caudal: number, sello = false): string[] => {
  const estado = conCaudal(etapa, caudal);
  return lineasDeResultado(etapa, estado, evaluarTanques(etapa, estado).resuelta, sello);
};

describe('el trazo del graficador', () => {
  it('un caudal constante dibuja una recta', () => {
    expect(trazo({ nivel: 0, caudal: 3 }, 10, 60)).toEqual([
      [0, 0],
      [10, 30],
    ]);
    expect(trazo({ nivel: 50, caudal: -2 }, 8, 60)).toEqual([
      [0, 50],
      [8, 34],
    ]);
  });

  it('se quiebra cuando el tanque se llena o se vacía', () => {
    expect(trazo({ nivel: 0, caudal: 6 }, 12, 60)).toEqual([
      [0, 0],
      [10, 60],
      [12, 60],
    ]);
    expect(trazo({ nivel: 10, caudal: -5 }, 8, 60)).toEqual([
      [0, 10],
      [2, 0],
      [8, 0],
    ]);
  });

  it('sin caudal es una línea plana, y al empezar es un solo punto', () => {
    expect(trazo({ nivel: 10, caudal: 0 }, 8, 60)).toEqual([
      [0, 10],
      [8, 10],
    ]);
    expect(trazo({ nivel: 10, caudal: 3 }, 0, 60)).toEqual([[0, 10]]);
  });

  it('el eje alcanza para la campana de las tres etapas', () => {
    for (const etapa of puzzle.etapas) expect(duracionCorridaS(etapa)).toBeLessThanOrEqual(EJE_S);
  });
});

describe('textos de los tanques', () => {
  it('escribe caudales, ritmos y niveles', () => {
    expect(textoCaudal(3)).toBe('3 cm/s');
    expect(textoCaudal(-2)).toBe('−2 cm/s');
    expect(textoRitmo(0)).toBe('no cambia');
    expect(textoRitmo(3)).toBe('sube 3 cm cada segundo');
    expect(textoRitmo(-2)).toBe('baja 2 cm cada segundo');
    expect(textoNivel(34)).toBe('34 cm');
    expect(textoNivel(7.5)).toBe('7,5 cm');
  });
});

describe('lo que pasó al sonar la campana', () => {
  it('etapa 1: dice dónde quedó A y dónde está la línea roja', () => {
    expect(lineas(presentar, 2)).toEqual([
      'Al sonar la campana, a los 10 segundos, el tanque A estaba en 20 cm.',
      'La línea roja está en 30 cm.',
      'Los tanques volvieron a como estaban. Puedes mover la perilla y probar otra vez.',
    ]);
    expect(lineas(presentar, 3)).toEqual([
      'Al sonar la campana, a los 10 segundos, el tanque A estaba en 30 cm.',
      'Justo en la línea roja.',
    ]);
  });

  it('etapa 2: dice dónde quedaron los dos tanques', () => {
    expect(lineas(torcer, 2)[0]).toBe(
      'Al sonar la campana, a los 8 segundos, el tanque A estaba en 26 cm y el B en 34 cm.',
    );
    expect(lineas(torcer, 3)).toEqual([
      'Al sonar la campana, a los 8 segundos, los tanques A y B estaban en 34 cm: a la misma altura.',
    ]);
  });

  it('etapa 3: el tanque tapado nunca revela su nivel', () => {
    const fallo = lineas(dominar, 3);
    expect(fallo).toEqual([
      'Al sonar la campana, a los 12 segundos, el tanque A estaba en 36 cm. El B sigue tapado.',
      'La incubadora no se movió: los dos niveles no eran iguales.',
      'Los tanques volvieron a como estaban. Puedes mover la perilla y probar otra vez.',
    ]);
    // B estaba en 24 cm: ese número no aparece.
    expect(fallo.join(' ')).not.toContain('24');

    expect(lineas(dominar, 2, true)).toEqual([
      'Al sonar la campana, a los 12 segundos, el tanque A estaba en 24 cm. El B sigue tapado.',
      'Los dos estaban a la misma altura.',
      'La incubadora se abrió.',
    ]);
  });

  it('nunca dice que estuvo mal', () => {
    for (const etapa of puzzle.etapas) {
      for (let caudal = 0; caudal <= 6; caudal++) {
        expect(lineas(etapa, caudal).join(' ')).not.toMatch(/incorrect|error|fallaste|mal\b/i);
      }
    }
  });
});
