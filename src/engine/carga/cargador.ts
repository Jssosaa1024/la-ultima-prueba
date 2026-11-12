import type { WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export interface Cargador {
  /** Descarga y decodifica un GLB con meshopt y texturas KTX2. */
  cargar(url: string): Promise<GLTF>;
  /** Detiene los workers del transcodificador. Llamar al salir del juego. */
  liberar(): void;
}

/**
 * Cargador de modelos (T10): GLTFLoader + MeshoptDecoder + KTX2Loader.
 *
 * Decodificadores, servidos desde el propio sitio y sin CDN:
 * - meshopt es un módulo JS con su wasm incluido: entra en el bundle.
 * - El transcodificador Basis (basis_transcoder.js + .wasm) lo referencia KTX2Loader con
 *   `new URL(…, import.meta.url)`; Vite lo publica en /_astro/ con hash en el nombre
 *   (caché inmutable en public/_headers). Por eso no se llama a `setTranscoderPath`.
 *
 * KTX2Loader elige el formato de GPU que soporta el equipo (ETC2 o ASTC en celulares,
 * BC en PC) con `detectSupport`, por eso necesita el renderer.
 */
export function crearCargador(renderer: WebGLRenderer): Cargador {
  const ktx2 = new KTX2Loader()
    // Dos workers bastan: cada uno carga su propia copia del wasm y la memoria es poca (2 GB).
    .setWorkerLimit(2)
    .detectSupport(renderer);
  const gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  return {
    cargar: (url) => gltf.loadAsync(url),
    liberar: () => ktx2.dispose(),
  };
}
