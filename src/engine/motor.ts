/**
 * Motor 3D del juego (T12): renderer, escena, cámara y bucle.
 * La interfaz lo monta con `iniciarMotor(canvas)` y lo desmonta con la función que devuelve.
 * Se comunica con ui/ solo por src/signals/.
 */
import { PerspectiveCamera, Scene } from 'three';
import { estadoMotor } from '../signals/motor';
import { liberarObjeto } from './carga/liberar';
import { crearBucle } from './loop';
import { crearRenderer, seguirTamano } from './renderer';
import { crearEscenaProvisional } from './salas/provisional';

/** Altura de los ojos del jugador, en metros. */
export const ALTURA_OJOS = 1.6;

export function iniciarMotor(canvas: HTMLCanvasElement): () => void {
  estadoMotor.value = 'cargando';
  const renderer = crearRenderer(canvas);
  const escena = new Scene();
  const camara = new PerspectiveCamera(70, 1, 0.05, 50);
  camara.position.set(0, ALTURA_OJOS, 2.2);
  camara.lookAt(0, 1, -2);

  const sala = crearEscenaProvisional();
  escena.add(sala);

  const bucle = crearBucle({
    programar: (cuadro) => renderer.setAnimationLoop(cuadro),
    alCuadro: () => {
      seguirTamano(renderer, camara);
      renderer.info.reset();
      renderer.render(escena, camara);
    },
    alCambiarEstado: (estado) => {
      estadoMotor.value = estado;
      // Atributo para las pruebas e2e y para depurar desde el navegador.
      canvas.dataset['motor'] = estado;
    },
  });

  return () => {
    bucle.detener();
    liberarObjeto(sala);
    renderer.dispose();
    delete canvas.dataset['motor'];
  };
}
