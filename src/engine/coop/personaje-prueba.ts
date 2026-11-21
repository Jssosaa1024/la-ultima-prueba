/**
 * Personaje de prueba hecho por código (T83c): un estudiante de cajas con esqueleto y sus tres
 * animaciones (quieto, caminar y saludar). Sirve mientras no esté publicado el GLB del paquete
 * CC0 (o si no se puede descargar) y en las pruebas de unidad, sin DOM ni red.
 *
 * Mira hacia −Z, como el jugador, con los pies en y = 0 y en metros. Unos 170 triángulos y una
 * sola draw call. La camiseta y las mangas llevan `tinte = 1`: se pintan del color del jugador.
 */
import {
  AnimationClip,
  Bone,
  BoxGeometry,
  BufferAttribute,
  Group,
  MeshLambertMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clipSaludo } from './personajes';
import type { ModeloPersonajes } from './personajes';

/** Largo de la pierna, de la cadera al piso. */
const PIERNA = 0.86;
/** Medio ángulo del paso al caminar. */
const PASO_GRADOS = 24;
/** Duración de un paso doble (izquierdo y derecho). */
const CICLO_CAMINAR_S = 0.9;
/**
 * Metros por segundo del clip de caminar a rapidez 1: dos pasos por ciclo y en cada uno el pie
 * recorre la cuerda del arco de la pierna.
 */
export const VELOCIDAD_CAMINAR_PRUEBA =
  (2 * 2 * PIERNA * Math.sin((PASO_GRADOS * Math.PI) / 180)) / CICLO_CAMINAR_S;

/** Huesos, en orden (el índice es el de `skinIndex`). */
const HUESOS = [
  'cadera',
  'torso',
  'cabeza',
  'brazo-izq',
  'brazo-der',
  'pierna-izq',
  'pierna-der',
] as const;
type Hueso = (typeof HUESOS)[number];

/** Tonos de piel y de pelo de cada variante: cuatro estudiantes distintos. */
const VARIANTES: ReadonlyArray<{ piel: number; pelo: number; pantalon: number }> = [
  { piel: 0xc58c64, pelo: 0x2b1d14, pantalon: 0x2f3b52 },
  { piel: 0x8d5a3b, pelo: 0x141010, pantalon: 0x3a3a3a },
  { piel: 0xe2b08a, pelo: 0x6b4423, pantalon: 0x34425e },
  { piel: 0xa66e48, pelo: 0x3b2a1e, pantalon: 0x47392e },
];

const rgb = (hex: number): [number, number, number] => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

/** Una caja en (x, y, z) pegada al hueso `hueso`, con su color y si es del uniforme. */
function pieza(
  tam: [number, number, number],
  pos: [number, number, number],
  hueso: Hueso,
  color: number,
  tinte = 0,
): BufferGeometry {
  const g = new BoxGeometry(...tam).toNonIndexed();
  g.translate(...pos);
  const n = g.getAttribute('position').count;
  const [r, v, a] = rgb(color);
  const colores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colores.set([r, v, a], i * 3);
  g.setAttribute('color', new BufferAttribute(colores, 3));
  g.setAttribute('tinte', new BufferAttribute(new Float32Array(n).fill(tinte), 1));
  const indice = HUESOS.indexOf(hueso);
  const huesos = new Uint16Array(n * 4);
  const pesos = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    huesos[i * 4] = indice;
    pesos[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new BufferAttribute(huesos, 4));
  g.setAttribute('skinWeight', new BufferAttribute(pesos, 4));
  // Las normales de BoxGeometry ya vienen; las UV no se usan.
  g.deleteAttribute('uv');
  return g;
}

/** Geometría de un estudiante: la camiseta blanca para que el tinte quede con su color pleno. */
function geometria(v: { piel: number; pelo: number; pantalon: number }): BufferGeometry {
  const camiseta = 0xf2f2f2;
  const partes = [
    // Piernas y zapatos (cuelgan de la cadera, a 0,86 m).
    pieza([0.15, PIERNA - 0.06, 0.17], [-0.1, (PIERNA + 0.06) / 2, 0], 'pierna-izq', v.pantalon),
    pieza([0.15, PIERNA - 0.06, 0.17], [0.1, (PIERNA + 0.06) / 2, 0], 'pierna-der', v.pantalon),
    pieza([0.16, 0.07, 0.24], [-0.1, 0.035, -0.03], 'pierna-izq', 0x222222),
    pieza([0.16, 0.07, 0.24], [0.1, 0.035, -0.03], 'pierna-der', 0x222222),
    // Torso con la camiseta del uniforme.
    pieza([0.4, 0.56, 0.24], [0, 1.15, 0], 'torso', camiseta, 1),
    // Brazos: manga del uniforme arriba y la mano (piel) abajo.
    pieza([0.11, 0.28, 0.13], [-0.27, 1.27, 0], 'brazo-izq', camiseta, 1),
    pieza([0.11, 0.28, 0.13], [0.27, 1.27, 0], 'brazo-der', camiseta, 1),
    pieza([0.09, 0.3, 0.1], [-0.27, 0.98, 0], 'brazo-izq', v.piel),
    pieza([0.09, 0.3, 0.1], [0.27, 0.98, 0], 'brazo-der', v.piel),
    // Cabeza, pelo y ojos hacia −Z (hacia donde mira).
    pieza([0.26, 0.28, 0.26], [0, 1.6, 0], 'cabeza', v.piel),
    pieza([0.28, 0.08, 0.28], [0, 1.77, 0.01], 'cabeza', v.pelo),
    pieza([0.28, 0.18, 0.06], [0, 1.66, 0.13], 'cabeza', v.pelo),
    pieza([0.05, 0.05, 0.02], [-0.06, 1.62, -0.135], 'cabeza', 0x1a1a1a),
    pieza([0.05, 0.05, 0.02], [0.06, 1.62, -0.135], 'cabeza', 0x1a1a1a),
  ];
  const g = mergeGeometries(partes);
  for (const p of partes) p.dispose();
  if (!g) throw new Error('No se pudo armar el personaje de prueba');
  g.computeBoundingSphere();
  return g;
}

/** Posición de cada hueso respecto a su padre, y el padre. */
const POSE: Readonly<Record<Hueso, { padre: Hueso | null; pos: [number, number, number] }>> = {
  cadera: { padre: null, pos: [0, PIERNA, 0] },
  torso: { padre: 'cadera', pos: [0, 0.02, 0] },
  cabeza: { padre: 'torso', pos: [0, 0.6, 0] },
  'brazo-izq': { padre: 'torso', pos: [-0.27, 0.53, 0] },
  'brazo-der': { padre: 'torso', pos: [0.27, 0.53, 0] },
  'pierna-izq': { padre: 'cadera', pos: [-0.1, 0, 0] },
  'pierna-der': { padre: 'cadera', pos: [0.1, 0, 0] },
};

function crearVariante(i: number, material: MeshLambertMaterial): Group {
  const v = VARIANTES[i % VARIANTES.length] ?? VARIANTES[0];
  if (!v) throw new Error('Sin variantes');
  const huesos = new Map<Hueso, Bone>();
  for (const nombre of HUESOS) {
    const b = new Bone();
    b.name = nombre;
    b.position.set(...POSE[nombre].pos);
    huesos.set(nombre, b);
  }
  for (const nombre of HUESOS) {
    const padre = POSE[nombre].padre;
    if (padre) huesos.get(padre)?.add(huesos.get(nombre) as Bone);
  }
  const lista = HUESOS.map((n) => huesos.get(n) as Bone);
  const malla = new SkinnedMesh(geometria(v), material);
  malla.name = 'cuerpo';
  malla.add(lista[0] as Bone);
  malla.bind(new Skeleton(lista));
  const raiz = new Group();
  raiz.name = `estudiante-${i}`;
  raiz.add(malla);
  return raiz;
}

const EJE_X = new Vector3(1, 0, 0);
const EJE_Z = new Vector3(0, 0, 1);

/** Pista de giro de un hueso alrededor de un eje, con los ángulos en grados. */
function giro(
  hueso: Hueso,
  eje: Vector3,
  tiempos: number[],
  grados: number[],
): QuaternionKeyframeTrack {
  const q = new Quaternion();
  const valores = grados.flatMap((g) => q.setFromAxisAngle(eje, (g * Math.PI) / 180).toArray());
  return new QuaternionKeyframeTrack(`${hueso}.quaternion`, tiempos, valores);
}

function clips(): ModeloPersonajes['clips'] {
  // Quieto: respira (el torso se inclina un poco) y los brazos se mecen apenas.
  const quieto = new AnimationClip('quieto', 2.4, [
    giro('torso', EJE_X, [0, 1.2, 2.4], [0, 2, 0]),
    giro('brazo-izq', EJE_Z, [0, 1.2, 2.4], [-3, -5, -3]),
    giro('brazo-der', EJE_Z, [0, 1.2, 2.4], [3, 5, 3]),
  ]);
  // Caminar: piernas y brazos opuestos; la cadera sube un poco en cada paso.
  const c = CICLO_CAMINAR_S;
  const t = [0, c / 4, c / 2, (3 * c) / 4, c];
  const p = PASO_GRADOS;
  const caminar = new AnimationClip('caminar', c, [
    giro('pierna-izq', EJE_X, t, [p, 0, -p, 0, p]),
    giro('pierna-der', EJE_X, t, [-p, 0, p, 0, -p]),
    giro('brazo-izq', EJE_X, t, [-0.8 * p, 0, 0.8 * p, 0, -0.8 * p]),
    giro('brazo-der', EJE_X, t, [0.8 * p, 0, -0.8 * p, 0, 0.8 * p]),
    new VectorKeyframeTrack('cadera.position', t, [
      0,
      PIERNA - 0.03,
      0,
      0,
      PIERNA,
      0,
      0,
      PIERNA - 0.03,
      0,
      0,
      PIERNA,
      0,
      0,
      PIERNA - 0.03,
      0,
    ]),
  ]);
  return { quieto, caminar, saludar: clipSaludo('brazo-der', EJE_Z) };
}

/** El modelo de prueba completo: cuatro variantes con un solo material compartido. */
export function crearModeloDePrueba(): ModeloPersonajes {
  const material = new MeshLambertMaterial({ vertexColors: true });
  const variantes = VARIANTES.map((_, i) => crearVariante(i, material));
  return {
    nombre: 'prueba',
    variantes,
    clips: clips(),
    velocidadCaminar: VELOCIDAD_CAMINAR_PRUEBA,
    liberar() {
      material.dispose();
      for (const v of variantes) {
        v.traverse((o) => {
          const m = o as SkinnedMesh;
          if (m.isSkinnedMesh) {
            m.geometry.dispose();
            m.skeleton.dispose();
          }
        });
      }
    },
  };
}
