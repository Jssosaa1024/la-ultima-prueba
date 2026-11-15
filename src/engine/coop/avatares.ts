/**
 * Avatares de los demás jugadores (T82 y T83): cuerpo y cabeza de bajo polígono, hechos por
 * código, con el color de cada jugador y su alias encima.
 *
 * Presupuesto: con 4 jugadores, a lo sumo 4 draw calls extra. Los 3 cuerpos son un solo
 * `InstancedMesh` (1 draw call) y cada alias es un `Sprite` (1 draw call cada uno, 3 como
 * máximo). Unos 130 triángulos por avatar, muy por debajo de los 2.000 de la sección 0.
 */
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Alias, Color as ColorJugador } from '../../signals/coop';

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

/**
 * Cómo se escribe cada alias: lo mismo que `NOMBRE_ALIAS` de `ui/coop/nombres.ts` (el motor no
 * importa de la interfaz; un test comprueba que no se separen).
 */
export const NOMBRE_ALIAS: Readonly<Record<Alias, string>> = {
  zorro: 'Zorro',
  buho: 'Búho',
  colibri: 'Colibrí',
  tortuga: 'Tortuga',
  jaguar: 'Jaguar',
  condor: 'Cóndor',
  delfin: 'Delfín',
  oso: 'Oso',
  rana: 'Rana',
  tucan: 'Tucán',
  ardilla: 'Ardilla',
  mono: 'Mono',
};

/** Altura de la etiqueta sobre el piso, en metros (encima de la cabeza). */
export const ALTURA_ETIQUETA = 1.92;
const ANCHO_LIENZO = 256;
const ALTO_LIENZO = 64;

/** Lo mínimo de un `<canvas>` para dibujar la etiqueta (en las pruebas, uno falso). */
export interface Lienzo {
  width: number;
  height: number;
  getContext(tipo: '2d'): CanvasRenderingContext2D | null;
}

const lienzoDelNavegador = (): Lienzo => document.createElement('canvas');

/** Dibuja el alias en el lienzo: fondo oscuro, borde del color del jugador y texto claro. */
function dibujarEtiqueta(lienzo: Lienzo, texto: string, color: ColorJugador): void {
  const c = lienzo.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, ANCHO_LIENZO, ALTO_LIENZO);
  c.fillStyle = 'rgba(0, 0, 0, 0.62)';
  c.strokeStyle = `#${HEX_COLOR[color].toString(16).padStart(6, '0')}`;
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(4, 4, ANCHO_LIENZO - 8, ALTO_LIENZO - 8, 24);
  c.fill();
  c.stroke();
  c.fillStyle = '#f2f2f2';
  c.font = 'bold 34px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  // Solo texto de una lista cerrada (`NOMBRE_ALIAS`), dibujado en un canvas: nada de HTML.
  c.fillText(texto, ANCHO_LIENZO / 2, ALTO_LIENZO / 2 + 2);
}

interface Etiqueta {
  sprite: Sprite;
  textura: CanvasTexture;
  material: SpriteMaterial;
  lienzo: Lienzo;
  /** Lo que tiene dibujado, para no redibujar en cada cuadro. */
  dibujado: string;
}

export interface Avatares {
  readonly malla: InstancedMesh;
  /** Las etiquetas con el alias, una por compañero. */
  readonly etiquetas: readonly Sprite[];
  /** Pone el avatar `i` en (x, y, z) mirando a `yaw`, con su color y su alias. */
  poner(
    i: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    color: ColorJugador,
    alias: Alias,
  ): void;
  /** Cuántos se dibujan (los primeros `n`). */
  mostrar(n: number): void;
  liberar(): void;
}

export function crearAvatares(crearLienzo: () => Lienzo = lienzoDelNavegador): Avatares {
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

  // Las etiquetas cuelgan de la malla: entran y salen de la escena con ella.
  const etiquetas: Etiqueta[] = [];
  for (let i = 0; i < MAX_COMPANEROS; i++) {
    const lienzo = crearLienzo();
    lienzo.width = ANCHO_LIENZO;
    lienzo.height = ALTO_LIENZO;
    const textura = new CanvasTexture(lienzo as HTMLCanvasElement);
    textura.colorSpace = SRGBColorSpace;
    const mat = new SpriteMaterial({ map: textura, transparent: true, depthWrite: false });
    const sprite = new Sprite(mat);
    sprite.name = 'alias';
    sprite.scale.set(0.64, 0.16, 1);
    sprite.visible = false;
    malla.add(sprite);
    etiquetas.push({ sprite, textura, material: mat, lienzo, dibujado: '' });
  }

  return {
    malla,
    etiquetas: etiquetas.map((e) => e.sprite),
    poner(i, x, y, z, yaw, c, alias) {
      q.setFromAxisAngle(eje, yaw);
      m.compose(p.set(x, y, z), q, uno);
      malla.setMatrixAt(i, m);
      malla.instanceMatrix.needsUpdate = true;
      malla.setColorAt(i, color.setHex(HEX_COLOR[c]));
      if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
      const e = etiquetas[i];
      if (!e) return;
      e.sprite.position.set(x, y + ALTURA_ETIQUETA, z);
      const clave = `${alias}:${c}`;
      if (e.dibujado !== clave) {
        e.dibujado = clave;
        dibujarEtiqueta(e.lienzo, NOMBRE_ALIAS[alias], c);
        e.textura.needsUpdate = true;
      }
    },
    mostrar(n) {
      malla.count = Math.max(0, Math.min(MAX_COMPANEROS, n));
      for (let i = 0; i < etiquetas.length; i++) {
        const e = etiquetas[i];
        if (e) e.sprite.visible = i < malla.count;
      }
    },
    liberar() {
      malla.removeFromParent();
      malla.dispose();
      geometria.dispose();
      material.dispose();
      for (const e of etiquetas) {
        e.textura.dispose();
        e.material.dispose();
      }
    },
  };
}
