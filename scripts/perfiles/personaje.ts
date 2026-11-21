/**
 * Perfil de limpieza para personajes animados (T83c), en lugar del de `kenney.ts` cuando la
 * entrada de `art/modelos.json` lleva `animado`. El de los objetos hornea las transformaciones
 * en los vértices y aplana los nodos: a un personaje le rompería el esqueleto. Este no:
 *
 * 1. Deja solo los clips de `animado.clips` (Mini Characters trae 32 en cada GLB).
 * 2. Une las mallas que comparten esqueleto (cuerpo y cabeza en Mini Characters) en una sola,
 *    con `joinPrimitives` (`join` se salta las mallas con piel):
 *    una draw call por personaje en lugar de dos. Solo si los huesos y sus matrices de enlace
 *    son los mismos; si no, falla en lugar de deformarlo.
 * 3. Quita las tangentes: los materiales del juego son Lambert, sin mapa de normales. Y marca
 *    la camiseta (`_TINTE`) mirando su color en la paleta (`marcarCamiseta`).
 * 4. Escala el nodo raíz para que el personaje mida `animado.alto` metros, con los pies en
 *    y = 0. La escala va en el nodo (no en los vértices): el esqueleto y los clips no cambian.
 *
 * El giro no se toca: los de Kenney miran a +Z y el motor los voltea (`modelo-personajes.ts`).
 * El resto lo hace la etapa común (quantize ya corrige las matrices de enlace).
 */
import { getBounds } from '@gltf-transform/core';
import type { Document, Node, Primitive, Skin } from '@gltf-transform/core';
import { dedup, joinPrimitives, prune } from '@gltf-transform/functions';
import { leerPng } from '../modelos/png.ts';

export interface OpcionesPersonaje {
  /** Clips que se quedan, con su nombre en el paquete. */
  clips: string[];
  /** Alto final en metros. */
  alto: number;
  /**
   * Huesos de la camiseta: el primero (el torso) dice de qué color es. Sus vértices de ese
   * color, y los de los demás huesos (las mangas), quedan con `_TINTE` = 1.
   */
  uniforme?: string[] | undefined;
}

/**
 * La paleta de Mini Characters (`colormap.png`, 512 × 512) son bloques de 64 × 128 px, uno por
 * color, cada uno con un degradado vertical. Un color de la ropa es un bloque, no un píxel.
 */
const BLOQUE_PALETA: readonly [number, number] = [64, 128];
/** El hueso de la cabeza: su color más común es la piel. */
const HUESO_CABEZA = 'head';

/**
 * Marca la camiseta con el atributo `_TINTE` (1 = se pinta del color del jugador; el motor lo
 * lee como `tinte`). Cada triángulo toma el bloque de la paleta del centro de sus UV y el hueso
 * que más lo mueve. La camiseta es el bloque del primer hueso de `huesos` (el torso) que más se
 * repite en él y en los demás (las mangas), sin contar el de la piel; se marcan los triángulos de
 * esos huesos con ese bloque. Así entran las mangas y quedan fuera las manos, un overol o un
 * collar. Devuelve cuántos vértices quedaron marcados.
 */
export function marcarCamiseta(
  documento: Document,
  primitiva: Primitive,
  piel: Skin,
  huesos: string[],
): number {
  const imagen = primitiva.getMaterial()?.getBaseColorTexture()?.getImage();
  const uv = primitiva.getAttribute('TEXCOORD_0');
  const juntas = primitiva.getAttribute('JOINTS_0');
  const pesos = primitiva.getAttribute('WEIGHTS_0');
  const indices = primitiva.getIndices();
  if (!imagen || !uv || !juntas || !pesos || !indices) {
    throw new Error('Para marcar la camiseta hacen falta la paleta, las UV, los pesos e índices');
  }
  const paleta = leerPng(imagen);
  const columnas = Math.max(1, Math.floor(paleta.ancho / BLOQUE_PALETA[0]));
  const nombres = piel.listJoints().map((j) => j.getName());
  const n = uv.getCount();
  // El hueso que más mueve cada vértice.
  const hueso = new Array<string>(n);
  const j: number[] = [];
  const w: number[] = [];
  for (let v = 0; v < n; v++) {
    juntas.getElement(v, j);
    pesos.getElement(v, w);
    let mejor = 0;
    for (let k = 1; k < w.length; k++) if ((w[k] ?? 0) > (w[mejor] ?? 0)) mejor = k;
    hueso[v] = nombres[j[mejor] ?? 0] ?? '';
  }
  // Bloque de la paleta y hueso de cada triángulo.
  const triangulos = Math.floor(indices.getCount() / 3);
  const bloque = new Int32Array(triangulos);
  const huesoTri = new Array<string>(triangulos);
  const t: number[] = [];
  for (let f = 0; f < triangulos; f++) {
    let u = 0;
    let v = 0;
    const votos = new Map<string, number>();
    for (let k = 0; k < 3; k++) {
      const vertice = indices.getScalar(f * 3 + k);
      uv.getElement(vertice, t);
      u += (t[0] ?? 0) / 3;
      v += (t[1] ?? 0) / 3;
      const h = hueso[vertice] ?? '';
      votos.set(h, (votos.get(h) ?? 0) + 1);
    }
    huesoTri[f] = [...votos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const bx = Math.floor((Math.min(0.9999, Math.max(0, u)) * paleta.ancho) / BLOQUE_PALETA[0]);
    const by = Math.floor((Math.min(0.9999, Math.max(0, v)) * paleta.alto) / BLOQUE_PALETA[1]);
    bloque[f] = by * columnas + bx;
  }
  // La piel: el bloque más común de la cabeza (la cara). Nunca es la camiseta.
  const contar = (filtro: (h: string) => boolean): Map<number, number> => {
    const conteo = new Map<number, number>();
    for (let f = 0; f < triangulos; f++) {
      if (filtro(huesoTri[f] ?? ''))
        conteo.set(bloque[f] ?? 0, (conteo.get(bloque[f] ?? 0) ?? 0) + 1);
    }
    return conteo;
  };
  const bloquePiel = [...contar((h) => h === HUESO_CABEZA)].sort((a, b) => b[1] - a[1])[0]?.[0];
  // La camiseta: de los bloques del torso (sin la piel), el que más se repite en el torso y en
  // las mangas juntos. Un overol o un cinturón están en el torso, pero no en los brazos.
  const torso = contar((h) => h === huesos[0]);
  const mangas = contar((h) => huesos.slice(1).includes(h));
  const camiseta = [...torso]
    .filter(([b]) => b !== bloquePiel)
    .map(([b, c]) => [b, c + (mangas.get(b) ?? 0)] as const)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (camiseta === undefined) throw new Error(`Ningún triángulo se mueve con «${huesos[0]}»`);
  const tinte = new Float32Array(n);
  for (let f = 0; f < triangulos; f++) {
    if (bloque[f] !== camiseta || !huesos.includes(huesoTri[f] ?? '')) continue;
    for (let k = 0; k < 3; k++) tinte[indices.getScalar(f * 3 + k)] = 1;
  }
  const bufer = documento.getRoot().listBuffers()[0] ?? documento.createBuffer();
  primitiva.setAttribute(
    '_TINTE',
    documento.createAccessor().setType('SCALAR').setArray(tinte).setBuffer(bufer),
  );
  return tinte.reduce((a, b) => a + b, 0);
}

/** Mismos huesos en el mismo orden y las mismas matrices de enlace. */
function mismoEsqueleto(a: Skin, b: Skin): boolean {
  const ja = a.listJoints();
  const jb = b.listJoints();
  if (ja.length !== jb.length || ja.some((j, i) => j !== jb[i])) return false;
  const ma = a.getInverseBindMatrices()?.getArray();
  const mb = b.getInverseBindMatrices()?.getArray();
  if (!ma || !mb || ma.length !== mb.length) return ma === mb;
  for (let i = 0; i < ma.length; i++)
    if (Math.abs((ma[i] ?? 0) - (mb[i] ?? 0)) > 1e-6) return false;
  return true;
}

/** Aplica el perfil en el sitio. `raices` son los nodos raíz que trajo la única pieza. */
export async function aplicarPerfilPersonaje(
  documento: Document,
  raices: Node[],
  opciones: OpcionesPersonaje,
): Promise<void> {
  const raiz = documento.getRoot();
  const escena = raiz.getDefaultScene() ?? raiz.listScenes()[0] ?? documento.createScene();
  raiz.setDefaultScene(escena);
  for (const r of raices) if (!escena.listChildren().includes(r)) escena.addChild(r);
  for (const otra of raiz.listScenes()) if (otra !== escena) otra.dispose();

  // 1. Solo los clips que se usan.
  const nombres = new Set(raiz.listAnimations().map((a) => a.getName()));
  const faltan = opciones.clips.filter((c) => !nombres.has(c));
  if (faltan.length > 0) throw new Error(`El personaje no trae los clips: ${faltan.join(', ')}`);
  for (const a of raiz.listAnimations()) if (!opciones.clips.includes(a.getName())) a.dispose();

  // 2. Una malla por personaje: las demás pasan sus primitivas a la primera con su mismo
  //    esqueleto, y después se funden (paso 3b).
  const conPiel = raiz.listNodes().filter((n) => n.getMesh() && n.getSkin());
  const [base, ...otras] = conPiel;
  const mallaBase = base?.getMesh();
  const pielBase = base?.getSkin();
  if (base && mallaBase && pielBase) {
    for (const n of otras) {
      const piel = n.getSkin();
      const malla = n.getMesh();
      if (!piel || !malla || !mismoEsqueleto(pielBase, piel)) {
        throw new Error(`${n.getName()}: no comparte el esqueleto de ${base.getName()}`);
      }
      // En glTF la transformación del nodo de una malla con piel no cuenta: no hay nada que pasar.
      for (const p of malla.listPrimitives()) {
        malla.removePrimitive(p);
        mallaBase.addPrimitive(p);
      }
      n.dispose();
      malla.dispose();
    }
  }

  // 3. Sin tangentes.
  for (const malla of raiz.listMeshes()) {
    for (const p of malla.listPrimitives()) {
      const tangentes = p.getAttribute('TANGENT');
      if (tangentes) {
        p.setAttribute('TANGENT', null);
        if (tangentes.listParents().length <= 1) tangentes.dispose();
      }
    }
  }

  // 3b. Las primitivas de la malla del personaje, en una (`join` no toca mallas con piel).
  const primitivas = mallaBase?.listPrimitives() ?? [];
  if (mallaBase && primitivas.length > 1) {
    const unida = joinPrimitives(primitivas);
    for (const p of primitivas) {
      mallaBase.removePrimitive(p);
      p.dispose();
    }
    mallaBase.addPrimitive(unida);
  }

  // 3c. La camiseta, para pintarla del color del jugador.
  const unica = mallaBase?.listPrimitives()[0];
  if (opciones.uniforme && unica && pielBase) {
    marcarCamiseta(documento, unica, pielBase, opciones.uniforme);
  }

  await documento.transform(dedup(), prune());

  // 4. Escala a metros en los nodos raíz (los huesos y las mallas cuelgan de ellos).
  const { min, max } = getBounds(escena);
  const alto = (max[1] ?? 0) - (min[1] ?? 0);
  if (!(alto > 1e-6)) throw new Error('El personaje no tiene altura');
  const s = opciones.alto / alto;
  for (const n of escena.listChildren()) {
    const [x, y, z] = n.getScale();
    n.setScale([x * s, y * s, z * s]);
    // Pies en el piso: el punto más bajo queda en y = 0.
    const [tx, ty, tz] = n.getTranslation();
    n.setTranslation([tx, -((min[1] ?? 0) - ty) * s, tz]);
  }
}
