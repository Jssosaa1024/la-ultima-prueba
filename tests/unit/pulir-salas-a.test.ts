import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import type { Mesh, Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { pulirLaboratorio } from '../../src/engine/mecanismos/laboratorio-piezas';
import { construirSala } from '../../src/engine/salas/construir';
import { carasAlReves, normalesSanas } from './geometria-sana';

// Pulir salas (sesión A): el laboratorio y el gimnasio ganan detalle por código sin draw calls
// nuevas, sin cambiar ids ni choques, y dentro del presupuesto de AGENTS.md.

const MAX_TRIANGULOS_SALA = 90_000;
const MAX_TRIANGULOS_INTERACTIVO = 6_000;

function mallas(raiz: Object3D): Mesh[] {
  const lista: Mesh[] = [];
  raiz.traverse((o) => {
    if ((o as Mesh).isMesh) lista.push(o as Mesh);
  });
  return lista;
}

const triangulos = (m: Mesh): number =>
  (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3;

const total = (raiz: Object3D): number => mallas(raiz).reduce((s, m) => s + triangulos(m), 0);

/** Medidas de una malla en su propio espacio (sin su posición ni su giro). */
const medidas = (o: Object3D | undefined): [number, number, number] => {
  const g = (o as Mesh).geometry;
  g.computeBoundingBox();
  const b = g.boundingBox ?? new Box3();
  return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
};

const PULIR = {
  's2-laboratorio': pulirLaboratorio,
} as const;

describe.each(Object.entries(PULIR))('%s pulido', (id, pulir) => {
  const armar = () => construirSala(salaPorId(id as keyof typeof PULIR));

  it('no suma mallas, cabe en el presupuesto y lo fijo nuevo va en la malla fija', () => {
    const sala = armar();
    const antes = mallas(sala.raiz).length;
    const trisAntes = total(sala.raiz);
    pulir(sala.raiz);
    expect(mallas(sala.raiz)).toHaveLength(antes);
    const tris = total(sala.raiz);
    expect(tris).toBeGreaterThan(trisAntes);
    expect(tris).toBeLessThan(MAX_TRIANGULOS_SALA);
    // Pulirla otra vez (la sala vuelve de la caché) no repite nada.
    pulir(sala.raiz);
    expect(total(sala.raiz)).toBe(tris);
  });

  it('las caras miran hacia afuera y las normales están sanas', () => {
    const sala = armar();
    pulir(sala.raiz);
    for (const m of mallas(sala.raiz)) {
      if (!m.geometry.getAttribute('normal')) continue;
      if (m.name === 'fija' || m.userData['piezasSumadas']) {
        expect(carasAlReves(m.geometry), m.name).toBe(0);
        expect(normalesSanas(m.geometry), m.name).toBe(true);
      }
    }
  });

  it('lo que se toca sigue con su id y su acción, y no pasa de 6.000 triángulos', () => {
    const sala = armar();
    const antes = new Map<string, unknown>();
    sala.raiz.traverse((o) => {
      if (o.userData['interactivo']) antes.set(o.name, o.userData['interactivo']);
    });
    pulir(sala.raiz);
    for (const [nombre, datos] of antes) {
      const o = sala.raiz.getObjectByName(nombre);
      expect(o?.userData['interactivo']).toEqual(datos);
      let tris = 0;
      o?.traverse((h) => {
        if ((h as Mesh).isMesh) tris += triangulos(h as Mesh);
      });
      expect(tris, nombre).toBeLessThanOrEqual(MAX_TRIANGULOS_INTERACTIVO);
    }
  });

  it('las cajas de choque son las mismas', () => {
    const sala = armar();
    const cajas = JSON.stringify(sala.cajas);
    pulir(sala.raiz);
    expect(JSON.stringify(construirSala(salaPorId(id as keyof typeof PULIR)).cajas)).toBe(cajas);
  });

  it('la animación de la sala la pule al prepararla', () => {
    const sala = armar();
    const trisAntes = total(sala.raiz);
    const animacion = animacionDeSala(id as keyof typeof PULIR, sala.raiz);
    expect(total(sala.raiz)).toBeGreaterThan(trisAntes);
    animacion?.liberar();
  });
});

describe('laboratorio: las piezas de la máquina conservan su tamaño', () => {
  const sala = construirSala(salaPorId('s2-laboratorio'));
  pulirLaboratorio(sala.raiz);

  it('perillas de 14 cm, palanca de 40 cm y campana de 25 cm', () => {
    const verde = medidas(sala.raiz.getObjectByName('s2-perilla-verde'));
    expect(verde[0]).toBeCloseTo(0.14, 2);
    expect(verde[1]).toBeCloseTo(0.0725, 2);
    const palanca = medidas(sala.raiz.getObjectByName('s2-palanca'));
    expect(palanca[1]).toBeCloseTo(0.404, 2);
    const campana = medidas(sala.raiz.getObjectByName('s2-campana'));
    expect(campana[0]).toBeCloseTo(0.2, 2);
    expect(campana[1]).toBeLessThan(0.21);
  });

  it('la palanca y la campana giran desde su base', () => {
    for (const id of ['s2-palanca', 's2-campana']) {
      const g = (sala.raiz.getObjectByName(id) as Mesh).geometry;
      g.computeBoundingBox();
      expect(g.boundingBox?.min.y ?? -1, id).toBeGreaterThanOrEqual(-0.03);
    }
  });
});
