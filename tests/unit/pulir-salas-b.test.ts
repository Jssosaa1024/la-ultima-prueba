import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Raycaster, Vector3 } from 'three';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import {
  LIBROS_MAXIMOS,
  geometriaMonton,
  librosVisibles,
  mostrarLibros,
  pulirBiblioteca,
} from '../../src/engine/mecanismos/biblioteca-piezas';
import { construirSala } from '../../src/engine/salas/construir';
import { reiniciarMecanismo } from '../../src/signals/mecanismo';
import { reiniciarPartida } from '../../src/signals/partida';
import { carasAlReves, normalesSanas } from './geometria-sana';

// Pulir salas (sesión B): la biblioteca gana detalle por código sin draw calls nuevas, sin
// cambiar ids ni choques, y dentro del presupuesto de AGENTS.md.

const MAX_TRIANGULOS_SALA = 90_000;
const MAX_TRIANGULOS_INTERACTIVO = 6_000;
/** Triángulos de los GLB de la biblioteca (docs/arte-cc0.md, T19n). */
const TRIANGULOS_GLB_BIBLIOTECA = 17_748;

afterEach(() => {
  reiniciarMecanismo();
  reiniciarPartida();
});

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
function caja(o: Object3D | undefined): Box3 {
  const g = (o as Mesh).geometry;
  g.computeBoundingBox();
  return g.boundingBox ?? new Box3();
}

const interactivos = (raiz: Object3D): Map<string, unknown> => {
  const m = new Map<string, unknown>();
  raiz.traverse((o) => {
    if (o.userData['interactivo']) m.set(o.name, o.userData['interactivo']);
  });
  return m;
};

describe('biblioteca pulida', () => {
  const armar = () => construirSala(salaPorId('s4-biblioteca'));

  it('no suma mallas, cabe en el presupuesto y la carcasa de los focos va en la malla fija', () => {
    const sala = armar();
    const antes = mallas(sala.raiz).length;
    const fija = sala.raiz.getObjectByName('fija') as Mesh;
    const trisFija = triangulos(fija);
    pulirBiblioteca(sala.raiz);
    expect(mallas(sala.raiz)).toHaveLength(antes);
    expect(triangulos(sala.raiz.getObjectByName('fija') as Mesh)).toBeGreaterThan(trisFija);
    const tris = total(sala.raiz);
    // Pulirla otra vez (la sala vuelve de la caché) no repite nada.
    pulirBiblioteca(sala.raiz);
    expect(total(sala.raiz)).toBe(tris);
  });

  it('con la animación y los montones llenos, la sala sigue en el presupuesto', () => {
    const sala = armar();
    const animacion = animacionDeSala('s4-biblioteca', sala.raiz);
    const grupo = sala.raiz.getObjectByName('s4-carritos');
    // El peor caso: cada montón con sus 20 libros dibujados.
    for (const m of (grupo?.children.slice(5) ?? []) as Mesh[]) mostrarLibros(m, LIBROS_MAXIMOS);
    expect(total(sala.raiz) + TRIANGULOS_GLB_BIBLIOTECA).toBeLessThan(MAX_TRIANGULOS_SALA);
    animacion?.liberar();
  });

  it('las caras miran hacia afuera y las normales están sanas', () => {
    const sala = armar();
    animacionDeSala('s4-biblioteca', sala.raiz)?.liberar();
    const revisar = [
      sala.raiz.getObjectByName('fija') as Mesh,
      sala.raiz.getObjectByName('s4-pila-libros') as Mesh,
      ...((sala.raiz.getObjectByName('s4-carritos')?.children ?? []) as Mesh[]),
      ...((sala.raiz.getObjectByName('s4-lamparas')?.children ?? []) as Mesh[]),
    ];
    for (const m of revisar) {
      expect(m.geometry.index, m.name).toBeNull();
      expect(carasAlReves(m.geometry), m.name).toBe(0);
      expect(normalesSanas(m.geometry), m.name).toBe(true);
    }
  });

  it('lo que se toca sigue con su id y su acción, en su caja y con menos de 6.000 triángulos', () => {
    const sala = armar();
    const antes = interactivos(sala.raiz);
    const choques = JSON.stringify(sala.cajas);
    pulirBiblioteca(sala.raiz);
    expect(interactivos(sala.raiz)).toEqual(antes);
    expect(JSON.stringify(construirSala(salaPorId('s4-biblioteca')).cajas)).toBe(choques);

    const carritos = sala.raiz.getObjectByName('s4-carritos');
    for (const carro of (carritos?.children ?? []) as Mesh[]) {
      expect((carro.material as MeshLambertMaterial).vertexColors).toBe(true);
      const b = caja(carro);
      // El carrito cabe en la caja de 0,5 × 0,7 × 0,4 m (la manija sobresale 1 cm atrás).
      expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
      expect(b.max.y).toBeLessThanOrEqual(0.701);
      expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(0.251);
      expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(0.22);
      expect(triangulos(carro)).toBeLessThan(MAX_TRIANGULOS_INTERACTIVO);
    }
    const pila = sala.raiz.getObjectByName('s4-pila-libros') as Mesh;
    const b = caja(pila);
    expect(b.max.y).toBeLessThanOrEqual(0.601);
    expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(0.2);
    expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(0.15);
    expect(triangulos(pila)).toBeLessThan(MAX_TRIANGULOS_INTERACTIVO);
  });

  it('un montón dibuja tantos libros como tiene, y cada libro tiene la misma forma', () => {
    const { geometria, cortes } = geometriaMonton(0);
    expect(cortes).toHaveLength(LIBROS_MAXIMOS + 1);
    const pasos = cortes.slice(1).map((c, i) => c - (cortes[i] ?? 0));
    expect(new Set(pasos).size).toBe(1);
    expect(cortes.at(-1)).toBe(geometria.getAttribute('position').count);
    // Los libros de al lado no son del mismo color.
    const color = geometria.getAttribute('color');
    const tapa = (k: number) => color.getX(cortes[k] ?? 0) + color.getY(cortes[k] ?? 0);
    expect(tapa(0)).not.toBeCloseTo(tapa(1));
  });

  it('la pila vacía deja su tarima, que se sigue tocando', () => {
    const sala = armar();
    pulirBiblioteca(sala.raiz);
    sala.raiz.updateMatrixWorld(true);
    const pila = sala.raiz.getObjectByName('s4-pila-libros') as Mesh;
    const rayo = new Raycaster(new Vector3(-0.6, 2, 1), new Vector3(0, -1, 0));
    const altura = () => rayo.intersectObject(pila, false)[0]?.point.y ?? -1;
    expect(librosVisibles(pila)).toBe(LIBROS_MAXIMOS);
    expect(altura()).toBeGreaterThan(0.55);
    mostrarLibros(pila, 0);
    expect(altura()).toBeGreaterThan(0.03);
    expect(altura()).toBeLessThan(0.08);
  });

  it('el resumen semanal es una lámina con los cuatro rótulos de los focos', () => {
    const o = salaPorId('s4-biblioteca').objetos.find((x) => x.id === 's4-lamparas');
    expect(o?.lamina?.tipo).toBe('tablero');
    expect(o?.lamina?.lineas).toEqual(['MEDIA', 'MEDIANA', 'MODA', 'RANGO']);
  });
});
