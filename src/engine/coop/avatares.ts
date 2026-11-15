/**
 * Avatares de los demás jugadores (T82 y T83): cuerpo y cabeza de bajo polígono, hechos por
 * código, con el color de cada jugador. Todos los cuerpos son un solo `InstancedMesh`: una
 * draw call para los 3 compañeros posibles.
 */
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Color as ColorJugador } from '../../signals/coop';

/** Hasta 4 jugadores: los otros 3 se dibujan. */
export const MAX_COMPANEROS = 3;

/** Colores de los avatares: los mismos de la interfaz (`ui/coop/nombres.ts`). */
export const HEX_COLOR: Readonly<Record<ColorJugador, number>> = {
  ambar: 0xe8a33d,
  turquesa: 0x3ec1c9,
  violeta: 0xa98bf0,
  coral: 0xf2836b,
};

/** Pinta una pieza con un gris (multiplica al color del jugador): 1 = color pleno. */
function pintar(g: BufferGeometry, gris: number): BufferGeometry {
  const plana = g.index ? g.toNonIndexed() : g;
  const n = plana.getAttribute('position').count;
  plana.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).fill(gris), 3));
  if (plana !== g) g.dispose();
  return plana;
}

/**
 * Cuerpo (cilindro de 8 lados), cabeza (icosaedro) y visera oscura hacia −Z, que es hacia
 * donde mira el jugador. Unos 130 triángulos: muy por debajo de los 2.000 por avatar.
 */
export function crearGeometriaAvatar(): BufferGeometry {
  const cuerpo = new CylinderGeometry(0.2, 0.26, 1.15, 8);
  cuerpo.translate(0, 0.575, 0);
  const cabeza = new IcosahedronGeometry(0.17, 1);
  cabeza.translate(0, 1.42, 0);
  const visera = new BoxGeometry(0.22, 0.07, 0.08);
  visera.translate(0, 1.45, -0.15);
  const partes = [pintar(cuerpo, 1), pintar(cabeza, 1), pintar(visera, 0.18)];
  const geometria = mergeGeometries(partes);
  for (const p of partes) p.dispose();
  if (!geometria) throw new Error('No se pudo armar el avatar');
  geometria.computeBoundingSphere();
  return geometria;
}

export interface Avatares {
  readonly malla: InstancedMesh;
  /** Pone el avatar `i` en (x, y, z) mirando a `yaw`, con su color. */
  poner(i: number, x: number, y: number, z: number, yaw: number, color: ColorJugador): void;
  /** Cuántos se dibujan (los primeros `n`). */
  mostrar(n: number): void;
  liberar(): void;
}

export function crearAvatares(): Avatares {
  const geometria = crearGeometriaAvatar();
  const material = new MeshLambertMaterial({ vertexColors: true });
  const malla = new InstancedMesh(geometria, material, MAX_COMPANEROS);
  malla.name = 'avatares';
  // Se mueven por toda la sala: no vale la esfera de la geometría en el origen.
  malla.frustumCulled = false;
  malla.count = 0;
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const uno = new Vector3(1, 1, 1);
  const eje = new Vector3(0, 1, 0);
  const color = new Color();
  for (let i = 0; i < MAX_COMPANEROS; i++) malla.setColorAt(i, color.setHex(0xffffff));

  return {
    malla,
    poner(i, x, y, z, yaw, c) {
      q.setFromAxisAngle(eje, yaw);
      m.compose(p.set(x, y, z), q, uno);
      malla.setMatrixAt(i, m);
      malla.instanceMatrix.needsUpdate = true;
      malla.setColorAt(i, color.setHex(HEX_COLOR[c]));
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
    },
    mostrar(n) {
      malla.count = Math.max(0, Math.min(MAX_COMPANEROS, n));
    },
    liberar() {
      malla.removeFromParent();
      malla.dispose();
      geometria.dispose();
      material.dispose();
    },
  };
}
