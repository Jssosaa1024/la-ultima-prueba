import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/content/esquema';
import { PUZZLES, puzzleDeSala } from '../../src/content/puzzles';
import { RESPUESTAS } from '../../src/content/respuestas';
import { esEstadoValido, evaluar } from '../../src/game/puzzles';
import { estadosPosibles } from '../../src/game/puzzles/estados';
import {
  ALGORITMO,
  canonico,
  estaResuelta,
  generarRespuestas,
  hashDeEstado,
  LARGO_HASH,
  type Respuestas,
} from '../../src/game/respuestas';
import { sha256 } from '../../src/game/sha256';
import { serializarRespuestas } from '../../scripts/respuestas/serializar.ts';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const ARCHIVO = path.join(RAIZ, 'src', 'content', 'respuestas.json');

const puzzle = (sala: number): Puzzle => {
  const p = puzzleDeSala(sala);
  if (!p) throw new Error(`Falta el puzzle de la sala ${sala}`);
  return p;
};
const cuenta = (p: Puzzle, etapa: number): number => [...estadosPosibles(p, etapa)].length;

describe('sha256 propio (T23)', () => {
  it.each([
    '',
    'abc',
    'La Última Prueba · 0,75 · $1.600 · 24 m²',
    'ficha 🟦 y ficha 🔺',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(1000),
  ])('da lo mismo que node:crypto (%#)', (texto) => {
    expect(sha256(texto)).toBe(createHash('sha256').update(texto, 'utf8').digest('hex'));
  });
});

describe('todos los estados de una etapa (T23)', () => {
  it('recorre el espacio completo de cada máquina', () => {
    // 1 sin rodillos + 5 de uno + 5 × 4 de dos, en cualquier orden.
    expect([0, 1, 2].map((i) => cuenta(puzzle(1), i))).toEqual([26, 26, 26]);
    // Perilla A de 0 a 6.
    expect([0, 1, 2].map((i) => cuenta(puzzle(2), i))).toEqual([7, 7, 7]);
    // 5 muescas; 5 muescas × 10 posiciones del poste; 5 muescas × 9 largos de polea.
    expect([0, 1, 2].map((i) => cuenta(puzzle(3), i))).toEqual([5, 50, 45]);
    // Repartos de hasta 20 libros en 5 carritos: C(25, 5).
    expect(cuenta(puzzle(4), 0)).toBe(53130);
    // De 0 a 10 fichas de cada color.
    expect(cuenta(puzzle(5), 0)).toBe(121);
    expect(cuenta(puzzle(5), 7)).toBe(0);
  });

  it.each(PUZZLES.map((p) => [p.id, p] as const))(
    '%s: todos son válidos, sin repetidos, e incluyen el inicial y la solución',
    (_, p) => {
      p.etapas.forEach((e, i) => {
        const estados = [...estadosPosibles(p, i)];
        const textos = new Set(estados.map((x) => JSON.stringify(x)));
        expect(textos.size).toBe(estados.length);
        expect(estados.every((x) => esEstadoValido(p, i, x))).toBe(true);
        expect(textos.has(JSON.stringify(e.estado_inicial))).toBe(true);
        expect(textos.has(JSON.stringify(e.solucion))).toBe(true);
      });
    },
  );
});

describe('hash del estado resuelto (T23)', () => {
  it('la forma canónica no depende del orden de rodillos, días ni claves', () => {
    const a = { producto: 'combo', precio: 4000, rodillos: [-50, 50] };
    const b = { rodillos: [50, -50], precio: 4000, producto: 'combo' };
    expect(canonico('etiquetadora', a)).toBe(canonico('etiquetadora', b));
    expect(canonico('carritos', { carritos: [9, 2, 4, 2, 3] })).toBe(
      canonico('carritos', { carritos: [2, 2, 3, 4, 9] }),
    );
    expect(canonico('urna', { azules: 3, amarillas: 1 })).not.toBe(
      canonico('urna', { azules: 1, amarillas: 3 }),
    );
  });

  it('el puzzle, su versión y la etapa van dentro del hash', () => {
    const s4 = puzzle(4);
    const estado = { carritos: [4, 4, 4, 4, 4] };
    const h = hashDeEstado(s4, 0, estado);
    expect(h).toMatch(new RegExp(`^[0-9a-f]{${LARGO_HASH}}$`));
    expect(hashDeEstado(s4, 1, estado)).not.toBe(h);
    expect(hashDeEstado({ ...s4, version: s4.version + 1 }, 0, estado)).not.toBe(h);
    expect(hashDeEstado({ ...s4, id: 's4-otro' }, 0, estado)).not.toBe(h);
  });

  it('src/content/respuestas.json está al día con los puzzles', async () => {
    const generadas = generarRespuestas(PUZZLES);
    expect(RESPUESTAS).toEqual(generadas);
    const enDisco = readFileSync(ARCHIVO, 'utf8').replace(/\r\n/g, '\n');
    expect(enDisco).toBe(await serializarRespuestas(generadas));
  });

  it('cada etapa guarda las salidas del diseño', () => {
    const cuantas = (id: string) => RESPUESTAS.puzzles[id]?.etapas.map((h) => h.length);
    // Una sola salida por etapa (los dos órdenes de −50 y +50 son el mismo estado).
    expect(cuantas('s1-etiquetadora')).toEqual([1, 1, 1]);
    expect(cuantas('s2-tanques')).toEqual([1, 1, 1]);
    // La semana de las cuatro lámparas es única, salvo el orden de los días.
    expect(cuantas('s4-carritos')?.[2]).toBe(1);
    // 3 de un color; 3 y 1; 6 y 3 (con cualquiera de los dos colores).
    expect(cuantas('s5-urna')).toEqual([2, 2, 2]);
    expect(RESPUESTAS.algoritmo).toBe(ALGORITMO);
    // El archivo no trae estados ni soluciones en claro: solo hashes.
    const texto = JSON.stringify(RESPUESTAS);
    expect(texto).not.toMatch(/"carritos"|rodillos|azules|muesca|caudal/);
  });
});

describe('validador que compara hashes (T23)', () => {
  it.each(PUZZLES.map((p) => [p.id, p] as const))(
    '%s: coincide con las reglas en todos los estados de todas las etapas',
    (_, p) => {
      p.etapas.forEach((e, i) => {
        let distintos = 0;
        for (const estado of estadosPosibles(p, i)) {
          if (estaResuelta(RESPUESTAS, p, i, estado) !== evaluar(p, i, estado)?.resuelta) {
            distintos++;
          }
        }
        expect(distintos).toBe(0);
        expect(estaResuelta(RESPUESTAS, p, i, e.solucion)).toBe(true);
        expect(estaResuelta(RESPUESTAS, p, i, e.estado_inicial)).toBe(false);
      });
    },
  );

  it('no necesita la solución ni la condición de éxito del puzzle', () => {
    for (const p of PUZZLES) {
      const sinRespuestas = structuredClone(p) as Puzzle;
      for (const e of sinRespuestas.etapas as unknown as Record<string, unknown>[]) {
        delete e['solucion'];
        delete e['exito'];
      }
      p.etapas.forEach((e, i) => {
        expect(estaResuelta(RESPUESTAS, sinRespuestas, i, e.solucion)).toBe(true);
        expect(estaResuelta(RESPUESTAS, sinRespuestas, i, e.estado_inicial)).toBe(false);
      });
    }
  });

  it('acepta la solución en otro orden de días o de rodillos', () => {
    expect(estaResuelta(RESPUESTAS, puzzle(4), 2, { carritos: [9, 4, 3, 2, 2] })).toBe(true);
    const combo = puzzle(1).etapas[2]?.estado_inicial as object;
    expect(estaResuelta(RESPUESTAS, puzzle(1), 2, { ...combo, rodillos: [50, -50] })).toBe(true);
    expect(estaResuelta(RESPUESTAS, puzzle(1), 2, { ...combo, rodillos: [-50, 50] })).toBe(true);
    expect(estaResuelta(RESPUESTAS, puzzle(5), 1, { azules: 2, amarillas: 2 })).toBe(false);
  });

  it('devuelve null si no puede saber: estado inválido, etapa o versión que no son', () => {
    const s5 = puzzle(5);
    const bien = { azules: 3, amarillas: 1 };
    expect(estaResuelta(RESPUESTAS, s5, 1, { azules: 3 })).toBeNull();
    expect(estaResuelta(RESPUESTAS, s5, 1, { azules: 99, amarillas: 1 })).toBeNull();
    expect(estaResuelta(RESPUESTAS, s5, 1, 'x')).toBeNull();
    expect(estaResuelta(RESPUESTAS, s5, 3, bien)).toBeNull();
    expect(estaResuelta(RESPUESTAS, { ...s5, version: s5.version + 1 }, 1, bien)).toBeNull();
    expect(estaResuelta(RESPUESTAS, { ...s5, id: 's5-otra' }, 1, bien)).toBeNull();
    expect(estaResuelta(RESPUESTAS, { ...s5, id: '__proto__' }, 1, bien)).toBeNull();
    const otro: Respuestas = { ...RESPUESTAS, algoritmo: 'md5' };
    expect(estaResuelta(otro, s5, 1, bien)).toBeNull();
  });
});

describe('script hash-answers (T23)', () => {
  const correr = (...args: string[]): string =>
    execFileSync(process.execPath, [path.join('scripts', 'hash-answers.ts'), ...args], {
      cwd: RAIZ,
      encoding: 'utf8',
      stdio: 'pipe',
    });

  it('--comprobar pasa con el archivo del repositorio', () => {
    expect(correr('--comprobar')).toMatch(/está al día/);
  });

  it('escribe el mismo archivo y --comprobar falla si quedó viejo', () => {
    const carpeta = mkdtempSync(path.join(tmpdir(), 'hash-answers-'));
    try {
      const salida = path.join(carpeta, 'respuestas.json');
      expect(correr('--salida', salida)).toMatch(/s4-carritos v1/);
      expect(readFileSync(salida, 'utf8')).toBe(
        readFileSync(ARCHIVO, 'utf8').replace(/\r\n/g, '\n'),
      );
      expect(() => correr('--comprobar', '--salida', path.join(carpeta, 'no-existe.json'))).toThrow(
        /quedó viejo/,
      );
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});
