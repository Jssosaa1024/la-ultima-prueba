import { SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import type { PerspectiveCamera } from 'three';

/**
 * Renderer WebGL2 del juego (T12).
 *
 * El tamaño del canvas en píxeles lo fija `ajustarCanvas` (engine/pantalla.ts), con el DPR
 * limitado a 1,25. Aquí el renderer trabaja con pixel ratio 1 sobre ese búfer, y en cada
 * cuadro `seguirTamano` lo alinea si el canvas cambió (girar el teléfono, teclado, zoom).
 */
export function crearRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    // Sin antialias: en GPU de gama baja cuesta mucho; FXAA solo en calidad alta (más adelante).
    antialias: false,
    powerPreference: 'default',
    stencil: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x111418, 1);
  renderer.setPixelRatio(1);
  // Las métricas (panel ?debug=1) leen info.render por cuadro; se reinicia a mano.
  renderer.info.autoReset = false;
  return renderer;
}

/** Ajusta el renderer y la cámara al tamaño actual del búfer del canvas. */
export function seguirTamano(renderer: WebGLRenderer, camara: PerspectiveCamera): void {
  const canvas = renderer.domElement;
  const ancho = Math.max(1, canvas.width);
  const alto = Math.max(1, canvas.height);
  const aspecto = ancho / alto;
  const tamano = renderer.getDrawingBufferSize(TAMANO);
  // También se compara el aspecto: el canvas ya tiene su tamaño cuando se crea el renderer,
  // así que en el primer cuadro el búfer coincide pero la cámara aún no sabe la proporción.
  if (tamano.x === ancho && tamano.y === alto && camara.aspect === aspecto) return;
  // updateStyle = false: el CSS del canvas (100 % de la pantalla) lo maneja la interfaz.
  renderer.setSize(ancho, alto, false);
  camara.aspect = aspecto;
  camara.updateProjectionMatrix();
}

const TAMANO = new Vector2();
