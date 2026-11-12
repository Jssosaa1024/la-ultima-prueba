/**
 * Motor 3D del juego (T12): renderer, escena, cámara y bucle.
 * La interfaz lo monta con `iniciarMotor(canvas)` y lo desmonta con la función que devuelve.
 * Se comunica con ui/ solo por src/signals/.
 */
import { PerspectiveCamera, Scene } from 'three';
import { conectarTactil } from '../input/tactil';
import { consumirMirada, crearEntrada } from '../input/entrada';
import { panel } from '../signals/interfaz';
import { estadoMotor } from '../signals/motor';
import { fase } from '../signals/partida';
import { liberarObjeto } from './carga/liberar';
import { aplicarACamara, girar } from './jugador/camara';
import type { Orientacion } from './jugador/camara';
import { crearBucle } from './loop';
import { crearRenderer, seguirTamano } from './renderer';
import { crearEscenaProvisional } from './salas/provisional';

/** Altura de los ojos del jugador, en metros. */
export const ALTURA_OJOS = 1.6;

/**
 * El jugador se mueve y mira solo si no hay un panel 2D abierto y la partida no terminó.
 * Cuando exista el controlador de la partida (T24) que pone `fase = 'jugando'`, esto pasa a
 * ser `controlesActivos` de signals/interfaz.ts; hoy `fase` se queda en 'inicio'.
 */
const controlesActivos = (): boolean => panel.value === null && fase.value !== 'final';

export function iniciarMotor(canvas: HTMLCanvasElement): () => void {
  estadoMotor.value = 'cargando';
  const renderer = crearRenderer(canvas);
  const escena = new Scene();
  const camara = new PerspectiveCamera(70, 1, 0.05, 50);
  camara.position.set(0, ALTURA_OJOS, 2.2);
  let orientacion: Orientacion = { yaw: 0, pitch: -0.12 };
  aplicarACamara(camara, orientacion);

  const sala = crearEscenaProvisional();
  escena.add(sala);

  const entrada = crearEntrada();
  const desconectarTactil = conectarTactil(canvas, entrada, { activos: controlesActivos });
  let miradaPublicada = '';

  const bucle = crearBucle({
    programar: (cuadro) => renderer.setAnimationLoop(cuadro),
    alCuadro: () => {
      const { dx, dy } = consumirMirada(entrada);
      if (controlesActivos() && (dx !== 0 || dy !== 0)) {
        orientacion = girar(orientacion, dx, dy);
        aplicarACamara(camara, orientacion);
        // Para pruebas e2e y depuración; solo se escribe cuando cambia.
        const mirada = `${orientacion.yaw.toFixed(2)},${orientacion.pitch.toFixed(2)}`;
        if (mirada !== miradaPublicada) canvas.dataset['mirada'] = miradaPublicada = mirada;
      }
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
    desconectarTactil();
    liberarObjeto(sala);
    renderer.dispose();
    delete canvas.dataset['motor'];
    delete canvas.dataset['mirada'];
  };
}
