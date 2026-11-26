import { afterEach, describe, expect, it } from 'vitest';
import {
  crearRetroalimentacion,
  ESPERA_MAXIMA_S,
  escucharRetroalimentacion,
  PAUSA_HASTA_EL_SELLO_S,
  QUIETA_S,
} from '../../src/engine/audio/retroalimentacion';
import { EFECTOS, NOTAS_ACIERTO, NOTAS_ERROR, NOTAS_SELLO } from '../../src/engine/audio/sintesis';
import { falloEnVivo, resultado, type ResultadoMecanismo } from '../../src/signals/mecanismo';

// Corrección del 25 de noviembre: cada etapa suena con un acierto o un error, cuando la máquina
// termina de moverse, y el sello espera al acierto.

const DT = 1 / 30;

function avanzar(
  retro: ReturnType<typeof crearRetroalimentacion>,
  segundos: number,
  animando = false,
): void {
  for (let t = 0; t < segundos - 1e-9; t += DT) retro.actualizar(DT, animando);
}

describe('crearRetroalimentacion', () => {
  it('el acierto espera a que la máquina termine y deja una pausa', () => {
    const sonidos: string[] = [];
    const retro = crearRetroalimentacion((n) => sonidos.push(n));
    retro.pedir('acierto', false);
    // La máquina se mueve 3 s: nada suena mientras tanto.
    avanzar(retro, 3, true);
    expect(sonidos).toEqual([]);
    // Quieta, pero sin la pausa completa.
    avanzar(retro, QUIETA_S / 2);
    expect(sonidos).toEqual([]);
    avanzar(retro, QUIETA_S);
    expect(sonidos).toEqual(['acierto']);
    expect(retro.esperando).toBe(false);
  });

  it('el error suena igual, después de la máquina', () => {
    const sonidos: string[] = [];
    const retro = crearRetroalimentacion((n) => sonidos.push(n));
    retro.pedir('error', false);
    avanzar(retro, 1, true);
    avanzar(retro, QUIETA_S + DT);
    expect(sonidos).toEqual(['error']);
  });

  it('con el sello: primero el acierto y, con una pausa, el sello', () => {
    const sonidos: string[] = [];
    const retro = crearRetroalimentacion((n) => sonidos.push(n));
    retro.pedir('acierto', true);
    avanzar(retro, QUIETA_S + DT);
    expect(sonidos).toEqual(['acierto']);
    avanzar(retro, PAUSA_HASTA_EL_SELLO_S / 2);
    expect(sonidos).toEqual(['acierto']);
    avanzar(retro, PAUSA_HASTA_EL_SELLO_S);
    expect(sonidos).toEqual(['acierto', 'sello']);
  });

  it('si la animación nunca termina, no espera para siempre', () => {
    const sonidos: string[] = [];
    const retro = crearRetroalimentacion((n) => sonidos.push(n));
    retro.pedir('error', false);
    avanzar(retro, ESPERA_MAXIMA_S + 0.1, true);
    expect(sonidos).toEqual(['error']);
  });

  it('una respuesta nueva reemplaza a la que esperaba', () => {
    const sonidos: string[] = [];
    const retro = crearRetroalimentacion((n) => sonidos.push(n));
    retro.pedir('error', false);
    avanzar(retro, 0.5, true);
    retro.pedir('acierto', false);
    avanzar(retro, 1);
    expect(sonidos).toEqual(['acierto']);
  });
});

describe('escucharRetroalimentacion', () => {
  const r = (n: number, resuelta: boolean, sello = false): ResultadoMecanismo => ({
    n,
    sala: 's1-cooperativa',
    puzzle: 's1-etiquetadora',
    etapa: 0,
    estado: {},
    condiciones: {},
    resuelta,
    sello,
  });
  afterEach(() => {
    resultado.value = null;
  });

  it('pide acierto o error con cada respuesta, y error con cada fallo en vivo', () => {
    resultado.value = r(1, false);
    const pedidos: string[] = [];
    const dejar = escucharRetroalimentacion({
      pedir: (e, sello) => pedidos.push(sello ? `${e}+sello` : e),
      actualizar: () => undefined,
      esperando: false,
    });
    // Lo que ya había respondido al empezar no suena.
    expect(pedidos).toEqual([]);
    resultado.value = r(2, false);
    resultado.value = r(3, true);
    falloEnVivo.value++;
    resultado.value = r(4, true, true);
    expect(pedidos).toEqual(['error', 'acierto', 'error', 'acierto+sello']);
    dejar();
    resultado.value = r(5, false);
    expect(pedidos).toHaveLength(4);
  });
});

describe('los sonidos de acierto y error', () => {
  it('existen, son distintos entre sí y del sello', () => {
    expect(EFECTOS.acierto).toBeTypeOf('function');
    expect(EFECTOS.error).toBeTypeOf('function');
    expect(NOTAS_ACIERTO).not.toEqual(NOTAS_ERROR);
    // El acierto sube y el error baja.
    expect(NOTAS_ACIERTO[1]).toBeGreaterThan(NOTAS_ACIERTO[0] ?? Infinity);
    expect(NOTAS_ERROR[1]).toBeLessThan(NOTAS_ERROR[0] ?? 0);
    // Más corto que el arpegio del sello.
    expect(NOTAS_ACIERTO.length).toBeLessThan(NOTAS_SELLO.length);
  });
});
