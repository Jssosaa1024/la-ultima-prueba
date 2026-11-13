/**
 * Salas por código: arma una sala de `src/content/salas.json` con primitivas de Three.js.
 *
 * - Piso, techo y cuatro paredes con el tamaño de la sala; las paredes son sólidas.
 * - Cada objeto es una caja, un cilindro, un plano (una caja muy delgada, para que se vea
 *   y se pueda tocar por los dos lados) o un grupo de piezas.
 * - Las cajas de colisión salen de los objetos sólidos (T17) ANTES de unir la geometría.
 * - Todo lo fijo que no se toca se une en UNA sola malla con colores por vértice: una
 *   draw call para casi toda la sala. Lo que se toca queda aparte, con su propio material,
 *   para poder resaltarlo (T18).
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
} from 'three';
import type { Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjetoSala, Sala } from '../../content/esquema-salas';
import { marcarInteractivo } from '../interaccion/interaccion';
import type { Caja } from '../jugador/colision';
import { cajasDeColision, marcarSolido } from './colisiones';

/** Grosor de las paredes, por fuera del piso. */
const GROSOR_PARED = 0.2;
/** Grosor de un plano (cartel, puerta, pizarra). */
const GROSOR_PLANO = 0.03;
const LADOS_CILINDRO = 16;
const GRADOS = Math.PI / 180;

export interface SalaConstruida {
  id: Sala['id'];
  raiz: Group;
  cajas: Caja[];
  /** Dónde aparece el jugador y hacia dónde mira (yaw en radianes, 0 = hacia −Z). */
  inicio: { x: number; z: number; yaw: number };
  triangulos: number;
  /** Mallas que se dibujan: una draw call cada una. */
  mallas: number;
}

/** Geometría con la base en y = 0, centrada en x y z. */
function geometria(forma: 'caja' | 'cilindro' | 'plano', tam: readonly number[]): BufferGeometry {
  const [ancho = 1, alto = 1, fondo = 1] = tam;
  const g =
    forma === 'cilindro'
      ? new CylinderGeometry(ancho / 2, ancho / 2, alto, LADOS_CILINDRO)
      : new BoxGeometry(ancho, alto, forma === 'plano' ? GROSOR_PLANO : fondo);
  return g.translate(0, alto / 2, 0);
}

function crearObjeto(o: ObjetoSala): Object3D {
  let objeto: Object3D;
  if (o.forma === 'grupo') {
    objeto = new Group();
    for (const p of o.partes ?? []) {
      const malla = new Mesh(
        geometria(p.forma, p.tam),
        new MeshLambertMaterial({ color: p.color ?? o.color }),
      );
      malla.position.set(p.pos[0], p.pos[1], p.pos[2]);
      objeto.add(malla);
    }
  } else {
    objeto = new Mesh(geometria(o.forma, o.tam), new MeshLambertMaterial({ color: o.color }));
  }
  objeto.name = o.id;
  objeto.position.set(o.pos[0], o.pos[1], o.pos[2]);
  objeto.rotation.y = (o.giro ?? 0) * GRADOS;
  objeto.userData['id'] = o.id;
  if (o.puerta) objeto.userData['puerta'] = o.puerta;
  if (o.solido) marcarSolido(objeto);
  if (o.accion && o.nombre) {
    marcarInteractivo(objeto, { id: o.id, nombre: o.nombre, accion: o.accion });
  }
  return objeto;
}

/** Piso, techo y paredes. Las paredes quedan por fuera del rectángulo de la sala. */
function crearCascaron(sala: Sala): Object3D[] {
  const { ancho, fondo, alto, colores } = sala;
  const piso = new Mesh(
    new PlaneGeometry(ancho, fondo).rotateX(-Math.PI / 2),
    material(colores.piso),
  );
  const techo = new Mesh(
    new PlaneGeometry(ancho, fondo).rotateX(Math.PI / 2),
    material(colores.techo),
  );
  techo.position.y = alto;

  const g = GROSOR_PARED;
  const pared = (w: number, d: number, x: number, z: number): Mesh => {
    const m = new Mesh(
      new BoxGeometry(w, alto, d).translate(0, alto / 2, 0),
      material(colores.paredes),
    );
    m.position.set(x, 0, z);
    return marcarSolido(m);
  };
  return [
    piso,
    techo,
    pared(ancho + 2 * g, g, 0, -(fondo + g) / 2),
    pared(ancho + 2 * g, g, 0, (fondo + g) / 2),
    pared(g, fondo, -(ancho + g) / 2, 0),
    pared(g, fondo, (ancho + g) / 2, 0),
  ];
}

const material = (color: string): MeshLambertMaterial => new MeshLambertMaterial({ color });

/** `true` si el objeto o alguno de sus padres se puede tocar. */
function esInteractivo(o: Object3D): boolean {
  for (let a: Object3D | null = o; a; a = a.parent) if (a.userData['interactivo']) return true;
  return false;
}

/**
 * Une en una sola malla todas las mallas fijas que no se tocan, con su color en los vértices.
 * Las originales se quitan de la escena y se liberan.
 */
function unirFijas(raiz: Group): void {
  raiz.updateMatrixWorld(true);
  const fijas: Mesh[] = [];
  raiz.traverse((o) => {
    const malla = o as Mesh;
    if (malla.isMesh && !esInteractivo(malla)) fijas.push(malla);
  });
  if (fijas.length === 0) return;

  const partes = fijas.map((malla) => {
    const g = malla.geometry.clone().applyMatrix4(malla.matrixWorld);
    const c = (malla.material as MeshLambertMaterial).color;
    const n = g.getAttribute('position').count;
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new Float32BufferAttribute(colores, 3));
    return g;
  });
  const unida = mergeGeometries(partes);
  partes.forEach((g) => g.dispose());
  if (!unida) throw new Error('No se pudo unir la geometría fija de la sala');

  for (const malla of fijas) {
    malla.removeFromParent();
    malla.geometry.dispose();
    (malla.material as MeshLambertMaterial).dispose();
  }
  // Los grupos fijos que quedaron vacíos (por ejemplo, una silla de dos piezas) sobran.
  const vacios: Object3D[] = [];
  raiz.traverse((o) => {
    if (o !== raiz && o.type === 'Group' && o.children.length === 0) vacios.push(o);
  });
  vacios.forEach((o) => o.removeFromParent());

  const fija = new Mesh(unida, new MeshLambertMaterial({ vertexColors: true }));
  fija.name = 'fija';
  raiz.add(fija);
}

export function construirSala(sala: Sala): SalaConstruida {
  const raiz = new Group();
  raiz.name = sala.id;
  raiz.add(...crearCascaron(sala), ...sala.objetos.map(crearObjeto));

  // Primero las colisiones, con cada objeto por separado; después se une la geometría.
  const cajas = cajasDeColision(raiz);
  unirFijas(raiz);

  // Dos luces dinámicas como máximo (presupuesto): cielo y una luz direccional suave.
  // El tono «de suelo» ilumina lo que mira hacia abajo (el techo): claro, para que no quede negro.
  const cielo = new HemisphereLight(0xf4f1ff, 0xa89c8a, 1.7);
  const sol = new DirectionalLight(0xfff2dd, 1.1);
  sol.position.set(sala.ancho * 0.3, sala.alto * 1.5, sala.fondo * 0.4);
  raiz.add(cielo, sol);

  let triangulos = 0;
  let mallas = 0;
  raiz.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    mallas++;
    const g = malla.geometry;
    triangulos += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });

  return {
    id: sala.id,
    raiz,
    cajas,
    inicio: { x: sala.inicio.x, z: sala.inicio.z, yaw: sala.inicio.giro * GRADOS },
    triangulos,
    mallas,
  };
}
