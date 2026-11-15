/**
 * Lo que el motor carga al abrir el panel `?debug=1`: el medidor de métricas (T11m) y el
 * controlador de la prueba de estrés (T11o–T11r). Con el panel cerrado no existe.
 */
import type { Camera, Object3D, WebGLRenderer } from 'three';
import { pixelRatioForzado } from '../signals/pantalla';
import { crearControladorEstres } from './estres/controlador';
import { crearMedidor } from './medidor';
import type { MedidorMotor } from './medidor';

export interface OpcionesHerramientas {
  renderer: WebGLRenderer;
  escena: Object3D;
  camara: Camera;
  canvas: HTMLCanvasElement;
  sala: () => string | null;
  raizSala: () => Object3D | null;
  pixeles: () => { equipo: number; usado: number };
}

export function crearHerramientas(o: OpcionesHerramientas): MedidorMotor {
  const medidor = crearMedidor(o);
  const estres = crearControladorEstres({
    renderer: o.renderer,
    escena: o.escena,
    camara: o.camara,
    canvas: o.canvas,
    raizSala: o.raizSala,
    dprEquipo: () => o.pixeles().equipo,
    fijarPixelRatio: (r) => {
      pixelRatioForzado.value = r;
    },
  });
  return {
    cuadro(ahoraMs) {
      medidor.cuadro(ahoraMs);
      estres.cuadro(ahoraMs);
    },
    reiniciar() {
      medidor.reiniciar();
    },
    liberar() {
      estres.liberar();
      medidor.liberar();
      pixelRatioForzado.value = null;
    },
  };
}
