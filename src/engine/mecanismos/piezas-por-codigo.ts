/**
 * Piezas por código (pulir salas, sesión A): geometría low-poly al estilo de KayKit y Kenney
 * para lo que anima una máquina y para lo que no tiene modelo CC0. Cajas con los bordes
 * biselados, piezas de torno (cilindros, campanas, perillas) con las aristas marcadas, toros,
 * esferas y barras entre dos puntos, cada una con su color plano en los vértices.
 *
 * Todo lo que se agrega a un `Piezas` sale en UNA geometría (sin índice, con posición, normal
 * y color): una sola draw call.
 *
 * - `vestirMalla` pone esa geometría en una malla que ya existe (la que se toca y se anima):
 *   conserva su nombre, su id, su posición, su pivote y su caja de choque, que se calculó con
 *   la primitiva al armar la sala.
 * - `sumarAFija` une piezas que no se mueven a la malla fija de la sala (`construir.ts`), sin
 *   draw calls nuevas. Solo una vez por sala armada.
 *
 * Los colores van como en la malla fija: `Color.set` los pasa al espacio de trabajo lineal.
 */
import {
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Matrix3,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { ColorRepresentation, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = readonly [number, number, number];
/** Un punto del perfil de una pieza de torno: radio y altura. */
export type PuntoPerfil = readonly [number, number];

/** Dónde va una pieza: posición, giro en grados (x, y, z) y escala. */
export interface Colocacion {
  pos?: V3;
  giro?: V3;
  escala?: V3;
}

const GRADOS = Math.PI / 180;
const ARRIBA = new Vector3(0, 1, 0);

function matrizDe(c: Colocacion | undefined): Matrix4 {
  const m = new Matrix4();
  if (!c) return m;
  const [gx = 0, gy = 0, gz = 0] = c.giro ?? [];
  const q = new Quaternion().setFromEuler(new Euler(gx * GRADOS, gy * GRADOS, gz * GRADOS));
  const [x = 0, y = 0, z = 0] = c.pos ?? [];
  const [sx = 1, sy = 1, sz = 1] = c.escala ?? [];
  return m.compose(new Vector3(x, y, z), q, new Vector3(sx, sy, sz));
}

/** Junta piezas de colores en una sola geometría. */
export class Piezas {
  private readonly posiciones: number[] = [];
  private readonly normales: number[] = [];
  private readonly colores: number[] = [];
  /** La colocación de lo que se está armando (`en`), por encima de la de cada pieza. */
  private base = new Matrix4();
  private readonly color = new Color();

  /** Triángulos que lleva. */
  get triangulos(): number {
    return this.posiciones.length / 9;
  }

  /**
   * Arma lo que hace `armar` como si estuviera en `donde`: así un objeto se describe en sus
   * propias medidas (mirando hacia +Z, con la base en y = 0) y se pone en la sala de una vez.
   */
  en(donde: Colocacion, armar: () => void): this {
    const antes = this.base;
    this.base = antes.clone().multiply(matrizDe(donde));
    try {
      armar();
    } finally {
      this.base = antes;
    }
    return this;
  }

  /**
   * Caja centrada en `pos`, con los bordes biselados (`bisel`, en metros; 0 = sin bisel). Con
   * bisel son 44 triángulos: 6 caras, 12 chaflanes y 8 esquinas, cada una plana.
   */
  caja(tam: V3, color: ColorRepresentation, donde: Colocacion & { bisel?: number } = {}): this {
    const h = [tam[0] / 2, tam[1] / 2, tam[2] / 2] as const;
    const e = Math.max(0, Math.min(donde.bisel ?? 0, h[0] * 0.5, h[1] * 0.5, h[2] * 0.5));
    const tris: number[] = [];
    const nors: number[] = [];
    /** Un punto: en el eje `i` vale `vi`, en `j` vale `vj` y en `k` vale `vk`. */
    const punto = (i: number, vi: number, j: number, vj: number, k: number, vk: number): V3 => {
      const p = [0, 0, 0];
      p[i] = vi;
      p[j] = vj;
      p[k] = vk;
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
    };
    const ejes = [0, 1, 2] as const;
    for (const i of ejes) {
      const j = (i + 1) % 3;
      const k = (i + 2) % 3;
      const hi = h[i] ?? 0;
      const hj = (h[j] ?? 0) - e;
      const hk = (h[k] ?? 0) - e;
      for (const s of [1, -1]) {
        const n = punto(i, s, j, 0, k, 0);
        cara(
          [
            punto(i, s * hi, j, -hj, k, -hk),
            punto(i, s * hi, j, hj, k, -hk),
            punto(i, s * hi, j, hj, k, hk),
            punto(i, s * hi, j, -hj, k, hk),
          ],
          n,
          tris,
          nors,
        );
      }
    }
    if (e > 0) {
      // Chaflanes: uno por arista, entre las caras de los ejes `i` y `j`, a lo largo de `k`.
      for (const k of ejes) {
        const i = (k + 1) % 3;
        const j = (k + 2) % 3;
        const hi = h[i] ?? 0;
        const hj = h[j] ?? 0;
        const hk = (h[k] ?? 0) - e;
        for (const si of [1, -1]) {
          for (const sj of [1, -1]) {
            const n = punto(i, si, j, sj, k, 0);
            cara(
              [
                punto(i, si * hi, j, sj * (hj - e), k, -hk),
                punto(i, si * hi, j, sj * (hj - e), k, hk),
                punto(i, si * (hi - e), j, sj * hj, k, hk),
                punto(i, si * (hi - e), j, sj * hj, k, -hk),
              ],
              n,
              tris,
              nors,
            );
          }
        }
      }
      // Esquinas: un triángulo por cada una.
      const [a, b, c] = h;
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
          for (const sz of [1, -1]) {
            cara(
              [
                [sx * a, sy * (b - e), sz * (c - e)],
                [sx * (a - e), sy * b, sz * (c - e)],
                [sx * (a - e), sy * (b - e), sz * c],
              ],
              [sx, sy, sz],
              tris,
              nors,
            );
          }
        }
      }
    }
    return this.emitir(tris, nors, color, donde);
  }

  /**
   * Pieza de torno alrededor del eje Y, con la base de la pieza donde diga el perfil. Cada
   * tramo del perfil es una banda: liso alrededor del eje y con la arista marcada entre
   * tramos (como un bisel), salvo con `suave`, que promedia las normales (domos, balones).
   *
   * El perfil va de abajo hacia arriba por el lado de afuera: así las normales miran hacia
   * afuera. `desde` y `arco` (grados) dejan una parte de la vuelta, para medias piezas.
   */
  torno(
    perfil: readonly PuntoPerfil[],
    color: ColorRepresentation,
    donde: Colocacion & { lados?: number; suave?: boolean; desde?: number; arco?: number } = {},
  ): this {
    const lados = donde.lados ?? 16;
    const desde = (donde.desde ?? 0) * GRADOS;
    const arco = (donde.arco ?? 360) * GRADOS;
    const tris: number[] = [];
    const nors: number[] = [];
    // Normal 2D (radial, vertical) de cada tramo.
    const tramos: [number, number][] = [];
    for (let t = 0; t + 1 < perfil.length; t++) {
      const [r0, y0] = perfil[t] ?? [0, 0];
      const [r1, y1] = perfil[t + 1] ?? [0, 0];
      const largo = Math.hypot(r1 - r0, y1 - y0) || 1;
      tramos.push([(y1 - y0) / largo, -(r1 - r0) / largo]);
    }
    /** Normal 2D en el punto `p` del tramo `t` (`lado` 0 = abajo, 1 = arriba). */
    const normal2d = (t: number, lado: 0 | 1): [number, number] => {
      const propia = tramos[t] ?? [1, 0];
      if (!donde.suave) return propia;
      const vecina = tramos[lado === 0 ? t - 1 : t + 1];
      if (!vecina) return propia;
      const nr = propia[0] + vecina[0];
      const ny = propia[1] + vecina[1];
      const l = Math.hypot(nr, ny) || 1;
      return [nr / l, ny / l];
    };
    for (let t = 0; t < tramos.length; t++) {
      const [r0, y0] = perfil[t] ?? [0, 0];
      const [r1, y1] = perfil[t + 1] ?? [0, 0];
      const n0 = normal2d(t, 0);
      const n1 = normal2d(t, 1);
      for (let l = 0; l < lados; l++) {
        const a = desde + (arco * l) / lados;
        const b = desde + (arco * (l + 1)) / lados;
        const v = (r: number, y: number, ang: number): V3 => [
          r * Math.sin(ang),
          y,
          r * Math.cos(ang),
        ];
        const n = (nn: [number, number], ang: number): V3 => [
          nn[0] * Math.sin(ang),
          nn[1],
          nn[0] * Math.cos(ang),
        ];
        // En el eje (radio 0) la banda es un triángulo: el otro sale sin área y se salta.
        triangulosConNormales(
          [
            [v(r0, y0, a), n(n0, a)],
            [v(r0, y0, b), n(n0, b)],
            [v(r1, y1, b), n(n1, b)],
            [v(r1, y1, a), n(n1, a)],
          ],
          tris,
          nors,
        );
      }
    }
    return this.emitir(tris, nors, color, donde);
  }

  /** Cilindro con la base en `pos` (radio abajo `r`, arriba `rArriba`). `bisel` redondea los bordes. */
  cilindro(
    r: number,
    alto: number,
    color: ColorRepresentation,
    donde: Colocacion & { lados?: number; rArriba?: number; bisel?: number } = {},
  ): this {
    const ra = donde.rArriba ?? r;
    const b = Math.min(donde.bisel ?? 0, r / 2, ra / 2, alto / 2);
    const perfil: PuntoPerfil[] =
      b > 0
        ? [
            [0, 0],
            [r - b, 0],
            [r, b],
            [ra, alto - b],
            [ra - b, alto],
            [0, alto],
          ]
        : [
            [0, 0],
            [r, 0],
            [ra, alto],
            [0, alto],
          ];
    return this.torno(perfil, color, donde);
  }

  /** Esfera centrada en `pos`. */
  esfera(
    r: number,
    color: ColorRepresentation,
    donde: Colocacion & { lados?: number; anillos?: number } = {},
  ): this {
    const anillos = donde.anillos ?? 8;
    const perfil: PuntoPerfil[] = [];
    for (let i = 0; i <= anillos; i++) {
      const f = (Math.PI * i) / anillos;
      perfil.push([r * Math.sin(f), -r * Math.cos(f)]);
    }
    return this.torno(perfil, color, { ...donde, suave: true, lados: donde.lados ?? 12 });
  }

  /**
   * Toro en el plano XZ (acostado), centrado en `pos`: `radio` hasta el centro del tubo y
   * `grueso` del tubo. `desde` y `arco` (grados) dejan solo una parte; el ángulo 0 es +Z y
   * crece hacia +X.
   */
  toro(
    radio: number,
    grueso: number,
    color: ColorRepresentation,
    donde: Colocacion & { lados?: number; tubo?: number; desde?: number; arco?: number } = {},
  ): this {
    const lados = donde.lados ?? 16;
    const tubo = donde.tubo ?? 6;
    const desde = (donde.desde ?? 0) * GRADOS;
    const arco = (donde.arco ?? 360) * GRADOS;
    const tris: number[] = [];
    const nors: number[] = [];
    const punto = (u: number, v: number): [V3, V3] => {
      const n: V3 = [Math.cos(v) * Math.sin(u), Math.sin(v), Math.cos(v) * Math.cos(u)];
      return [
        [
          (radio + grueso * Math.cos(v)) * Math.sin(u),
          grueso * Math.sin(v),
          (radio + grueso * Math.cos(v)) * Math.cos(u),
        ],
        n,
      ];
    };
    for (let i = 0; i < lados; i++) {
      const u0 = desde + (arco * i) / lados;
      const u1 = desde + (arco * (i + 1)) / lados;
      for (let j = 0; j < tubo; j++) {
        const v0 = (2 * Math.PI * j) / tubo;
        const v1 = (2 * Math.PI * (j + 1)) / tubo;
        triangulosConNormales(
          [punto(u0, v0), punto(u1, v0), punto(u1, v1), punto(u0, v1)],
          tris,
          nors,
        );
      }
    }
    return this.emitir(tris, nors, color, donde);
  }

  /** Barra (cilindro) de `a` a `b`, de radio `r`. Para tubos, varillas, cuerdas y patas. */
  barra(a: V3, b: V3, r: number, color: ColorRepresentation, lados = 8): this {
    const va = new Vector3(...a);
    const d = new Vector3(...b).sub(va);
    const largo = d.length();
    if (largo === 0) return this;
    const q = new Quaternion().setFromUnitVectors(ARRIBA, d.normalize());
    const e = new Euler().setFromQuaternion(q);
    return this.cilindro(r, largo, color, {
      lados,
      pos: a,
      giro: [e.x / GRADOS, e.y / GRADOS, e.z / GRADOS],
    });
  }

  /** La geometría con todo lo que se agregó: sin índice, con posición, normal y color. */
  geometria(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.posiciones, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.normales, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colores, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  private emitir(
    tris: readonly number[],
    nors: readonly number[],
    color: ColorRepresentation,
    donde: Colocacion,
  ): this {
    const m = this.base.clone().multiply(matrizDe(donde));
    const nm = new Matrix3().getNormalMatrix(m);
    const p = new Vector3();
    const n = new Vector3();
    this.color.set(color);
    // Una escala negativa da vuelta las caras: se corrige el orden.
    const invertir = m.determinant() < 0;
    for (let i = 0; i < tris.length; i += 9) {
      const orden = invertir ? [0, 2, 1] : [0, 1, 2];
      for (const v of orden) {
        p.set(
          tris[i + v * 3] ?? 0,
          tris[i + v * 3 + 1] ?? 0,
          tris[i + v * 3 + 2] ?? 0,
        ).applyMatrix4(m);
        n.set(nors[i + v * 3] ?? 0, nors[i + v * 3 + 1] ?? 0, nors[i + v * 3 + 2] ?? 0)
          .applyMatrix3(nm)
          .normalize();
        this.posiciones.push(p.x, p.y, p.z);
        this.normales.push(n.x, n.y, n.z);
        this.colores.push(this.color.r, this.color.g, this.color.b);
      }
    }
    return this;
  }
}

/** Una cara plana (abanico) con su normal; el orden de los vértices se corrige solo. */
function cara(vertices: readonly V3[], normal: V3, tris: number[], nors: number[]): void {
  const l = Math.hypot(...normal) || 1;
  const n: V3 = [normal[0] / l, normal[1] / l, normal[2] / l];
  triangulosConNormales(
    vertices.map((v) => [v, n] as [V3, V3]),
    tris,
    nors,
  );
}

/**
 * Triángulos en abanico de un polígono convexo con normales por vértice. El orden se da vuelta
 * si la cara queda mirando al revés de sus normales, así el material de un solo lado la dibuja.
 */
function triangulosConNormales(puntos: readonly [V3, V3][], tris: number[], nors: number[]): void {
  const [p0, n0] = puntos[0] ?? [
    [0, 0, 0],
    [0, 1, 0],
  ];
  for (let i = 1; i + 1 < puntos.length; i++) {
    const [p1, n1] = puntos[i] ??
      puntos[0] ?? [
        [0, 0, 0],
        [0, 1, 0],
      ];
    const [p2, n2] = puntos[i + 1] ??
      puntos[0] ?? [
        [0, 0, 0],
        [0, 1, 0],
      ];
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx === 0 && cy === 0 && cz === 0) continue;
    const mx = n0[0] + n1[0] + n2[0];
    const my = n0[1] + n1[1] + n2[1];
    const mz = n0[2] + n1[2] + n2[2];
    const alReves = cx * mx + cy * my + cz * mz < 0;
    const orden: [V3, V3][] = alReves
      ? [
          [p0, n0],
          [p2, n2],
          [p1, n1],
        ]
      : [
          [p0, n0],
          [p1, n1],
          [p2, n2],
        ];
    for (const [p, n] of orden) {
      tris.push(p[0], p[1], p[2]);
      nors.push(n[0], n[1], n[2]);
    }
  }
}

/** Marca en `userData` de la sala: ya se le unieron sus piezas a la malla fija. */
const PIEZAS_SUMADAS = 'piezasSumadas';

/**
 * Une `piezas` a la malla fija de la sala (la que arma `construir.ts` con lo que no se toca).
 * Una sala armada se puede volver a mostrar sin armarla otra vez: `clave` evita sumarlas dos
 * veces. Si la sala no tiene malla fija, se crea (una draw call).
 */
export function sumarAFija(raiz: Object3D, clave: string, piezas: Piezas): void {
  const hechas = (raiz.userData[PIEZAS_SUMADAS] as string[] | undefined) ?? [];
  if (hechas.includes(clave) || piezas.triangulos === 0) return;
  raiz.userData[PIEZAS_SUMADAS] = [...hechas, clave];
  const nueva = piezas.geometria();
  const fija = raiz.getObjectByName('fija') as Mesh | undefined;
  if (!fija?.isMesh) {
    const malla = new Mesh(nueva, new MeshLambertMaterial({ vertexColors: true }));
    malla.name = 'fija';
    raiz.add(malla);
    return;
  }
  const vieja = fija.geometry;
  const base = vieja.index ? vieja.toNonIndexed() : vieja.clone();
  for (const nombre of Object.keys(base.attributes)) {
    if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'color') {
      base.deleteAttribute(nombre);
    }
  }
  const unida = mergeGeometries([base, nueva]);
  base.dispose();
  nueva.dispose();
  if (!unida) throw new Error('No se pudieron unir las piezas a la malla fija');
  vieja.dispose();
  fija.geometry = unida;
}

/**
 * Pone la geometría de `piezas` en una malla de la sala (una que se toca o que anima una
 * máquina). Su material pasa a usar el color de los vértices; `tinte` lo multiplica (blanco:
 * los colores tal cual). Devuelve la malla, o `null` si `objeto` no es una malla.
 */
export function vestirMalla(
  objeto: Object3D | undefined,
  piezas: Piezas,
  tinte: ColorRepresentation = 0xffffff,
): Mesh | null {
  const malla = objeto as Mesh | undefined;
  if (!malla?.isMesh || malla.userData[PIEZAS_SUMADAS]) return null;
  malla.userData[PIEZAS_SUMADAS] = true;
  malla.geometry.dispose();
  malla.geometry = piezas.geometria();
  const material = malla.material as MeshLambertMaterial;
  material.vertexColors = true;
  material.color.set(tinte);
  material.needsUpdate = true;
  return malla;
}
