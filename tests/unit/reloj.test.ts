import { describe, expect, it } from 'vitest';
import {
  agotado,
  crearReloj,
  DURACION_MS,
  formatoRestante,
  pausar,
  reanudar,
  restante,
  transcurrido,
} from '../../src/game/reloj';

const MIN = 60 * 1000;

describe('reloj de 40 minutos activos (T25)', () => {
  it('empieza en pausa con 40 minutos', () => {
    const r = crearReloj();
    expect(r.pausado).toBe(true);
    expect(restante(r, 999_999)).toBe(DURACION_MS);
    expect(formatoRestante(r, 0)).toBe('40:00');
  });

  it('descuenta solo mientras corre', () => {
    let r = reanudar(crearReloj(), 1000);
    expect(restante(r, 1000 + 5 * MIN)).toBe(35 * MIN);
    r = pausar(r, 1000 + 5 * MIN);
    // En pausa (por ejemplo, con el cuaderno abierto) no pasa el tiempo.
    expect(restante(r, 1000 + 30 * MIN)).toBe(35 * MIN);
    r = reanudar(r, 1000 + 30 * MIN);
    expect(restante(r, 1000 + 40 * MIN)).toBe(25 * MIN);
    expect(transcurrido(r, 1000 + 40 * MIN)).toBe(15 * MIN);
  });

  it('pausar o reanudar dos veces no cambia nada', () => {
    const corriendo = reanudar(crearReloj(), 0);
    expect(reanudar(corriendo, 10)).toBe(corriendo);
    const pausado = pausar(corriendo, 10);
    expect(pausar(pausado, 20)).toBe(pausado);
  });

  it('nunca baja de cero y se marca agotado', () => {
    const r = reanudar(crearReloj(), 0);
    expect(agotado(r, DURACION_MS - 1)).toBe(false);
    expect(agotado(r, DURACION_MS)).toBe(true);
    expect(restante(r, DURACION_MS + 10 * MIN)).toBe(0);
    expect(formatoRestante(r, DURACION_MS + 1)).toBe('00:00');
  });

  it('un reloj agotado no se puede reanudar', () => {
    const r = pausar(reanudar(crearReloj(), 0), DURACION_MS + 5);
    expect(r.restanteMs).toBe(0);
    expect(reanudar(r, DURACION_MS + 10)).toBe(r);
  });

  it('ignora un reloj del sistema que retrocede', () => {
    const r = reanudar(crearReloj(), 5000);
    expect(restante(r, 1000)).toBe(DURACION_MS);
  });

  it('muestra minutos y segundos redondeando hacia arriba', () => {
    const r = reanudar(crearReloj(), 0);
    expect(formatoRestante(r, 1)).toBe('40:00');
    expect(formatoRestante(r, 1000)).toBe('39:59');
    expect(formatoRestante(r, 39 * MIN + 59_001)).toBe('00:01');
  });

  it('acepta otra duración para el modo práctica o las pruebas', () => {
    const r = reanudar(crearReloj(2 * MIN), 0);
    expect(restante(r, MIN)).toBe(MIN);
    expect(transcurrido(r, MIN, 2 * MIN)).toBe(MIN);
  });
});
