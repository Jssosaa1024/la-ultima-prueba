import { describe, expect, it } from 'vitest';
import {
  aplicar,
  crearPartida,
  GRABACION_EN_SALA,
  opcionesDeFinal,
  SALAS,
  sellos,
  type Accion,
  type GrabacionId,
  type Partida,
  type SalaId,
} from '../../src/game/partida';

const varias = (p: Partida, acciones: Accion[]): Partida => acciones.reduce(aplicar, p);

/** Entra, resuelve las tres etapas, recoge las grabaciones pedidas y vuelve a la portería. */
const resolverSala = (sala: SalaId, recoger: GrabacionId[] = []): Accion[] => [
  { t: 'entrar', sala },
  { t: 'resolver_etapa', sala, etapa: 0 },
  { t: 'resolver_etapa', sala, etapa: 1 },
  { t: 'resolver_etapa', sala, etapa: 2 },
  ...recoger.map((grabacion): Accion => ({ t: 'recoger_grabacion', grabacion })),
  { t: 'volver_porteria' },
];

const cincoSellos = (conGrabaciones: boolean): Partida =>
  varias(
    crearPartida(),
    SALAS.flatMap((s) =>
      resolverSala(
        s,
        conGrabaciones
          ? (Object.entries(GRABACION_EN_SALA) as [GrabacionId, SalaId][])
              .filter(([, sala]) => sala === s)
              .map(([g]) => g)
          : [],
      ),
    ),
  );

describe('sellos (T28)', () => {
  it('cada sala resuelta entrega su sello, en orden', () => {
    const p = varias(crearPartida(), [
      ...resolverSala('s1-cooperativa'),
      ...resolverSala('s2-laboratorio'),
    ]);
    expect(sellos(p)).toEqual(['s1-cooperativa', 's2-laboratorio']);
  });
});

describe('grabaciones (T28)', () => {
  it('cada grabación se recoge solo dentro de su sala y una vez', () => {
    let p = varias(crearPartida(), [
      ...resolverSala('s1-cooperativa'),
      { t: 'entrar', sala: 's2-laboratorio' },
    ]);
    expect(aplicar(p, { t: 'recoger_grabacion', grabacion: 'g2' })).toBe(p);
    p = aplicar(p, { t: 'recoger_grabacion', grabacion: 'g1' });
    expect(p.grabaciones).toEqual(['g1']);
    expect(aplicar(p, { t: 'recoger_grabacion', grabacion: 'g1' })).toBe(p);
  });

  it('se puede volver a una sala resuelta a buscar su grabación', () => {
    const p = varias(crearPartida(), [
      ...resolverSala('s1-cooperativa'),
      ...resolverSala('s2-laboratorio'),
      { t: 'entrar', sala: 's2-laboratorio' },
      { t: 'recoger_grabacion', grabacion: 'g1' },
    ]);
    expect(p.grabaciones).toEqual(['g1']);
  });

  it('las grabaciones están en las salas 2, 3 y 4', () => {
    expect(GRABACION_EN_SALA).toEqual({
      g1: 's2-laboratorio',
      g2: 's3-gimnasio',
      g3: 's4-biblioteca',
    });
  });
});

describe('los cuatro finales (T28)', () => {
  it('«Justo a tiempo»: cinco sellos y elegir salir en la portería', () => {
    const p = aplicar(cincoSellos(false), { t: 'elegir_final', opcion: 'salir' });
    expect(p.fase).toBe('final');
    expect(p.final).toBe('justo_a_tiempo');
  });

  it('«El legado»: cinco sellos, tres grabaciones y elegir restaurar', () => {
    const p = aplicar(cincoSellos(true), { t: 'elegir_final', opcion: 'restaurar' });
    expect(p.final).toBe('el_legado');
  });

  it('«También vale pedir ayuda»: el intercomunicador, en cualquier momento', () => {
    const enSala = aplicar(crearPartida(), { t: 'entrar', sala: 's1-cooperativa' });
    const p = aplicar(enSala, { t: 'pedir_ayuda' });
    expect(p.final).toBe('pedir_ayuda');
  });

  it('«Tiempo cumplido»: el reloj llega a 00:40, aunque falten salas', () => {
    const p = aplicar(crearPartida(), { t: 'tiempo_agotado' });
    expect(p.final).toBe('tiempo_cumplido');
  });

  it('con cinco sellos y todas las grabaciones también se puede salir', () => {
    expect(aplicar(cincoSellos(true), { t: 'elegir_final', opcion: 'salir' }).final).toBe(
      'justo_a_tiempo',
    );
  });

  it('sin los cinco sellos no se elige final', () => {
    const p = varias(
      crearPartida(),
      SALAS.slice(0, 4).flatMap((s) => resolverSala(s)),
    );
    expect(aplicar(p, { t: 'elegir_final', opcion: 'salir' })).toBe(p);
  });

  it('el final se elige en la portería, no dentro de una sala', () => {
    const p = aplicar(cincoSellos(false), { t: 'entrar', sala: 's5-rectoria' });
    expect(aplicar(p, { t: 'elegir_final', opcion: 'salir' })).toBe(p);
  });

  it('«Restaurar» pide las tres grabaciones y dice cuántas faltan y dónde', () => {
    const p = varias(crearPartida(), [
      ...resolverSala('s1-cooperativa'),
      ...resolverSala('s2-laboratorio', ['g1']),
      ...SALAS.slice(2).flatMap((s) => resolverSala(s)),
    ]);
    expect(aplicar(p, { t: 'elegir_final', opcion: 'restaurar' })).toBe(p);
    expect(opcionesDeFinal(p)).toEqual({
      salir: true,
      restaurar: false,
      faltanGrabaciones: 2,
      salasConGrabacion: ['s3-gimnasio', 's4-biblioteca'],
    });
  });

  it('al principio no hay final disponible en la puerta', () => {
    expect(opcionesDeFinal(crearPartida())).toEqual({
      salir: false,
      restaurar: false,
      faltanGrabaciones: 3,
      salasConGrabacion: ['s2-laboratorio', 's3-gimnasio', 's4-biblioteca'],
    });
  });

  it('después del final no cambia nada', () => {
    const p = aplicar(crearPartida(), { t: 'pedir_ayuda' });
    expect(aplicar(p, { t: 'tiempo_agotado' })).toBe(p);
  });

  it('ignora grabaciones y opciones que no existen', () => {
    const p = cincoSellos(true);
    expect(aplicar(p, { t: 'recoger_grabacion', grabacion: 'g9' as GrabacionId })).toBe(p);
    expect(aplicar(p, { t: 'elegir_final', opcion: 'ganar' as 'salir' })).toBe(p);
  });
});
