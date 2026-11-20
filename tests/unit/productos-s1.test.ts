import { Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { ObjetoSala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { construirSala } from '../../src/engine/salas/construir';
import { interactivoDe } from '../../src/engine/interaccion/interaccion';
import { PIEZAS } from '../../src/engine/salas/piezas';
import { GROSOR_REPISA } from '../../src/engine/salas/piezas/s1';

// T19p: el jugo y el combo de la cooperativa son un modelo de Kenney Food Kit (`s1-productos`,
// el objeto que se examina) y la empanada y las etiquetas son una pieza aparte, unida a la malla
// fija (`s1-productos-detalle`). La malla fija no se toca: si el detalle asomara delante de las
// cajas de toque, tocar una etiqueta no abriría los productos. La repisa de exhibición va debajo
// de los productos: el detalle está `GROSOR_REPISA` más abajo.

const sala = salaPorId('s1-cooperativa');
function objeto(id: string): ObjetoSala {
  const o = sala.objetos.find((x) => x.id === id);
  if (!o) throw new Error(`falta ${id} en salas.json`);
  return o;
}
const productos = objeto('s1-productos');
const detalle = objeto('s1-productos-detalle');

describe('productos de la cooperativa (T19p)', () => {
  it('el detalle va bajo los productos, sin acción y con su pieza', () => {
    expect(productos.modelo).toBe('productos');
    expect(productos.pieza).toBeUndefined();
    const [x, y, z] = productos.pos;
    expect(detalle.pos[0]).toBe(x);
    expect(detalle.pos[1]).toBeCloseTo(y - GROSOR_REPISA, 6);
    expect(detalle.pos[2]).toBe(z);
    expect(detalle.tam).toEqual(productos.tam);
    expect(detalle.accion).toBeUndefined();
    expect(detalle.solido).toBeFalsy();
    expect(detalle.pieza).toBe('detalle-productos');
  });

  it('lo que asoma sobre la repisa queda dentro de alguna caja de toque de los productos', () => {
    const cajas = (productos.partes ?? []).map((p) => {
      expect(p.forma).toBe('caja');
      const [w, h, d] = p.tam;
      const [x] = p.pos;
      return { x0: x - w / 2, x1: x + w / 2, y1: h, z: d / 2 };
    });
    const crear = PIEZAS['detalle-productos'];
    if (!crear) throw new Error('falta la pieza detalle-productos');
    const g = crear(detalle).geometria;
    const pos = g.getAttribute('position');
    const v = new Vector3();
    const fuera: string[] = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Al marco de los productos; la repisa queda debajo de sus cajas y no se toca.
      v.y -= GROSOR_REPISA;
      if (v.y <= 1e-4) continue;
      const dentro = cajas.some(
        (c) => v.x >= c.x0 && v.x <= c.x1 && v.y >= -1e-6 && v.y <= c.y1 && Math.abs(v.z) <= c.z,
      );
      if (!dentro)
        fuera.push(
          v
            .toArray()
            .map((n) => n.toFixed(3))
            .join(', '),
        );
    }
    expect(fuera.slice(0, 5)).toEqual([]);
  });

  it('tocar cada etiqueta de frente abre los productos, no la malla fija', () => {
    const construida = construirSala(sala);
    construida.raiz.updateMatrixWorld(true);
    const [px, py, pz] = productos.pos;
    const [ancho, , fondo] = productos.tam;
    // Centros de las tres etiquetas (ver `detalleProductos` en piezas/s1.ts).
    for (const x of [-ancho / 2 + 0.0575, 0, ancho / 2 - 0.103]) {
      const rayo = new Raycaster(
        new Vector3(px + x, py + 0.045, pz + fondo / 2 + 1),
        new Vector3(0, 0, -1),
      );
      const choque = rayo.intersectObject(construida.raiz, true)[0];
      expect(choque, `etiqueta en x = ${x}`).toBeDefined();
      expect(interactivoDe(choque?.object ?? null)?.userData['interactivo']?.id, `x = ${x}`).toBe(
        's1-productos',
      );
    }
  });
});
