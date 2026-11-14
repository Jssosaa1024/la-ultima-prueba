import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../../src/content/puzzles';
import { SALAS_3D } from '../../src/content/salas';
import type { Sala } from '../../src/content/esquema-salas';

/**
 * T19c · Los ids de los objetos son los mismos en todas las capas.
 *
 * La fuente de verdad es `src/content/salas.json`. Un puzzle solo puede nombrar objetos que
 * existan en su sala, y el código del juego solo puede nombrar objetos que existan.
 */

/** Forma de un id de objeto: prefijo de la sala (o `porteria`) y un nombre en minúsculas. */
const ID_OBJETO = /^(?:s[1-5]|porteria)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Todas las cadenas de un JSON, con la ruta donde aparecen. */
function cadenas(valor: unknown, ruta = ''): { ruta: string; texto: string }[] {
  if (typeof valor === 'string') return [{ ruta, texto: valor }];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => cadenas(v, `${ruta}[${i}]`));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => cadenas(v, ruta ? `${ruta}.${k}` : k));
  }
  return [];
}

interface PuzzleConIds {
  id: string;
  sala: number;
}

/**
 * Objetos que el puzzle nombra y que no están en su sala. Revisa cualquier campo del JSON
 * con forma de id de objeto, no solo `pista_por_jugador`; el `id` del propio puzzle no cuenta.
 */
function objetosQueFaltan(puzzle: PuzzleConIds, salas: readonly Sala[]): string[] {
  const sala = salas.find((s) => s.id.startsWith(`s${puzzle.sala}-`));
  const enSala = new Set(sala?.objetos.map((o) => o.id));
  return cadenas(puzzle)
    .filter(({ ruta, texto }) => ruta !== 'id' && ID_OBJETO.test(texto) && !enSala.has(texto))
    .map(({ ruta, texto }) => `${puzzle.id} · ${ruta}: «${texto}» no existe en ${sala?.id}`);
}

describe('ids de objetos: puzzles contra salas.json (T19c)', () => {
  it('cada objeto que nombra un puzzle existe en su sala', () => {
    expect(PUZZLES).toHaveLength(5);
    expect(PUZZLES.flatMap((p) => objetosQueFaltan(p, SALAS_3D))).toEqual([]);
  });

  it('cada puzzle nombra al menos los cuatro objetos de los roles A a D', () => {
    for (const puzzle of PUZZLES) {
      const nombrados = cadenas(puzzle).filter(
        ({ ruta, texto }) => ruta !== 'id' && ID_OBJETO.test(texto),
      );
      expect(nombrados.length, puzzle.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('falla si un puzzle nombra un objeto del diseño viejo o de otra sala', () => {
    const s1 = PUZZLES[0];
    if (!s1) throw new Error('falta el puzzle de la sala 1');
    const viejo = structuredClone(s1) as unknown as PuzzleConIds & {
      pista_por_jugador: Record<string, { objeto: string }>;
    };
    const a = viejo.pista_por_jugador['A'];
    const b = viejo.pista_por_jugador['B'];
    if (!a || !b) throw new Error('faltan los roles A y B');
    a.objeto = 's1-factura'; // diseño viejo: no existe
    b.objeto = 's2-palanca'; // existe, pero en otra sala
    expect(objetosQueFaltan(viejo, SALAS_3D)).toEqual([
      's1-etiquetadora · pista_por_jugador.A.objeto: «s1-factura» no existe en s1-cooperativa',
      's1-etiquetadora · pista_por_jugador.B.objeto: «s2-palanca» no existe en s1-cooperativa',
    ]);
  });
});

describe('ids de objetos: código del juego contra salas.json (T19c)', () => {
  /**
   * Archivos que todavía usan ids del diseño viejo (`s1-factura`, `s1-menu`, `s1-tarjeta`).
   * Son de la sesión de interfaz, que los está reemplazando: cuando se borren, esta lista
   * debe quedar vacía.
   */
  const PENDIENTES = new Set(['src/signals/ejemplo.ts', 'src/signals/provisional.ts']);

  const conocidos = new Set<string>([
    ...SALAS_3D.map((s) => s.id),
    ...SALAS_3D.flatMap((s) => s.objetos.map((o) => o.id)),
    ...PUZZLES.map((p) => p.id),
  ]);

  function archivosDeCodigo(carpeta: string): string[] {
    return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
      const ruta = `${carpeta}/${e.name}`;
      if (e.isDirectory()) return archivosDeCodigo(ruta);
      return /\.(?:ts|tsx|astro)$/.test(e.name) ? [ruta] : [];
    });
  }

  it('ningún archivo de src/ nombra entre comillas un objeto que no existe', () => {
    const raiz = join(import.meta.dirname, '../..');
    const literal = /(['"`])((?:s[1-5]|porteria)-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g;
    const desconocidos: string[] = [];
    for (const archivo of archivosDeCodigo('src')) {
      if (PENDIENTES.has(archivo)) continue;
      const texto = readFileSync(join(raiz, archivo), 'utf8');
      for (const m of texto.matchAll(literal)) {
        const id = m[2];
        if (id && !conocidos.has(id)) desconocidos.push(`${archivo}: «${id}»`);
      }
    }
    expect(desconocidos).toEqual([]);
  });
});
