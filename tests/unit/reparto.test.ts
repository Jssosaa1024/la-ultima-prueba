import { describe, expect, it } from 'vitest';
import { ROLES as ROLES_DEL_ESQUEMA } from '../../src/content/esquema';
import {
  gruposDeEncargos,
  repartir,
  repartirConectados,
  ROLES,
  rolesDe,
  tieneRol,
  type Reparto,
} from '../../src/game/reparto';

const J = ['j1', 'j2', 'j3', 'j4'] as const;
const SALAS = [1, 2, 3, 4, 5];

const de = (n: number, sala: number): Reparto => {
  const r = repartir(J.slice(0, n), sala);
  if (!r) throw new Error(`No hay reparto para ${n} jugadores en la sala ${sala}`);
  return r;
};
/** Encargos de cada jugador, como texto: «AB CD». */
const mesa = (n: number, sala: number): string =>
  J.slice(0, n)
    .map((j) => rolesDe(de(n, sala), j).join(''))
    .join(' ');

describe('reparto de encargos por número de jugadores (T29)', () => {
  it('usa los mismos roles que el esquema de puzzles', () => {
    expect([...ROLES]).toEqual([...ROLES_DEL_ESQUEMA]);
  });

  it('1 jugador: tiene los cuatro encargos en todas las salas', () => {
    for (const sala of SALAS) expect(mesa(1, sala)).toBe('ABCD');
  });

  it('en la sala 1 sigue la tabla del diseño', () => {
    expect(mesa(2, 1)).toBe('AB CD');
    expect(mesa(3, 1)).toBe('A BC D');
    expect(mesa(4, 1)).toBe('A B C D');
  });

  it.each([1, 2, 3, 4])('con %i jugadores, cada encargo tiene exactamente un dueño', (n) => {
    for (const sala of SALAS) {
      const r = de(n, sala);
      expect(Object.keys(r).sort()).toEqual([...ROLES]);
      const repartidos = J.slice(0, n).flatMap((j) => rolesDe(r, j));
      expect(repartidos.sort()).toEqual([...ROLES]);
      // Los grupos de la tabla no se parten: solo cambian de manos.
      const grupos = J.slice(0, n)
        .map((j) => rolesDe(r, j).join(''))
        .sort();
      expect(grupos).toEqual((gruposDeEncargos(n) ?? []).map((g) => g.join('')).sort());
    }
  });

  it('no hay reparto con 0 o más de 4 jugadores, ids repetidos o vacíos, ni salas que no existen', () => {
    expect(repartir([], 1)).toBeNull();
    expect(repartir(['a', 'b', 'c', 'd', 'e'], 1)).toBeNull();
    expect(repartir(['a', 'a'], 1)).toBeNull();
    expect(repartir(['a', ''], 1)).toBeNull();
    expect(repartir(['a', 7 as unknown as string], 1)).toBeNull();
    for (const sala of [0, 6, 1.5, Number.NaN]) expect(repartir(['a', 'b'], sala)).toBeNull();
    expect(gruposDeEncargos(5)).toBeNull();
  });
});

describe('rotación entre salas (T29)', () => {
  it('2 jugadores: se turnan los dos grupos sala por sala', () => {
    expect(SALAS.map((s) => mesa(2, s))).toEqual(['AB CD', 'CD AB', 'AB CD', 'CD AB', 'AB CD']);
  });

  it('3 jugadores: cada uno recibe el grupo que tenía el siguiente', () => {
    expect(SALAS.map((s) => mesa(3, s))).toEqual([
      'A BC D',
      'BC D A',
      'D A BC',
      'A BC D',
      'BC D A',
    ]);
  });

  it('4 jugadores: la sala 5 repite el reparto de la sala 1', () => {
    expect(SALAS.map((s) => mesa(4, s))).toEqual([
      'A B C D',
      'B C D A',
      'C D A B',
      'D A B C',
      'A B C D',
    ]);
  });

  it.each([2, 3, 4])('con %i jugadores, todos accionan la máquina (D) en alguna sala', (n) => {
    const conD = new Set(SALAS.map((s) => de(n, s).D));
    expect(conD.size).toBe(n);
    // Y nadie repite D en dos salas seguidas.
    for (const s of [1, 2, 3, 4]) expect(de(n, s).D).not.toBe(de(n, s + 1).D);
  });

  it('volver a una sala anterior devuelve el mismo reparto', () => {
    expect(repartir(['x', 'y', 'z'], 2)).toEqual(repartir(['x', 'y', 'z'], 2));
    expect(tieneRol(de(3, 2), 'j2', 'D')).toBe(true);
    expect(tieneRol(de(3, 2), 'j1', 'D')).toBe(false);
    expect(rolesDe(de(3, 2), 'nadie')).toEqual([]);
  });
});

describe('suplente de D cuando su dueño se desconecta (T29)', () => {
  it('con todos conectados es el reparto normal', () => {
    for (const sala of SALAS) {
      expect(repartirConectados(J, sala, J)).toEqual(repartir(J, sala));
    }
  });

  it('D pasa al siguiente jugador conectado; A, B y C no se mueven', () => {
    // Sala 1 con 4: D es j4. Si falta, sigue j1.
    expect(repartirConectados(J, 1, ['j1', 'j2', 'j3'])).toEqual({ ...de(4, 1), D: 'j1' });
    // Sala 2 con 4: D es j3. Si faltan j3 y j4, sigue j1.
    expect(repartirConectados(J, 2, ['j1', 'j2'])).toEqual({ ...de(4, 2), D: 'j1' });
    // Con 2 jugadores, el que queda acciona.
    expect(repartirConectados(['j1', 'j2'], 1, ['j1'])?.D).toBe('j1');
  });

  it('si falta otro jugador, D se queda donde estaba', () => {
    expect(repartirConectados(J, 1, ['j2', 'j3', 'j4'])).toEqual(de(4, 1));
  });

  it('al volver, el dueño recupera D', () => {
    expect(repartirConectados(J, 1, ['j1', 'j2', 'j3'])?.D).toBe('j1');
    expect(repartirConectados(J, 1, [...J])?.D).toBe('j4');
  });

  it('ignora conectados que no son de la partida y no reparte sin nadie conectado', () => {
    expect(repartirConectados(J, 1, ['intruso', 'j2'])?.D).toBe('j2');
    expect(repartirConectados(J, 1, [])).toBeNull();
    expect(repartirConectados(J, 1, ['intruso'])).toBeNull();
    expect(repartirConectados([], 1, [])).toBeNull();
  });
});
