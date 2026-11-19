/**
 * Piezas por código: ayudas para rehacer un objeto con más detalle (pulir las salas).
 *
 * Una pieza es un objeto de `salas.json` (`pieza` en el objeto) que el motor arma con varias
 * formas simples, en el estilo de KayKit y Kenney: cantos biselados y colores planos de su
 * paleta. Todas sus partes se unen en UNA geometría con colores por vértice, así que la pieza
 * es una malla y una draw call, como la primitiva que reemplaza; si no se toca, se une además
 * con lo fijo de la sala.
 *
 * Reglas para quien arma una pieza:
 * - Cabe en el `tam` del objeto, centrada en x y z y con la base en y = 0, como la primitiva:
 *   así la colisión (T17), la sombra de contacto y el resaltado (T18) no cambian.
 * - Si una máquina la anima (la palanca), el pivote de la animación sigue en el origen.
 * - Si lleva letras o dibujos (una etiqueta, la cara de un reloj), los pinta en `dibujo` y sus
 *   partes con textura usan `enRegion`; las demás toman el blanco de la esquina del lienzo.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjetoSala } from '../../../content/esquema-salas';

type Ctx = CanvasRenderingContext2D;

/** Un lienzo propio de la pieza, para etiquetas, caras de reloj o tapas. */
export interface DibujoPieza {
  /** En píxeles; nada mayor de 1024 (presupuesto). */
  ancho: number;
  alto: number;
  pintar(ctx: Ctx, w: number, h: number): void;
}

export interface Pieza {
  /** Indexada, con `position`, `normal`, `uv` y `color` (lo deja así `unirPartes`). */
  geometria: BufferGeometry;
  dibujo?: DibujoPieza;
}

export type ConstructorPieza = (o: ObjetoSala) => Pieza;

/** Una parte de la pieza ya puesta en su sitio, con su color de la paleta. */
export interface Parte {
  g: BufferGeometry;
  color: string;
  /** `true` si sus UV ya apuntan a su región del lienzo (`enRegion`). */
  conDibujo?: boolean;
}

/**
 * Lado del cuadro blanco que `pintarConBlanco` deja en la esquina de abajo a la derecha del
 * lienzo, en fracción del lienzo: las partes sin dibujo leen ahí el blanco y se ven con su color.
 */
export const ESQUINA_BLANCA = 1 / 16;
/** UV del centro de la esquina blanca (la textura se voltea en y: v = 0 es abajo). */
export const UV_BLANCO: readonly [number, number] = [1 - ESQUINA_BLANCA / 2, ESQUINA_BLANCA / 2];

const GRADOS = Math.PI / 180;

/**
 * Caja con los cantos biselados (un segmento de redondeo: 12 caras por esquina, unos 108
 * triángulos). `bisel` en metros; por defecto, el 18 % del lado más corto.
 */
export function cajaBiselada(
  ancho: number,
  alto: number,
  fondo: number,
  bisel = Math.min(ancho, alto, fondo) * 0.18,
): BufferGeometry {
  const r = Math.min(bisel, Math.min(ancho, alto, fondo) / 2 - 1e-4);
  return r > 1e-4
    ? new RoundedBoxGeometry(ancho, alto, fondo, 1, r)
    : new BoxGeometry(ancho, alto, fondo);
}

/** Cilindro (o cono truncado) de pocos lados, centrado en su alto. */
export function cilindro(
  radioArriba: number,
  radioAbajo: number,
  alto: number,
  lados = 12,
): BufferGeometry {
  return new CylinderGeometry(radioArriba, radioAbajo, alto, lados);
}

/**
 * Pone una geometría en su sitio: primero gira (grados, en x, y, z) y después se mueve a
 * `pos`. Devuelve la misma geometría.
 */
export function colocar(
  g: BufferGeometry,
  pos: readonly [number, number, number] = [0, 0, 0],
  giro: readonly [number, number, number] = [0, 0, 0],
  escala: readonly [number, number, number] = [1, 1, 1],
): BufferGeometry {
  const q = new Quaternion().setFromEuler(
    new Euler(giro[0] * GRADOS, giro[1] * GRADOS, giro[2] * GRADOS),
  );
  return g.applyMatrix4(new Matrix4().compose(new Vector3(...pos), q, new Vector3(...escala)));
}

/** Atajo: una parte de un color, ya colocada. */
export function parte(
  g: BufferGeometry,
  color: string,
  pos?: readonly [number, number, number],
  giro?: readonly [number, number, number],
  escala?: readonly [number, number, number],
): Parte {
  return { g: colocar(g, pos, giro, escala), color };
}

/**
 * Lleva las UV de `g` (de 0 a 1) a una región del lienzo, en fracciones del lienzo con el
 * origen arriba a la izquierda: `[x0, y0, x1, y1]`. Con `grupos`, solo los vértices de esos
 * grupos de la geometría (en un cilindro: 0 el costado, 1 la tapa de arriba, 2 la de abajo);
 * los demás van al blanco. Llamar antes de colocar la geometría o después, da igual.
 */
export function enRegion(
  g: BufferGeometry,
  region: readonly [number, number, number, number],
  grupos?: readonly number[],
): BufferGeometry {
  const uv = g.getAttribute('uv');
  const [x0, y0, x1, y1] = region;
  const dentro = new Set<number>();
  if (grupos && g.groups.length > 0) {
    const indice = g.index;
    for (const n of grupos) {
      const grupo = g.groups[n];
      if (!grupo) continue;
      for (let i = grupo.start; i < grupo.start + grupo.count; i++) {
        dentro.add(indice ? indice.getX(i) : i);
      }
    }
  }
  for (let i = 0; i < uv.count; i++) {
    if (grupos && !dentro.has(i)) {
      uv.setXY(i, UV_BLANCO[0], UV_BLANCO[1]);
      continue;
    }
    const u = x0 + uv.getX(i) * (x1 - x0);
    // v = 1 es arriba en la textura (se voltea al subirla).
    const v = 1 - (y0 + (1 - uv.getY(i)) * (y1 - y0));
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * Une las partes en una geometría indexada con `position`, `normal`, `uv` y `color` (en el
 * espacio lineal, como los colores de los materiales). Libera las partes.
 */
export function unirPartes(partes: readonly Parte[]): BufferGeometry {
  const listas = partes.map(({ g, color, conDibujo }) => {
    const plana = g.index ? g.toNonIndexed() : g;
    if (plana !== g) g.dispose();
    for (const nombre of Object.keys(plana.attributes)) {
      if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'uv') {
        plana.deleteAttribute(nombre);
      }
    }
    const n = plana.getAttribute('position').count;
    if (!plana.getAttribute('normal')) plana.computeVertexNormals();
    if (!conDibujo || !plana.getAttribute('uv')) {
      const uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) uv.set(UV_BLANCO, i * 2);
      plana.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    }
    const c = new Color(color);
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
    plana.setAttribute('color', new Float32BufferAttribute(colores, 3));
    plana.clearGroups();
    return plana;
  });
  const unida = mergeGeometries(listas);
  listas.forEach((g) => g.dispose());
  if (!unida) throw new Error('No se pudieron unir las partes de la pieza');
  const indexada = mergeVertices(unida);
  unida.dispose();
  indexada.computeBoundingBox();
  indexada.computeBoundingSphere();
  return indexada;
}

/** Pinta con `pintar` y deja la esquina blanca de abajo a la derecha (ver `UV_BLANCO`). */
export function pintarConBlanco(dibujo: DibujoPieza): (ctx: Ctx, w: number, h: number) => void {
  return (ctx, w, h) => {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    dibujo.pintar(ctx, w, h);
    ctx.restore();
    const lado = Math.ceil(Math.max(w, h) * ESQUINA_BLANCA);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w - lado, h - lado, lado, lado);
  };
}
