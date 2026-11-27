import { describe, expect, it } from 'vitest';
import { esquemaPrueba } from '../../src/content/esquema-expediente';
import { EXPEDIENTE, pruebasConSello } from '../../src/content/expediente';
import fichas from '../../src/content/fichas.json';
import { GRABACIONES_ESCONDIDAS } from '../../src/content/grabaciones';
import { GUION } from '../../src/content/guion';
import puertas from '../../src/content/puertas-falsas.json';
import { SALAS } from '../../src/game/partida';

// Historia B: el caso de Don Efraín (docs/historia.md). Cada sello trae una prueba de 1991.

describe('expediente 1991', () => {
  it('cada prueba cumple el esquema', () => {
    for (const p of EXPEDIENTE) {
      const r = esquemaPrueba.safeParse(p);
      expect(r.success, `${p.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it('hay una prueba por sala, numeradas en el orden de las salas', () => {
    expect(EXPEDIENTE.map((p) => p.id)).toEqual([...SALAS]);
    expect(EXPEDIENTE.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5]);
  });

  it('cada fila de una tabla tiene tantas celdas como columnas', () => {
    for (const p of EXPEDIENTE) {
      for (const b of p.bloques) {
        if (b.tipo !== 'tabla') continue;
        for (const fila of b.filas)
          expect(fila, `${p.id} · ${b.titulo}`).toHaveLength(b.columnas.length);
      }
    }
  });

  it('una prueba llega solo con el sello de su sala', () => {
    expect(pruebasConSello({})).toEqual([]);
    expect(pruebasConSello({ 's1-cooperativa': 2 })).toEqual([]);
    const dos = pruebasConSello({ 's2-laboratorio': 3, 's1-cooperativa': 3, 's3-gimnasio': 1 });
    expect(dos.map((p) => p.titulo)).toEqual(['El recibo', 'La bitácora']);
    const todas = Object.fromEntries(SALAS.map((s) => [s, 3]));
    expect(pruebasConSello(todas)).toHaveLength(5);
  });
});

describe('el giro no se adelanta', () => {
  const nombre = /Efra[íi]n|C[áa]rdenas/;

  it('el expediente nombra al estudiante solo como «E. C., 10-B»', () => {
    const texto = JSON.stringify(EXPEDIENTE);
    expect(texto).not.toMatch(nombre);
    expect(texto).toContain('E. C., 10-B');
  });

  it('La Voz no dice su nombre antes de un final', () => {
    for (const l of GUION.filter((x) => x.momento !== 'final')) {
      expect(l.texto, l.id).not.toMatch(nombre);
    }
    for (const g of GRABACIONES_ESCONDIDAS) expect(g.texto, g.id).not.toMatch(nombre);
  });

  it('en el colegio, «Don Efraín» es solo el celador del casillero; el apellido no aparece', () => {
    expect(JSON.stringify(puertas)).not.toMatch(nombre);
    const conNombre = fichas.filter((f) => nombre.test(JSON.stringify(f))).map((f) => f.id);
    expect(conNombre).toEqual(['porteria-casillero']);
    expect(JSON.stringify(fichas)).not.toMatch(/C[áa]rdenas/);
  });

  it('el final bueno sí lo dice', () => {
    const legado = GUION.find((l) => l.final === 'el_legado');
    expect(legado?.texto).toMatch(/Efraín/);
  });
});
