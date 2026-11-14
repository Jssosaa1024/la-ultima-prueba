import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/content/esquema';
import { PUZZLES } from '../../src/content/puzzles';
import type { EtapaActual, ResultadoMecanismo } from '../../src/signals/mecanismo';
import { vistaDelPanel, type DatosDeVista } from '../../src/ui/mecanismos/marco/vista';
import { PANELES } from '../../src/ui/mecanismos/paneles';
import {
  TEXTO_ACCIONAR,
  textoEtapa,
  textoReposo,
  textoResuelta,
} from '../../src/ui/mecanismos/textos';

// T37: qué etapa muestra el panel de mecanismo y con qué textos.

const s1 = PUZZLES[0] as Puzzle;
const s2 = PUZZLES[1] as Puzzle;

const enEtapa = (n: number): EtapaActual => ({ sala: 's1-cooperativa', puzzle: s1.id, etapa: n });

function resultado(cambios: Partial<ResultadoMecanismo> = {}): ResultadoMecanismo {
  return {
    n: 1,
    sala: 's1-cooperativa',
    puzzle: s1.id,
    etapa: 0,
    estado: { producto: 'jugo', precio: 2000, rodillos: [20] },
    condiciones: { precio: false },
    resuelta: false,
    sello: false,
    ...cambios,
  };
}

function datos(cambios: Partial<DatosDeVista> = {}): DatosDeVista {
  return {
    puzzle: s1,
    etapa: enEtapa(0),
    estado: s1.etapas[0]?.estado_inicial,
    condiciones: { precio: false },
    resultado: null,
    visto: 0,
    ...cambios,
  };
}

describe('vistaDelPanel', () => {
  it('con una etapa pendiente muestra sus ajustes, sin resultado todavía', () => {
    expect(vistaDelPanel(datos())).toEqual({
      tipo: 'en_curso',
      numero: 0,
      estado: s1.etapas[0]?.estado_inicial,
      condiciones: { precio: false },
      resultado: null,
    });
  });

  it('un resultado que no resolvió se muestra junto a los controles de la misma etapa', () => {
    const r = resultado();
    expect(vistaDelPanel(datos({ resultado: r }))).toMatchObject({
      tipo: 'en_curso',
      resultado: r,
    });
  });

  it('al resolver, se queda en la etapa resuelta hasta que el jugador toca «Seguir»', () => {
    const r = resultado({ n: 4, resuelta: true, condiciones: { precio: true } });
    // La partida ya va en la etapa 1, con otros ajustes.
    const d = datos({ etapa: enEtapa(1), estado: s1.etapas[1]?.estado_inicial, resultado: r });
    expect(vistaDelPanel(d)).toEqual({
      tipo: 'resuelta',
      numero: 0,
      estado: r.estado,
      condiciones: { precio: true },
      resultado: r,
      sello: false,
    });
    // Después de «Seguir» aparece la etapa nueva, sin el resultado de la anterior.
    expect(vistaDelPanel({ ...d, visto: 4 })).toEqual({
      tipo: 'en_curso',
      numero: 1,
      estado: s1.etapas[1]?.estado_inicial,
      condiciones: { precio: false },
      resultado: null,
    });
  });

  it('con el sello muestra la última etapa resuelta y, después, que la máquina terminó', () => {
    const r = resultado({ n: 9, etapa: 2, resuelta: true, sello: true });
    const d = datos({ etapa: null, estado: null, condiciones: {}, resultado: r });
    expect(vistaDelPanel(d)).toMatchObject({ tipo: 'resuelta', numero: 2, sello: true });
    expect(vistaDelPanel({ ...d, visto: 9 })).toEqual({ tipo: 'terminada' });
  });

  it('una sala con sello y sin resultado pendiente está terminada', () => {
    expect(vistaDelPanel(datos({ etapa: null, estado: null }))).toEqual({ tipo: 'terminada' });
  });

  it('no mezcla el resultado de la máquina de otra sala', () => {
    const r = resultado({ n: 7, resuelta: true, sello: true, etapa: 2 });
    const etapaS2: EtapaActual = { sala: 's2-laboratorio', puzzle: s2.id, etapa: 0 };
    const d = datos({ puzzle: s2, etapa: etapaS2, estado: s2.etapas[0]?.estado_inicial });
    expect(vistaDelPanel({ ...d, resultado: r })).toMatchObject({
      tipo: 'en_curso',
      numero: 0,
      resultado: null,
    });
  });
});

describe('textos y paneles del marco', () => {
  it('hay un panel y un texto de accionar por cada mecanismo', () => {
    for (const p of PUZZLES) {
      expect(PANELES[p.mecanismo], p.mecanismo).toBeTypeOf('function');
      expect(TEXTO_ACCIONAR[p.mecanismo].length, p.mecanismo).toBeGreaterThan(0);
    }
  });

  it('dice en qué etapa va', () => {
    expect(textoEtapa(1, 0, 3)).toBe('Sala 1 · Etapa 1 de 3');
    expect(textoEtapa(5, 2, 3)).toBe('Sala 5 · Etapa 3 de 3');
  });

  it('explica las máquinas que responden solas con los segundos de la regla', () => {
    expect(textoReposo(5)).toContain('5 segundos');
  });

  it('al resolver, habla del sello y de la puerta que se abre', () => {
    expect(textoResuelta(false, 1, 5)).not.toMatch(/sello/);
    expect(textoResuelta(true, 1, 5)).toContain('puerta 2');
    expect(textoResuelta(true, 5, 5)).toContain('puerta de salida');
  });
});
