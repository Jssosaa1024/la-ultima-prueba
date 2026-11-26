import { describe, expect, it } from 'vitest';
import { ESTACIONES, estacionDeObjeto, piezasDeEstacion } from '../../src/content/estaciones';
import { PUZZLES } from '../../src/content/puzzles';
import { salaPorId } from '../../src/content/salas';
import { estacionAjena } from '../../src/game/estaciones';
import { textoDeAviso } from '../../src/ui/hud/formato';

// Corrección del 25 de noviembre: en la sala 2, una máquina por etapa.

describe('las estaciones de la sala 2', () => {
  const ids = new Set(salaPorId('s2-laboratorio').objetos.map((o) => o.id));

  it('hay tres, cada una con sus piezas en la sala; la primera sin tanque B', () => {
    expect(ESTACIONES).toHaveLength(3);
    for (const e of ESTACIONES) {
      for (const id of piezasDeEstacion(e)) expect(ids.has(id), id).toBe(true);
    }
    expect(ESTACIONES[0]?.tanqueB).toBeNull();
    expect(ESTACIONES[1]?.tanqueB).not.toBeNull();
  });

  it('la palanca de cada estación es la que acciona su etapa', () => {
    const tanques = PUZZLES.find((p) => p.mecanismo === 'tanques');
    tanques?.etapas.forEach((etapa, n) => {
      expect(etapa.intento).toEqual({ tipo: 'accionar', objeto: ESTACIONES[n]?.palanca });
    });
  });

  it('ya no están la máquina única ni la incubadora', () => {
    for (const id of ['s2-tanque-a', 's2-tanque-b', 's2-panel', 's2-palanca', 's2-incubadora']) {
      expect(ids.has(id), id).toBe(false);
    }
  });

  it('cada pieza dice de qué estación es', () => {
    expect(estacionDeObjeto('s2-tablero-2')?.etapa).toBe(1);
    expect(estacionDeObjeto('s2-tanque-b-3')?.etapa).toBe(2);
    expect(estacionDeObjeto('s2-campana')).toBeNull();
    expect(estacionDeObjeto('s2-meson-1')).toBeNull();
  });
});

describe('estacionAjena', () => {
  it('la estación de la etapa pendiente responde; las demás no', () => {
    expect(estacionAjena('s2-palanca-1', 0)).toBeNull();
    expect(estacionAjena('s2-tablero-2', 0)).toEqual({
      estacion: 2,
      resuelta: false,
      encendida: 1,
    });
    expect(estacionAjena('s2-tanque-a-1', 2)).toEqual({
      estacion: 1,
      resuelta: true,
      encendida: 3,
    });
    // Con la sala resuelta, todas están resueltas.
    expect(estacionAjena('s2-palanca-3', null)).toEqual({
      estacion: 3,
      resuelta: true,
      encendida: null,
    });
    // Lo que no es de una estación no cambia.
    expect(estacionAjena('s2-gabinete', 0)).toBeNull();
  });

  it('el HUD lo dice en una frase', () => {
    expect(textoDeAviso({ t: 'estacion', estacion: 2, resuelta: false, encendida: 1 })).toBe(
      'La estación 2 todavía está apagada. La que está encendida es la 1.',
    );
    expect(textoDeAviso({ t: 'estacion', estacion: 1, resuelta: true, encendida: 2 })).toBe(
      'La estación 1 ya está resuelta.',
    );
  });
});
