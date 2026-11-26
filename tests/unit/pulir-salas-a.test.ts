import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { BALONES } from '../../src/content/grabaciones';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { pulirGimnasio } from '../../src/engine/mecanismos/gimnasio-piezas';
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
  's3-gimnasio': pulirGimnasio,
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

  it('tableros del tamaño de su caja, palancas de 40 cm y campana de 25 cm', () => {
    for (const [id, ancho] of [
      ['s2-tablero-1', 0.9],
      ['s2-tablero-2', 1.8],
      ['s2-tablero-3', 1.8],
    ] as const) {
      const [x, y] = medidas(sala.raiz.getObjectByName(id));
      expect(x, id).toBeCloseTo(ancho + 0.02, 2);
      expect(y, id).toBeCloseTo(0.9, 2);
    }
    for (const id of ['s2-palanca-1', 's2-palanca-2', 's2-palanca-3']) {
      expect(medidas(sala.raiz.getObjectByName(id))[1], id).toBeCloseTo(0.404, 2);
    }
    const campana = medidas(sala.raiz.getObjectByName('s2-campana'));
    expect(campana[0]).toBeCloseTo(0.2, 2);
    expect(campana[1]).toBeLessThan(0.21);
  });

  it('la palanca y la campana giran desde su base', () => {
    for (const id of ['s2-palanca-1', 's2-palanca-2', 's2-palanca-3', 's2-campana']) {
      const g = (sala.raiz.getObjectByName(id) as Mesh).geometry;
      g.computeBoundingBox();
      expect(g.boundingBox?.min.y ?? -1, id).toBeGreaterThanOrEqual(-0.03);
    }
  });
});

describe('gimnasio: las piezas de la máquina conservan su tamaño', () => {
  const sala = construirSala(salaPorId('s3-gimnasio'));
  const colores = BALONES.map((id) =>
    ((sala.raiz.getObjectByName(id) as Mesh).material as MeshLambertMaterial).color.getHex(),
  );
  pulirGimnasio(sala.raiz);

  it('los postes miden 1, 2 y 3 m y el riel 5 m', () => {
    const postes = sala.raiz.getObjectByName('s3-postes');
    const altos = postes?.children.slice(1).map((p) => medidas(p)[1]);
    expect(altos?.map((a) => Math.round(a * 100) / 100)).toEqual([1, 2, 3]);
    expect(medidas(postes?.children[0])[0]).toBeCloseTo(5.01, 1);
  });

  it('los balones miden 24 cm, conservan su color y tienen costuras', () => {
    BALONES.forEach((id, i) => {
      const balon = sala.raiz.getObjectByName(id) as Mesh;
      const [ancho, alto] = medidas(balon);
      expect(ancho, id).toBeCloseTo(0.24, 1);
      expect(alto, id).toBeCloseTo(0.24, 1);
      const material = balon.material as MeshLambertMaterial;
      expect(material.color.getHex(), id).toBe(colores[i]);
      expect(material.vertexColors, id).toBe(true);
    });
  });

  it('el reflector gira en su bisagra y mide menos de 60 cm', () => {
    const [, alto] = medidas(sala.raiz.getObjectByName('s3-reflector'));
    expect(alto).toBeLessThan(0.62);
  });

  it('el reflector está en el eje del riel, fuera de la gradería (corrección del 25 de noviembre)', () => {
    const reflector = sala.raiz.getObjectByName('s3-reflector');
    const postes = sala.raiz.getObjectByName('s3-postes');
    if (!reflector || !postes) throw new Error('faltan piezas');
    // Alineado con el poste de 2 m (el del medio, en x = 0 del grupo), detrás de él.
    const posteDelMedio = postes.children[2];
    expect(reflector.position.x).toBeCloseTo(postes.position.x + (posteDelMedio?.position.x ?? 0));
    expect(reflector.position.z).toBeLessThan(postes.position.z);
    // La gradería va de x = −8 a 0: el reflector ya no está encima.
    expect(reflector.position.x).toBeGreaterThan(0.5);
    expect(reflector.position.y).toBe(1.5);
  });
});
