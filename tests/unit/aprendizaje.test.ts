import { describe, expect, it } from 'vitest';
import datos from '../../src/content/resumenes.json';
import { esquemaResumen, SALAS_RESUMEN } from '../../src/content/esquema-resumenes';
import { RESUMENES, textoResumen } from '../../src/content/resumenes';
import { resumenDeAprendizaje } from '../../src/game/aprendizaje';
import { aplicar, crearPartida, SALAS, type Partida, type SalaId } from '../../src/game/partida';
import { PISTAS_INICIALES, type EstadoPistas } from '../../src/game/pistas';

/**
 * Punto 15 del hito 1 · Resumen de aprendizaje de los finales: qué salas se resolvieron, cuáles
 * sin pistas y cómo funcionaba cada máquina.
 */

/** Una partida con las primeras `n` salas resueltas, de vuelta en la portería. */
function conSalasResueltas(n: number): Partida {
  let p = crearPartida();
  for (const sala of SALAS.slice(0, n)) {
    p = aplicar(p, { t: 'entrar', sala });
    for (let etapa = 0; etapa < 3; etapa++) p = aplicar(p, { t: 'resolver_etapa', sala, etapa });
    p = aplicar(p, { t: 'volver_porteria' });
  }
  return p;
}

const conVistas = (vistas: number): EstadoPistas => ({
  ...PISTAS_INICIALES,
  ofrecidas: 3,
  vistas,
});

describe('resumenDeAprendizaje', () => {
  it('siempre trae las cinco salas en orden, aunque no se haya resuelto ninguna', () => {
    const r = resumenDeAprendizaje(crearPartida(), {});
    expect(r.salas.map((s) => s.sala)).toEqual([...SALAS]);
    expect(r.salas.map((s) => s.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(r.salas.every((s) => s.resultado === 'sin_resolver')).toBe(true);
    expect(r).toMatchObject({ resueltas: 0, resueltasSinPistas: 0 });
  });

  it('distingue las salas resueltas sin pistas, con pistas y sin resolver', () => {
    const pistas: Partial<Record<SalaId, EstadoPistas>> = {
      's1-cooperativa': conVistas(0),
      's2-laboratorio': conVistas(2),
      's4-biblioteca': conVistas(1),
    };
    const r = resumenDeAprendizaje(conSalasResueltas(3), pistas);
    expect(r.salas.map((s) => s.resultado)).toEqual([
      'sin_pistas',
      'con_pistas',
      'sin_pistas',
      'sin_resolver',
      'sin_resolver',
    ]);
    expect(r.salas[1]).toMatchObject({ etapas: 3, pistasVistas: 2 });
    expect(r.salas[3]).toMatchObject({ etapas: 0, pistasVistas: 1 });
    expect(r).toMatchObject({ resueltas: 3, resueltasSinPistas: 2 });
  });

  it('una pista ofrecida que no se abrió no cuenta', () => {
    const pistas = { 's1-cooperativa': { ...PISTAS_INICIALES, ofrecidas: 3, vistas: 0 } };
    expect(resumenDeAprendizaje(conSalasResueltas(1), pistas).salas[0]?.resultado).toBe(
      'sin_pistas',
    );
  });

  it('cuenta las etapas de una sala a medias', () => {
    let p = conSalasResueltas(1);
    p = aplicar(p, { t: 'entrar', sala: 's2-laboratorio' });
    p = aplicar(p, { t: 'resolver_etapa', sala: 's2-laboratorio', etapa: 0 });
    p = aplicar(p, { t: 'pedir_ayuda' });
    const r = resumenDeAprendizaje(p, {});
    expect(r.salas[1]).toMatchObject({ resultado: 'sin_resolver', etapas: 1 });
    expect(r.resueltas).toBe(1);
  });

  it('con las cinco salas resueltas sin pistas, todo sale limpio', () => {
    const r = resumenDeAprendizaje(conSalasResueltas(5), {});
    expect(r).toMatchObject({ resueltas: 5, resueltasSinPistas: 5 });
  });

  it('un estado de pistas raro cuenta como ninguna pista y nunca más de 3', () => {
    const raro = { ...PISTAS_INICIALES, vistas: -2 };
    const muchas = { ...PISTAS_INICIALES, vistas: 9 };
    const r = resumenDeAprendizaje(conSalasResueltas(2), {
      's1-cooperativa': raro,
      's2-laboratorio': muchas,
    });
    expect(r.salas[0]).toMatchObject({ resultado: 'sin_pistas', pistasVistas: 0 });
    expect(r.salas[1]).toMatchObject({ resultado: 'con_pistas', pistasVistas: 3 });
  });

  it('no modifica la partida ni las pistas que recibe', () => {
    const p = conSalasResueltas(2);
    const pistas = { 's1-cooperativa': conVistas(1) };
    const copia = JSON.stringify([p, pistas]);
    resumenDeAprendizaje(p, pistas);
    expect(JSON.stringify([p, pistas])).toBe(copia);
  });
});

describe('resumenes.json', () => {
  it('cumple el esquema y trae una entrada por sala, en orden', () => {
    for (const r of datos) {
      const v = esquemaResumen.safeParse(r);
      expect(v.success, `${r.id}: ${JSON.stringify(v.error?.issues)}`).toBe(true);
    }
    expect(RESUMENES.map((r) => r.id)).toEqual([...SALAS]);
    expect([...SALAS_RESUMEN]).toEqual([...SALAS]);
  });

  it('cada resumen tiene una o dos frases y no nombra el ICFES ni el Saber 11', () => {
    for (const r of RESUMENES) {
      const frases = r.resumen.match(/[.!?](\s|$)/g) ?? [];
      expect(frases.length, r.id).toBeGreaterThanOrEqual(1);
      expect(frases.length, r.id).toBeLessThanOrEqual(2);
      expect(`${r.tema} ${r.maquina} ${r.resumen}`).not.toMatch(/icfes|saber\s*11/i);
    }
  });

  it('el esquema rechaza tres frases', () => {
    const base = RESUMENES[0];
    expect(esquemaResumen.safeParse({ ...base, resumen: 'Una. Dos. Tres.' }).success).toBe(false);
  });

  it('usa coma decimal, como se escribe en Colombia', () => {
    for (const r of RESUMENES) expect(r.resumen, r.id).not.toMatch(/\d\.\d/);
  });

  it('textoResumen junta el resumen con el concepto del cuaderno', () => {
    expect(textoResumen('s1-cooperativa')).toMatchObject({
      tema: 'Porcentajes',
      maquina: 'La etiquetadora',
      concepto: 'El porcentaje como multiplicador',
    });
    for (const sala of SALAS) expect(textoResumen(sala).concepto.length).toBeGreaterThan(0);
  });
});
