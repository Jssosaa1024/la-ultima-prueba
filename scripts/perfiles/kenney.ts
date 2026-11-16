/**
 * Perfil de limpieza `kenney` (T11b): de las piezas de un paquete a un modelo en metros con
 * una sola draw call.
 *
 * 1. Cada pieza va a su posición y giro (unidades del paquete), todas bajo un nodo raíz.
 * 2. Escala del paquete a metros, giro del modelo y `estirar` por eje, o `caja`: las medidas
 *    finales en metros, para que el modelo calce justo en la caja del objeto en `salas.json`
 *    (lo que va encima, como la linterna sobre el escritorio, no queda flotando).
 * 3. Las transformaciones se hornean en los vértices y `flatten` deja todos los nodos hermanos.
 * 4. `palette`: los materiales de color plano (Furniture Kit) se funden en uno con una textura
 *    de paleta pequeña. Mini Shop y Factory Kit ya traen un solo material con `colormap.png`.
 * 5. `join`: las primitivas que comparten material se unen en una. Una pieza = una draw call.
 * 6. `center`: el pivote queda en el centro de la base (y = 0), como espera el motor (T19e).
 *
 * No hay `simplify`: los modelos de Kenney ya son low-poly. El resto lo hace la etapa común.
 */
import { getBounds, Node as NodoGltf } from '@gltf-transform/core';
import type { Document, mat4, Node, vec3, vec4 } from '@gltf-transform/core';
import {
  center,
  dedup,
  flatten,
  join,
  palette,
  prune,
  transformMesh,
} from '@gltf-transform/functions';
import type { EntradaModelo } from '../modelos/lista.ts';

/**
 * Metros por unidad de cada paquete, medidos sobre un objeto de tamaño conocido:
 * el escritorio de Furniture Kit mide 0,384 (0,77 m) y la puerta 1,01 (2 m); el estante de
 * Mini Shop, 0,85 (1,8 m).
 * Factory Kit ya viene en metros (la máquina mide 1,3). KayKit usa una cuadrícula de 1: la mesa
 * mide 1 (0,75 m) y la puerta 2,8 (2,1 m). Sirve igual para KayKit (T19i): un solo material
 * con una textura de degradado, y las piezas se unen igual.
 */
export const ESCALA_PAQUETE: Readonly<Record<string, number>> = {
  'kaykit-furniture-bits': 0.75,
  'kaykit-restaurant-bits': 0.75,
  'kenney-furniture-kit': 2,
  'kenney-mini-shop': 2.1,
  'kenney-factory-kit': 1,
};

/**
 * Lado máximo de la textura de cada paquete. KayKit pinta con una textura de degradado de 1024
 * que se puede bajar hasta 128 sin que se note (lo dice su página), y cada GLB lleva su copia:
 * a 1024 serían 0,7 MB de GPU por modelo. Los demás paquetes usan el máximo general.
 */
export const TEXTURA_PAQUETE: Readonly<Record<string, number>> = {
  'kaykit-furniture-bits': 256,
  'kaykit-restaurant-bits': 256,
};

/** El paquete de un original: la carpeta que sigue a `originales/`. */
export function paqueteDe(original: string): string | null {
  return /\/originales\/([^/#]+)\//.exec(original)?.[1] ?? null;
}

/** Escala a metros de un modelo. Todas sus piezas deben venir del mismo paquete. */
export function escalaDe(entrada: Pick<EntradaModelo, 'archivo' | 'piezas'>): number {
  const paquetes = new Set(entrada.piezas.map((p) => paqueteDe(p.original)));
  if (paquetes.size !== 1) {
    throw new Error(`${entrada.archivo}: todas las piezas deben ser del mismo paquete`);
  }
  const [paquete] = paquetes;
  const escala = paquete ? ESCALA_PAQUETE[paquete] : undefined;
  if (escala === undefined) {
    throw new Error(
      `${entrada.archivo}: no conozco la escala del paquete «${paquete}». ` +
        `Agrégala a ESCALA_PAQUETE en scripts/perfiles/kenney.ts.`,
    );
  }
  return escala;
}

/** Lado máximo de las texturas de un modelo (el de su paquete, o `undefined` = el general). */
export function texturaMaximaDe(entrada: Pick<EntradaModelo, 'piezas'>): number | undefined {
  const lados = entrada.piezas.map((p) => TEXTURA_PAQUETE[paqueteDe(p.original) ?? ''] ?? Infinity);
  const lado = Math.min(...lados);
  return Number.isFinite(lado) ? lado : undefined;
}

/** Cuaternión de un giro alrededor del eje vertical, en grados. */
export function giroY(grados: number): vec4 {
  const r = (grados * Math.PI) / 180 / 2;
  return [0, Math.sin(r), 0, Math.cos(r)];
}

export interface PiezaColocada {
  /** Las escenas de cada pieza ya unidas al documento (con `mergeDocuments`). */
  raices: Node[];
  pos?: vec3 | undefined;
  giro?: number | undefined;
}

/**
 * Aplica el perfil al documento, en el sitio. `piezas` dice qué nodos raíz trajo cada pieza.
 * Al final la escena tiene un solo nodo raíz con el modelo entero.
 */
export async function aplicarPerfilKenney(
  documento: Document,
  piezas: PiezaColocada[],
  opciones: {
    escala: number;
    giro?: number | undefined;
    estirar?: vec3 | undefined;
    /** Medidas finales en metros (ancho, alto, fondo); `null` = proporcional. */
    caja?: [number | null, number | null, number | null] | undefined;
  },
): Promise<void> {
  const raiz = documento.getRoot();
  const escena = raiz.getDefaultScene() ?? raiz.listScenes()[0] ?? documento.createScene();
  raiz.setDefaultScene(escena);

  // 1 y 2: una raíz nueva con la escala, el giro y el estiramiento; cada pieza debajo.
  const [ex, ey, ez] = opciones.estirar ?? [1, 1, 1];
  const s = opciones.escala;
  const giro = documento.createNode('giro').setRotation(giroY(opciones.giro ?? 0));
  const modelo = documento
    .createNode('modelo')
    .setScale([s * ex, s * ey, s * ez])
    .addChild(giro);
  for (const [i, p] of piezas.entries()) {
    const nodo = documento
      .createNode(`pieza-${i}`)
      .setTranslation(p.pos ?? [0, 0, 0])
      .setRotation(giroY(p.giro ?? 0));
    for (const r of p.raices) {
      for (const s of raiz.listScenes()) s.removeChild(r);
      r.getParentNode()?.removeChild(r);
      nodo.addChild(r);
    }
    giro.addChild(nodo);
  }
  for (const otra of raiz.listScenes()) {
    for (const hijo of otra.listChildren()) otra.removeChild(hijo);
    if (otra !== escena) otra.dispose();
  }
  escena.addChild(modelo);

  // 2b: con `caja`, el estiramiento sale de las medidas: cada eje queda con la suya en metros.
  if (opciones.caja) {
    const { min, max } = getBounds(escena);
    const lados = max.map((v, i) => v - (min[i] ?? 0));
    const actual = modelo.getScale();
    const [cx, cy, cz] = opciones.caja.map((medida, i) => {
      const lado = lados[i] ?? 0;
      return medida !== null && lado > 1e-6 ? medida / lado : null;
    });
    // Un eje sin medida (el fondo de un plano) sigue la media de los otros dos.
    const conocidos = [cx, cy, cz].filter((f): f is number => f !== null);
    const media = conocidos.reduce((a, b) => a + b, 0) / Math.max(1, conocidos.length);
    modelo.setScale([
      (actual[0] ?? 1) * (cx ?? media),
      (actual[1] ?? 1) * (cy ?? media),
      (actual[2] ?? 1) * (cz ?? media),
    ]);
  }

  // 3: la matriz de cada nodo con malla pasa a sus vértices y el nodo queda en la raíz de la
  // escena, sin transformación. Así un `estirar` no uniforme con piezas giradas no pierde nada
  // (un nodo solo guarda traslación, giro y escala). Primero se miden todas las matrices.
  const conMalla: Array<[Node, mat4]> = [];
  const recorrer = (nodo: Node): void => {
    if (nodo.getMesh()) conMalla.push([nodo, nodo.getWorldMatrix()]);
    nodo.listChildren().forEach(recorrer);
  };
  recorrer(modelo);
  for (const [nodo, matriz] of conMalla) {
    let malla = nodo.getMesh();
    if (!malla) continue;
    // Una malla usada por dos nodos se copia: cada uno lleva su propia transformación.
    if (malla.listParents().filter((p) => p instanceof NodoGltf).length > 1) {
      malla = malla.clone();
      nodo.setMesh(malla);
    }
    transformMesh(malla, matriz);
    nodo.getParentNode()?.removeChild(nodo);
    nodo.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    escena.addChild(nodo);
  }
  escena.removeChild(modelo);
  modelo.dispose();

  // 4 a 6.
  await documento.transform(
    flatten(),
    // Las piezas repetidas traen cada una su copia del material: sin unirlas, `join` no puede.
    dedup(),
    palette({ min: 2, blockSize: 4 }),
    join({ keepNamed: false }),
    center({ pivot: 'below' }),
    prune(),
  );
}
