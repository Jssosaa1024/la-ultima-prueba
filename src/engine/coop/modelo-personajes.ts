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

/** Lo que hay que saber del paquete. Se confirma con el paquete descargado. */
export const PAQUETE_PERSONAJES = {
  nombre: 'kenney-mini-characters',
  /** Ids del manifiesto, uno por personaje (el orden es el de `varianteDe`). */
  archivos: [
    'compartido/estudiante-a',
    'compartido/estudiante-b',
    'compartido/estudiante-c',
    'compartido/estudiante-d',
  ],
  clips: { quieto: 'idle', caminar: 'walk' },
  /** Hueso y eje local que levantan el brazo derecho hacia afuera (saludo por código). */
  saludo: { hueso: 'arm-right', eje: new Vector3(0, 0, 1), signo: 1 },
  /** Huesos cuya ropa se pinta del color del jugador: la camiseta va con el torso. */
  huesosUniforme: /^(torso|body|chest|spine)/i,
  /** Los de Kenney miran hacia +Z; el jugador, hacia −Z. */
  giro: Math.PI,
  /** Metros por segundo del clip `walk` a rapidez 1 (medido con el paquete). */
  velocidadCaminar: 1.2,
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
      if ((o as SkinnedMesh).isSkinnedMesh)
        marcarUniforme(o as SkinnedMesh, paquete.huesosUniforme);
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
  const { hueso, eje, signo } = paquete.saludo;
  return {
    nombre: paquete.nombre,
    variantes,
    clips: { quieto, caminar, saludar: clipSaludo(hueso, eje, signo) },
    velocidadCaminar: paquete.velocidadCaminar,
    liberar,
  };
}
