import { describe, expect, it } from 'vitest';
import {
  aplicar,
  crearPartida,
  etapaActual,
  numeroDeSala,
  salaAbierta,
  salaPorNumero,
  salasResueltas,
  SALAS,
  type Accion,
  type Partida,
  type SalaId,
} from '../../src/game/partida';

const varias = (p: Partida, acciones: Accion[]): Partida => acciones.reduce(aplicar, p);

/** Entra a la sala, resuelve sus tres etapas y vuelve a la portería. */
const resolverSala = (sala: SalaId): Accion[] => [
  { t: 'entrar', sala },
  { t: 'resolver_etapa', sala, etapa: 0 },
  { t: 'resolver_etapa', sala, etapa: 1 },
  { t: 'resolver_etapa', sala, etapa: 2 },
  { t: 'volver_porteria' },
];

describe('máquina de estados de la partida (T24)', () => {
  it('empieza en la portería, jugando y sin etapas resueltas', () => {
    const p = crearPartida();
    expect(p.fase).toBe('jugando');
    expect(p.lugar).toBe('porteria');
    expect(salasResueltas(p)).toEqual([]);
    expect(SALAS.map((s) => etapaActual(p, s))).toEqual([0, 0, 0, 0, 0]);
  });

  it('solo la sala 1 está abierta al principio', () => {
    const p = crearPartida();
    expect(SALAS.map((s) => salaAbierta(p, s))).toEqual([true, false, false, false, false]);
    expect(aplicar(p, { t: 'entrar', sala: 's2-laboratorio' })).toBe(p);
  });

  it('se entra y se sale de una sala solo desde la portería', () => {
    const p = aplicar(crearPartida(), { t: 'entrar', sala: 's1-cooperativa' });
    expect(p.lugar).toBe('s1-cooperativa');
    expect(aplicar(p, { t: 'entrar', sala: 's1-cooperativa' })).toBe(p);
    const q = aplicar(p, { t: 'volver_porteria' });
    expect(q.lugar).toBe('porteria');
    expect(aplicar(q, { t: 'volver_porteria' })).toBe(q);
  });

  it('las etapas se resuelven en orden y solo dentro de su sala', () => {
    const fuera = crearPartida();
    expect(aplicar(fuera, { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 })).toBe(fuera);

    const p = aplicar(fuera, { t: 'entrar', sala: 's1-cooperativa' });
    expect(aplicar(p, { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 1 })).toBe(p);
    const q = aplicar(p, { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 });
    expect(etapaActual(q, 's1-cooperativa')).toBe(1);
    // Repetir la misma etapa no cuenta dos veces.
    expect(aplicar(q, { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 })).toBe(q);
  });

  it('resolver las tres etapas resuelve la sala y abre la siguiente', () => {
    const p = varias(crearPartida(), resolverSala('s1-cooperativa'));
    expect(etapaActual(p, 's1-cooperativa')).toBeNull();
    expect(salasResueltas(p)).toEqual(['s1-cooperativa']);
    expect(salaAbierta(p, 's2-laboratorio')).toBe(true);
    expect(salaAbierta(p, 's3-gimnasio')).toBe(false);
  });

  it('una sala resuelta sigue abierta para volver a buscar grabaciones', () => {
    const p = varias(crearPartida(), [
      ...resolverSala('s1-cooperativa'),
      { t: 'entrar', sala: 's1-cooperativa' },
    ]);
    expect(p.lugar).toBe('s1-cooperativa');
    expect(aplicar(p, { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 3 })).toBe(p);
  });

  it('el recorrido completo resuelve las cinco salas en orden', () => {
    const p = varias(crearPartida(), SALAS.flatMap(resolverSala));
    expect(salasResueltas(p)).toEqual([...SALAS]);
    expect(p.lugar).toBe('porteria');
  });

  it('al terminar, la partida queda en el final y ya no acepta acciones', () => {
    const p = aplicar(crearPartida(), { t: 'terminar', final: 'pedir_ayuda' });
    expect(p.fase).toBe('final');
    expect(p.final).toBe('pedir_ayuda');
    expect(aplicar(p, { t: 'entrar', sala: 's1-cooperativa' })).toBe(p);
    expect(aplicar(p, { t: 'terminar', final: 'tiempo_cumplido' })).toBe(p);
  });

  it('no modifica el estado que recibe', () => {
    const p = crearPartida();
    const copia = structuredClone(p);
    varias(p, resolverSala('s1-cooperativa'));
    expect(p).toEqual(copia);
  });

  it('ignora acciones con datos fuera de la lista (por ejemplo, de la red)', () => {
    const p = crearPartida();
    expect(aplicar(p, { t: 'entrar', sala: 'sotano' as SalaId })).toBe(p);
    expect(aplicar(p, { t: 'terminar', final: 'ganar' as never })).toBe(p);
  });

  it('convierte entre número e id de sala', () => {
    expect(numeroDeSala('s3-gimnasio')).toBe(3);
    expect(salaPorNumero(5)).toBe('s5-rectoria');
    expect(salaPorNumero(6)).toBeUndefined();
  });
});
