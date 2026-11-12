/**
 * Prueba de carga (T10): `/jugar?prueba=glb` carga un GLB con meshopt y KTX2 y lo hace girar.
 * Sirve para comprobar en el celular que los decodificadores se sirven bien y qué formato
 * de GPU elige el equipo. El renderer definitivo llega en T12.
 */
import {
  Box3,
  HemisphereLight,
  DirectionalLight,
  PerspectiveCamera,
  RGBAFormat,
  RGBA_ASTC_4x4_Format,
  RGBA_BPTC_Format,
  RGBA_ETC2_EAC_Format,
  RGBA_PVRTC_4BPPV1_Format,
  RGBA_S3TC_DXT5_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Mesh, Object3D, Texture } from 'three';
import { pruebaCarga } from '../../signals/prueba-carga';
import { crearCargador } from './cargador';
import { liberarObjeto } from './liberar';

/** Modelo propio generado con `npm run modelo-prueba`: cubo con color ETC1S y normal UASTC. */
export const URL_MODELO_PRUEBA = '/assets/pruebas/cubo.glb';

const NOMBRES_FORMATO = new Map<number, string>([
  [RGB_ETC1_Format, 'ETC1'],
  [RGB_ETC2_Format, 'ETC2 RGB'],
  [RGBA_ETC2_EAC_Format, 'ETC2 RGBA'],
  [RGBA_ASTC_4x4_Format, 'ASTC 4×4'],
  [RGB_S3TC_DXT1_Format, 'BC1'],
  [RGBA_S3TC_DXT5_Format, 'BC3'],
  [RGBA_BPTC_Format, 'BC7'],
  [RGB_PVRTC_4BPPV1_Format, 'PVRTC RGB'],
  [RGBA_PVRTC_4BPPV1_Format, 'PVRTC RGBA'],
  [RGBAFormat, 'RGBA sin comprimir'],
]);

const formatoDe = (textura: Texture): string =>
  NOMBRES_FORMATO.get(textura.format) ?? `formato ${textura.format}`;

/** Arranca la prueba sobre el canvas. Devuelve una función que libera todo. */
export function iniciarPruebaCarga(canvas: HTMLCanvasElement): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
  renderer.info.autoReset = false;
  const escena = new Scene();
  // Dos luces dinámicas como máximo (presupuesto); en el juego el resto va horneado.
  escena.add(new HemisphereLight(0xdde8ff, 0x302820, 1.2));
  const sol = new DirectionalLight(0xffffff, 2);
  sol.position.set(2, 3, 4);
  escena.add(sol);
  const camara = new PerspectiveCamera(45, 1, 0.1, 100);
  camara.position.set(0, 0.8, 5.5);
  camara.lookAt(0, 0, 0);

  const cargador = crearCargador(renderer);
  let detenido = false;
  let modelo: Object3D | undefined;

  pruebaCarga.value = { estado: 'cargando', ms: 0, triangulos: 0, drawCalls: 0, texturas: [] };
  const inicio = performance.now();

  cargador.cargar(URL_MODELO_PRUEBA).then(
    (gltf) => {
      if (detenido) {
        liberarObjeto(gltf.scene);
        return;
      }
      const ms = Math.round(performance.now() - inicio);
      modelo = gltf.scene;
      // Centra el modelo en el origen.
      const centro = new Box3().setFromObject(modelo).getCenter(new Vector3());
      modelo.position.sub(centro);
      escena.add(modelo);

      const texturas = new Set<Texture>();
      modelo.traverse((o) => {
        const material = (o as Mesh).material as Material | Material[] | undefined;
        for (const m of Array.isArray(material) ? material : material ? [material] : []) {
          for (const v of Object.values(m)) if ((v as Texture | null)?.isTexture) texturas.add(v);
        }
      });

      renderer.info.reset();
      renderer.render(escena, camara);
      pruebaCarga.value = {
        estado: 'lista',
        ms,
        triangulos: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls,
        texturas: [...texturas].map(formatoDe),
      };
    },
    (error: unknown) => {
      if (detenido) return;
      console.error('No se pudo cargar el modelo de prueba', error);
      pruebaCarga.value = { ...pruebaCarga.value, estado: 'error' };
    },
  );

  renderer.setAnimationLoop((tiempo) => {
    // El canvas ya tiene su tamaño en píxeles (ajustarCanvas); aquí solo se sigue.
    const { width, height } = canvas;
    renderer.setViewport(0, 0, width, height);
    camara.aspect = width / Math.max(1, height);
    camara.updateProjectionMatrix();
    if (modelo) modelo.rotation.y = tiempo / 2000;
    renderer.info.reset();
    renderer.render(escena, camara);
  });

  return () => {
    detenido = true;
    renderer.setAnimationLoop(null);
    if (modelo) liberarObjeto(modelo);
    cargador.liberar();
    renderer.dispose();
    pruebaCarga.value = { estado: 'inactiva', ms: 0, triangulos: 0, drawCalls: 0, texturas: [] };
  };
}
