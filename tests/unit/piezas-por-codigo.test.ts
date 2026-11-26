import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import type { BufferGeometry, Mesh, MeshLambertMaterial } from 'three';
import { Piezas, sumarAFija, vestirMalla } from '../../src/engine/mecanismos/piezas-por-codigo';
import { carasAlReves, normalesSanas } from './geometria-sana';

// Pulir salas (sesión A): las piezas por código salen en una sola geometría, con las caras
// mirando hacia afuera y sin pasarse de su tamaño.

const caja = (g: BufferGeometry): Box3 =>
  new Box3().setFromBufferAttribute(g.getAttribute('position') as never);

describe('Piezas', () => {
  it('una caja biselada son 44 triángulos planos; sin bisel, 12', () => {
    const con = new Piezas().caja([1, 0.5, 0.2], '#ff0000', { bisel: 0.03 });
    const sin = new Piezas().caja([1, 0.5, 0.2], '#ff0000');
    expect(con.triangulos).toBe(44);
    expect(sin.triangulos).toBe(12);
    for (const p of [con, sin]) {
      const g = p.geometria();
      expect(carasAlReves(g)).toBe(0);
      expect(normalesSanas(g)).toBe(true);
      const b = caja(g);
      expect(b.min.toArray().map((x) => Math.round(x * 1000) / 1000)).toEqual([-0.5, -0.25, -0.1]);
      expect(b.max.toArray().map((x) => Math.round(x * 1000) / 1000)).toEqual([0.5, 0.25, 0.1]);
    }
  });

  it('torno, cilindro, esfera, toro y barra miran hacia afuera', () => {
    const p = new Piezas()
      .cilindro(0.2, 1, '#00ff00', { bisel: 0.02 })
      .esfera(0.3, '#0000ff', { pos: [2, 0, 0] })
      .toro(0.3, 0.05, '#ffffff', { pos: [-2, 0, 0], giro: [90, 0, 0], desde: 90, arco: 180 })
      .barra([0, 0, 2], [1, 1, 3], 0.05, '#888888')
      .torno(
        [
          [0, 0],
          [0.04, 0],
          [0.045, 0.1],
          [0.04, 0.1],
          [0.04, 0.07],
          [0, 0.07],
        ],
        '#ffffff',
        { pos: [0, 0, -2] },
      );
    const g = p.geometria();
    expect(carasAlReves(g)).toBe(0);
    expect(normalesSanas(g)).toBe(true);
  });

  it('`en` coloca un grupo de piezas y una escala negativa no da vuelta las caras', () => {
    const p = new Piezas();
    p.en({ pos: [1, 2, 3], giro: [0, 90, 0] }, () =>
      p.caja([0.2, 0.2, 0.4], '#ffffff', { bisel: 0.02 }),
    );
    p.caja([0.2, 0.2, 0.2], '#ffffff', { pos: [0, 0, 0], escala: [-1, 1, 1], bisel: 0.02 });
    const g = p.geometria();
    expect(carasAlReves(g)).toBe(0);
    const b = caja(g);
    // Girada 90°, la caja de 0,4 de fondo queda a lo ancho en x.
    expect(b.max.x).toBeCloseTo(1.2, 5);
  });

  it('cada vértice lleva el color de su pieza en el espacio lineal', () => {
    const g = new Piezas().caja([1, 1, 1], '#ffffff').caja([1, 1, 1], '#000000').geometria();
    const color = g.getAttribute('color');
    expect(color.getX(0)).toBeCloseTo(1);
    expect(color.getX(color.count - 1)).toBeCloseTo(0);
  });
});

describe('sumarAFija y vestirMalla', () => {
  it('suman a la malla fija una sola vez y visten una malla sin cambiar su nombre', async () => {
    const { construirSala } = await import('../../src/engine/salas/construir');
    const { salaPorId } = await import('../../src/content/salas');
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const fija = raiz.getObjectByName('fija') as Mesh;
    // Sin índice, la malla fija tiene un vértice por cada esquina de triángulo.
    const antes = fija.geometry.index?.count ?? fija.geometry.getAttribute('position').count;
    const piezas = new Piezas().caja([1, 1, 1], '#ffffff', { bisel: 0.1 });
    sumarAFija(raiz, 'prueba', piezas);
    sumarAFija(raiz, 'prueba', piezas);
    const despues = raiz.getObjectByName('fija') as Mesh;
    expect(despues.geometry.index).toBeNull();
    expect(despues.geometry.getAttribute('position').count).toBe(antes + 44 * 3);
    expect(Object.keys(despues.geometry.attributes).sort()).toEqual([
      'color',
      'normal',
      'position',
    ]);

    const palanca = raiz.getObjectByName('s2-palanca-1') as Mesh;
    const material = palanca.material as MeshLambertMaterial;
    expect(vestirMalla(palanca, new Piezas().caja([0.1, 0.1, 0.1], '#ff0000'))).toBe(palanca);
    expect(palanca.name).toBe('s2-palanca-1');
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    // Dos veces no la vuelve a vestir.
    expect(vestirMalla(palanca, new Piezas().caja([1, 1, 1], '#ff0000'))).toBeNull();
  });
});
