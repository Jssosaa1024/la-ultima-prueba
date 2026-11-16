import { describe, expect, it } from 'vitest';
import { ESCENARIO_BASE, simular, tabla } from '../../scripts/carga/simulacion';

// T92: la prueba de carga cuenta los eventos como Supabase (envío + entregas).
// T92b: el canal usa `self: false`, así que nada vuelve a quien lo envía por Supabase.

describe('prueba de carga del cooperativo (T92)', () => {
  it('quietos: la primera pose de cada uno y la foto del anfitrión cada 15 s', async () => {
    const r = await simular({
      ...ESCENARIO_BASE,
      partidas: 1,
      segundos: 30,
      fraccionMoviendose: 0,
      senalesPorMinuto: 0,
    });
    // Solo la primera pose de cada uno: nadie se movió después.
    expect(r.mensajes.dir).toBe(4);
    expect(r.mensajes.evt).toBe(2);
    // Cada mensaje cuesta 1 + 3 entregas (sin la propia, T92b); antes, 1 + 4.
    expect(r.eventosPorSegundo.promedio).toBeCloseTo((6 * 4) / 30, 1);
    expect(r.eventosPorSegundoConEco.promedio).toBeCloseTo((6 * 5) / 30, 1);
    expect(r.ecosDir).toBe(0);
  }, 60_000);

  it('todos caminando a 4 Hz: unas 16 poses por segundo y 80 eventos', async () => {
    const r = await simular({
      ...ESCENARIO_BASE,
      partidas: 1,
      segundos: 20,
      fraccionMoviendose: 1,
      senalesPorMinuto: 0,
      hz: 4,
    });
    expect(r.mensajes.dir / 20).toBeGreaterThan(14);
    expect(r.mensajes.dir / 20).toBeLessThan(18);
    expect(r.eventosPorSegundo.pico).toBeLessThanOrEqual(72);
    // T92b: sin el eco se ahorra una entrega de cada cinco.
    expect(r.eventosPorSegundo.pico).toBeLessThan(r.eventosPorSegundoConEco.pico);
    expect(r.eventosPorSegundo.promedio).toBeCloseTo(r.eventosPorSegundoConEco.promedio * 0.8, 0);
    expect(r.ecosDir).toBe(0);
  }, 60_000);

  it('a 2 Hz, las del juego (T82b), 2 partidas de 4 caben en el plan Free', async () => {
    expect(ESCENARIO_BASE.hz).toBe(2);
    const r = await simular({ ...ESCENARIO_BASE, partidas: 2, segundos: 60 });
    expect(r.mensajes.dir).toBeGreaterThan(0);
    expect(r.eventosPorSegundo.pico).toBeLessThan(100);
    expect(r.planes.find((p) => p.plan === 'Free')?.cabe).toBe(true);
  }, 60_000);

  it('la tabla compara con los tres planes', async () => {
    const r = await simular({ ...ESCENARIO_BASE, partidas: 1, segundos: 5 });
    const t = tabla([r]);
    expect(t).toContain('Free (100/s)');
    expect(t.split('\n')).toHaveLength(3);
    expect(r.planes.map((p) => p.plan)).toEqual(['Free', 'Pro', 'Pro sin tope de gasto']);
  }, 60_000);
});
