import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esquemaPuzzle } from '../../src/content/esquema';
import { PUZZLES, puzzleDeSala } from '../../src/content/puzzles';

const carpeta = new URL('../../src/content/puzzles/', import.meta.url);
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.json'));

describe('los cinco puzzles (T22)', () => {
  it('hay un JSON por sala', () => {
    expect(archivos.sort()).toEqual([
      's1-etiquetadora.json',
      's2-tanques.json',
      's3-reflector.json',
      's4-carritos.json',
      's5-urna.json',
    ]);
  });

  it.each(archivos)('%s cumple el esquema y su id coincide con el nombre', (archivo) => {
    const datos: unknown = JSON.parse(readFileSync(new URL(archivo, carpeta), 'utf8'));
    const r = esquemaPuzzle.safeParse(datos);
    expect(r.success ? [] : r.error.issues).toEqual([]);
    expect((datos as { id: string }).id).toBe(archivo.replace('.json', ''));
  });

  it('el índice del juego trae los cinco en orden de sala', () => {
    expect(PUZZLES.map((p) => p.sala)).toEqual([1, 2, 3, 4, 5]);
    expect(puzzleDeSala(3)?.mecanismo).toBe('reflector');
    expect(puzzleDeSala(6)).toBeUndefined();
  });

  it('ningún texto menciona el ICFES ni el Saber 11', () => {
    for (const p of PUZZLES) expect(JSON.stringify(p)).not.toMatch(/icfes|saber\s*11/i);
  });

  it('los números usan formato de Colombia: $ con punto de miles y coma decimal', () => {
    for (const p of PUZZLES) {
      const textos = JSON.stringify(p);
      expect(textos).not.toMatch(/\$\d{4,}/);
      expect(textos).not.toMatch(/\d\.\d{1,2}(?!\d)/);
    }
  });
});
