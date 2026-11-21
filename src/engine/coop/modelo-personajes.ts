/**
 * Personajes del paquete CC0 (T83c): de los GLB publicados a un `ModeloPersonajes`.
 *
 * Paquete: Kenney Mini Characters (CC0). `optimize-models` publica un GLB por personaje en
 * `public/assets/salas/compartido/` con solo los clips que se usan. Todos comparten el
 * esqueleto, así que los clips del primero sirven para los demás (cada GLB se carga aparte y
 * GLTFLoader no les cambia el nombre a los huesos). Si ninguno está en el manifiesto, el
 * cooperativo sigue con el personaje de prueba hecho por código.
 */
import { BufferAttribute, Group, Vector3 } from 'three';
import type { Object3D, SkinnedMesh } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { liberarObjeto } from '../carga/liberar';
import { urlDeAsset } from '../carga/manifiesto';
import type { IndiceAssets } from '../carga/manifiesto';
import { aLambert } from '../salas/modelos';
import { clipSaludo } from './personajes';
import type { ModeloPersonajes } from './personajes';

/**
 * Clip `walk` de Mini Characters (medido en el GLB): un paso doble en 0,667 s con las piernas
 * a ±60° desde la cadera, que queda a 0,18 unidades del piso. El pipeline escala el personaje
 * de 0,776 unidades a 1,4 m (`art/modelos.json`): más alto, la cabeza grande lo hacía muy ancho.
 */
const ALTO_MINI_M = 1.4;
const ESCALA_MINI = ALTO_MINI_M / 0.776;
const PIERNA_M = 0.18 * ESCALA_MINI;
const CICLO_WALK_S = 0.667;

/** Lo que hay que saber del paquete (Kenney Mini Characters 2.0). */
export const PAQUETE_PERSONAJES = {
  nombre: 'kenney-mini-characters',
  /**
   * Ids del manifiesto, uno por personaje, en el orden de `varianteDe` (ámbar, turquesa,
   * violeta, coral): character-female-b, male-a, female-c y male-f.
   */
  archivos: [
    'compartido/estudiante-a',
    'compartido/estudiante-b',
    'compartido/estudiante-c',
    'compartido/estudiante-d',
  ],
  clips: { quieto: 'idle', caminar: 'walk' },
  /**
   * Saludo por código: el brazo derecho (a −X, porque miran a +Z) sube con un giro negativo
   * alrededor de Z. En `idle` cuelga a 45° bajo la horizontal; con el 65 % del saludo queda unos
   * 50° por encima, hacia afuera: más arriba se esconde detrás de la cabeza grande.
   */
  saludo: { hueso: 'arm-right', eje: new Vector3(0, 0, 1), signo: -1, amplitud: 0.65 },
  /**
   * Si el GLB no trae la camiseta marcada (`_TINTE`, de `optimize-models`), se pinta lo que
   * mueve el torso.
   */
  huesosUniforme: /^torso$/,
  /** El alias, un poco encima de la cabeza. */
  alturaEtiqueta: ALTO_MINI_M + 0.16,
  /** Los de Kenney miran hacia +Z; el jugador, hacia −Z. */
  giro: Math.PI,
  /** Metros por segundo del clip `walk` a rapidez 1: dos pasos por ciclo, la cuerda de ±60°. */
  velocidadCaminar: (2 * 2 * PIERNA_M * Math.sin(Math.PI / 3)) / CICLO_WALK_S,
};

/**
 * Marca con `tinte` = 1 los vértices cuyo hueso de más peso es del uniforme. Así no depende de
 * dónde está la camiseta en la paleta de colores. No toca una geometría que ya lo tiene.
 * Devuelve cuántos vértices quedaron marcados.
 */
export function marcarUniforme(malla: SkinnedMesh, huesos: RegExp): number {
  const g = malla.geometry;
  if (g.getAttribute('tinte')) return 0;
  const indices = g.getAttribute('skinIndex');
  const pesos = g.getAttribute('skinWeight');
  const n = g.getAttribute('position').count;
  const tinte = new Float32Array(n);
  const delUniforme = malla.skeleton.bones.map((b) => huesos.test(b.name));
  let marcados = 0;
  if (indices && pesos) {
    for (let v = 0; v < n; v++) {
      let mejor = 0;
      let peso = -1;
      for (let k = 0; k < 4; k++) {
        const w = pesos.getComponent(v, k);
        if (w > peso) {
          peso = w;
          mejor = indices.getComponent(v, k);
        }
      }
      if (delUniforme[mejor]) {
        tinte[v] = 1;
        marcados++;
      }
    }
  }
  g.setAttribute('tinte', new BufferAttribute(tinte, 1));
  return marcados;
}

/**
 * Carga los personajes publicados. `null` si no hay ninguno en el manifiesto, si falla la
 * descarga o si al primero le falta un clip: entonces sigue el de prueba.
 */
export async function cargarModeloPersonajes(
  indice: IndiceAssets,
  cargar: (url: string) => Promise<GLTF>,
  paquete = PAQUETE_PERSONAJES,
): Promise<ModeloPersonajes | null> {
  const urls = paquete.archivos.flatMap((id) => urlDeAsset(indice, id, 'glb') ?? []);
  if (urls.length === 0) return null;
  const cargados = await Promise.all(
    urls.map((url) =>
      cargar(url).catch((error: unknown) => {
        console.warn(`No se pudo cargar el personaje ${url}`, error);
        return null;
      }),
    ),
  );
  const gltfs = cargados.filter((g): g is GLTF => g !== null);
  const primero = gltfs[0];
  const quieto = primero?.animations.find((c) => c.name === paquete.clips.quieto);
  const caminar = primero?.animations.find((c) => c.name === paquete.clips.caminar);
  const variantes: Object3D[] = [];
  for (const g of gltfs) {
    aLambert(g.scene);
    g.scene.traverse((o) => {
      const malla = o as SkinnedMesh;
      if (!malla.isSkinnedMesh) return;
      // La camiseta que marcó el pipeline por su color (GLTFLoader nombra `_TINTE` como `_tinte`).
      const marcada = malla.geometry.getAttribute('_tinte');
      if (marcada) {
        malla.geometry.setAttribute('tinte', marcada);
        malla.geometry.deleteAttribute('_tinte');
      } else marcarUniforme(malla, paquete.huesosUniforme);
    });
    // El giro va en un nodo aparte: la raíz del personaje la mueve `personajes.ts`.
    const raiz = new Group();
    raiz.name = g.scene.name || 'personaje';
    g.scene.rotation.y = paquete.giro;
    raiz.add(g.scene);
    variantes.push(raiz);
  }
  const liberar = (): void => {
    for (const v of variantes) {
      v.traverse((o) => {
        if ((o as SkinnedMesh).isSkinnedMesh) (o as SkinnedMesh).skeleton.dispose();
      });
      liberarObjeto(v);
    }
  };
  if (!quieto || !caminar) {
    console.warn('El paquete de personajes no trae los clips quieto y caminar; queda la prueba');
    liberar();
    return null;
  }
  const { hueso, eje, signo, amplitud } = paquete.saludo;
  return {
    nombre: paquete.nombre,
    variantes,
    clips: { quieto, caminar, saludar: clipSaludo(hueso, eje, signo, amplitud) },
    velocidadCaminar: paquete.velocidadCaminar,
    alturaEtiqueta: paquete.alturaEtiqueta,
    liberar,
  };
}
