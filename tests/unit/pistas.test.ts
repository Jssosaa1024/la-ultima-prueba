import { describe, expect, it } from 'vitest';
import { puzzleDeSala } from '../../src/content/puzzles';
import {
  avanzarTiempo,
  hayPistaNueva,
  nivelPorAvance,
  nuevaEtapa,
  PISTAS_INICIALES,
  pistasVistas,
  registrarIntento,
  segundosParaSiguiente,
  verPista,
  type EstadoPistas,
} from '../../src/game/pistas';

const s4 = puzzleDeSala(4);
if (!s4) throw new Error('Falta el puzzle de la sala 4');
/** Sala 4: pistas tras 120, 240 y 360 s, o tras 3, 6 y 9 intentos. */
const pistas = s4.pistas;
const SEG = 1000;

const intentos = (e: EstadoPistas, n: number): EstadoPistas =>
  Array.from({ length: n }).reduce<EstadoPistas>((x) => registrarIntento(x, pistas), e);

describe('pistas graduales (T27)', () => {
  it('no hay pistas al empezar', () => {
    expect(PISTAS_INICIALES.ofrecidas).toBe(0);
    expect(hayPistaNueva(PISTAS_INICIALES)).toBe(false);
    expect(segundosParaSiguiente(pistas, PISTAS_INICIALES)).toBe(120);
  });

  it('se ofrecen por tiempo en la etapa: 120, 240 y 360 segundos', () => {
    let e = avanzarTiempo(PISTAS_INICIALES, pistas, 119 * SEG);
    expect(e.ofrecidas).toBe(0);
    e = avanzarTiempo(e, pistas, 1 * SEG);
    expect(e.ofrecidas).toBe(1);
    expect(segundosParaSiguiente(pistas, e)).toBe(120);
    e = avanzarTiempo(e, pistas, 240 * SEG);
    expect(e.ofrecidas).toBe(3);
    expect(segundosParaSiguiente(pistas, e)).toBeNull();
  });

  it('o por intentos fallidos: 3, 6 y 9', () => {
    expect(intentos(PISTAS_INICIALES, 2).ofrecidas).toBe(0);
    expect(intentos(PISTAS_INICIALES, 3).ofrecidas).toBe(1);
    expect(intentos(PISTAS_INICIALES, 6).ofrecidas).toBe(2);
    expect(intentos(PISTAS_INICIALES, 20).ofrecidas).toBe(3);
  });

  it('tiempo e intentos se combinan, pero siempre en orden', () => {
    // 240 s alcanzan para la pista 2, aunque haya pocos intentos.
    expect(nivelPorAvance(pistas, 240 * SEG, 0)).toBe(2);
    // Sin la pista 1, la 2 no llega: 0 s y 0 intentos no ofrecen nada.
    expect(nivelPorAvance(pistas, 0, 0)).toBe(0);
    expect(nivelPorAvance(pistas, 130 * SEG, 6)).toBe(2);
  });

  it('al pasar de etapa, el conteo vuelve a cero y lo ofrecido se conserva', () => {
    let e = intentos(PISTAS_INICIALES, 3);
    e = nuevaEtapa(avanzarTiempo(e, pistas, 100 * SEG));
    expect(e).toMatchObject({ msEnEtapa: 0, intentosEnEtapa: 0, ofrecidas: 1 });
    e = avanzarTiempo(e, pistas, 200 * SEG);
    expect(e.ofrecidas).toBe(1);
    e = avanzarTiempo(e, pistas, 40 * SEG);
    expect(e.ofrecidas).toBe(2);
  });

  it('el jugador abre las pistas en orden y solo las ofrecidas', () => {
    let e = verPista(PISTAS_INICIALES);
    expect(e).toBe(PISTAS_INICIALES);
    e = avanzarTiempo(e, pistas, 250 * SEG);
    expect(hayPistaNueva(e)).toBe(true);
    e = verPista(e);
    expect(pistasVistas(pistas, e)).toEqual([pistas[0]?.texto]);
    e = verPista(verPista(e));
    expect(e.vistas).toBe(2);
    expect(hayPistaNueva(e)).toBe(false);
  });

  it('ignora tiempos negativos o raros', () => {
    expect(avanzarTiempo(PISTAS_INICIALES, pistas, -5000)).toBe(PISTAS_INICIALES);
    expect(avanzarTiempo(PISTAS_INICIALES, pistas, Number.NaN)).toBe(PISTAS_INICIALES);
    expect(avanzarTiempo(PISTAS_INICIALES, pistas, Number.POSITIVE_INFINITY)).toBe(
      PISTAS_INICIALES,
    );
  });
});
