import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/content/esquema';
import { PUZZLES, puzzleDeSala } from '../../src/content/puzzles';
import { SALAS_3D } from '../../src/content/salas';
import {
  alCambiarEstado,
  avanzarReposo,
  MS_MIRAR,
  msParaReposo,
  estadoFallido,
  intentoAlAccionar,
  reglaDeIntento,
  REPOSO_INICIAL,
  type Reposo,
} from '../../src/game/intentos';
import { PISTAS_INICIALES, registrarIntento } from '../../src/game/pistas';
import { duracionCorridaS } from '../../src/game/puzzles';

const puzzle = (sala: number): Puzzle => {
  const p = puzzleDeSala(sala);
  if (!p) throw new Error(`Falta el puzzle de la sala ${sala}`);
  return p;
};
const s1 = puzzle(1);
const s2 = puzzle(2);
const s3 = puzzle(3);
const s4 = puzzle(4);
const s5 = puzzle(5);
const SEG = 1000;

describe('qué cuenta como intento en cada sala (T27b)', () => {
  it('cada etapa tiene la regla acordada', () => {
    const reglas = PUZZLES.map((p) =>
      p.etapas.map((e) => (e.intento.tipo === 'accionar' ? e.intento.objeto : 'reposo')),
    );
    expect(reglas).toEqual([
      ['s1-palanca', 's1-palanca', 's1-palanca'],
      ['s2-palanca-1', 's2-palanca-2', 's2-palanca-3'],
      ['reposo', 'reposo', 's3-polea'],
      ['reposo', 'reposo', 'reposo'],
      ['s5-caja-fuerte', 's5-caja-fuerte', 's5-caja-fuerte'],
    ]);
    expect(reglaDeIntento(s1, 3)).toBeNull();
  });

  it('los objetos que se accionan existen en las salas 3D', () => {
    const objetos = JSON.stringify(SALAS_3D);
    for (const p of PUZZLES) {
      for (const e of p.etapas) {
        if (e.intento.tipo === 'accionar') expect(objetos).toContain(`"${e.intento.objeto}"`);
      }
    }
  });

  it('sala 1: bajar la palanca sin dar el precio de la pizarra es un intento', () => {
    const falla = { producto: 'jugo', precio: 2000, rodillos: [20] };
    expect(intentoAlAccionar(s1, 0, 's1-palanca', falla)).toBe(true);
    // Sin rodillos la máquina imprime el mismo precio: también informa, también cuenta.
    expect(intentoAlAccionar(s1, 0, 's1-palanca', s1.etapas[0]?.estado_inicial)).toBe(true);
    expect(intentoAlAccionar(s1, 0, 's1-palanca', s1.etapas[0]?.solucion)).toBe(false);
    expect(intentoAlAccionar(s1, 0, 's1-caja-rodillos', falla)).toBe(false);
    expect(intentoAlAccionar(s1, 0, 's1-palanca', { rodillos: 'x' })).toBe(false);
  });

  it('sala 2: cada corrida que no resuelve su estación es un intento', () => {
    const e = s2.etapas[1];
    expect(intentoAlAccionar(s2, 1, 's2-palanca-2', e?.estado_inicial)).toBe(true);
    expect(intentoAlAccionar(s2, 1, 's2-palanca-2', e?.solucion)).toBe(false);
    // La palanca de otra estación no es la de esta etapa.
    expect(intentoAlAccionar(s2, 1, 's2-palanca-1', e?.estado_inicial)).toBe(false);
    expect(intentoAlAccionar(s2, 1, 's2-tablero-2', e?.estado_inicial)).toBe(false);
  });

  it('sala 3: sensores en vivo por reposo; en la última etapa, soltar la polea', () => {
    const inicial = s3.etapas[0]?.estado_inicial;
    expect(intentoAlAccionar(s3, 0, 's3-polea', inicial)).toBe(false);
    expect(avanzarReposo(s3, 0, inicial, alCambiarEstado(), 5 * SEG).intento).toBe(true);

    const polea = s3.etapas[2]?.estado_inicial;
    expect(intentoAlAccionar(s3, 2, 's3-polea', polea)).toBe(true);
    expect(intentoAlAccionar(s3, 2, 's3-polea', s3.etapas[2]?.solucion)).toBe(false);
    expect(avanzarReposo(s3, 2, polea, alCambiarEstado(), 60 * SEG).intento).toBe(false);
  });

  it('sala 5: tirar de la manija con una urna que no cumple es un intento', () => {
    expect(intentoAlAccionar(s5, 1, 's5-caja-fuerte', { azules: 2, amarillas: 2 })).toBe(true);
    expect(intentoAlAccionar(s5, 1, 's5-caja-fuerte', { azules: 3, amarillas: 1 })).toBe(false);
    expect(intentoAlAccionar(s5, 1, 's5-simulador', { azules: 2, amarillas: 2 })).toBe(false);
  });
});

describe('sala 4: lámparas en vivo, intento por reposo (T27b)', () => {
  const completo = { carritos: [4, 4, 4, 4, 4] };
  const avanzar = (r: Reposo, estado: unknown, ms: number) => avanzarReposo(s4, 1, estado, r, ms);

  it('cuenta una vez cuando el reparto completo se queda quieto 3 s sin resolver', () => {
    let r = avanzar(alCambiarEstado(), completo, MS_MIRAR - 1);
    expect(r.intento).toBe(false);
    r = avanzar(r.reposo, completo, 1);
    expect(r.intento).toBe(true);
    // Sigue pendiente hasta los 5 s de la regla, cuando se revisa si resuelve.
    expect(r.reposo.pendiente).toBe(true);
    r = avanzar(r.reposo, completo, 5 * SEG - MS_MIRAR);
    expect(r.intento).toBe(false);
    expect(r.reposo.pendiente).toBe(false);
    r = avanzar(r.reposo, completo, 60 * SEG);
    expect(r.intento).toBe(false);
  });

  it('de golpe, más de 5 s quieta también cuenta una sola vez', () => {
    const r = avanzar(alCambiarEstado(), completo, 60 * SEG);
    expect(r.intento).toBe(true);
    expect(r.reposo).toEqual({ msQuieto: 60 * SEG, pendiente: false, mirado: true });
  });

  it('un cambio reinicia la cuenta', () => {
    const r = avanzar(alCambiarEstado(), completo, 2 * SEG);
    expect(r.reposo.msQuieto).toBe(2 * SEG);
    const otro = { carritos: [3, 5, 4, 4, 4] };
    const tras = avanzar(alCambiarEstado(), otro, 2 * SEG);
    expect(tras.intento).toBe(false);
    expect(avanzar(tras.reposo, otro, 1 * SEG).intento).toBe(true);
  });

  it('dice cuánto falta para mirar y para revisar', () => {
    expect(msParaReposo(s4, 1, REPOSO_INICIAL)).toBeNull();
    expect(msParaReposo(s4, 1, alCambiarEstado())).toBe(MS_MIRAR);
    const mirado = avanzar(alCambiarEstado(), completo, MS_MIRAR).reposo;
    expect(msParaReposo(s4, 1, mirado)).toBe(5 * SEG - MS_MIRAR);
    // Las etapas que se accionan no esperan reposo.
    expect(msParaReposo(s1, 0, alCambiarEstado())).toBeNull();
  });

  it('no cuenta sin cambios, con libros en la pila, resuelto ni con un estado inválido', () => {
    expect(avanzar(REPOSO_INICIAL, completo, 60 * SEG).intento).toBe(false);
    expect(avanzar(alCambiarEstado(), { carritos: [4, 4, 4, 4, 3] }, 5 * SEG).intento).toBe(false);
    expect(avanzar(alCambiarEstado(), s4.etapas[1]?.solucion, 5 * SEG).intento).toBe(false);
    expect(avanzar(alCambiarEstado(), { carritos: [20] }, 5 * SEG).intento).toBe(false);
    expect(avanzar(alCambiarEstado(), completo, Number.NaN).intento).toBe(false);
    expect(estadoFallido(s4, 1, { carritos: [4, 4, 4, 4, 3] })).toBe(false);
  });

  it('tres repartos fallidos, mirados 3 s cada uno, ofrecen la primera pista', () => {
    let pistas = PISTAS_INICIALES;
    const repartos = [
      [5, 3, 4, 4, 4],
      [6, 2, 4, 4, 4],
      [7, 1, 4, 4, 4],
    ];
    for (const carritos of repartos) {
      if (avanzar(alCambiarEstado(), { carritos }, MS_MIRAR).intento) {
        pistas = registrarIntento(pistas, s4.pistas);
      }
    }
    expect(pistas.ofrecidas).toBe(1);
  });
});

describe('sala 2: la corrida dura hasta la campana (T27b)', () => {
  it('la duración de cada corrida es el segundo de la campana: 10, 8 y 12 s', () => {
    if (s2.mecanismo !== 'tanques') throw new Error('La sala 2 debe ser la de los tanques');
    expect(s2.etapas.map(duracionCorridaS)).toEqual([10, 8, 12]);
  });
});
