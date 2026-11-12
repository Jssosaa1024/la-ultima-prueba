/**
 * Motor 3D del juego (T12): renderer, escena, cámara y bucle.
 * La interfaz lo monta con `iniciarMotor(canvas)` y lo desmonta con la función que devuelve.
 * Se comunica con ui/ solo por src/signals/.
 */
import { PerspectiveCamera, Scene } from 'three';
import { consumirMirada, crearEntrada, soltarTodo } from '../input/entrada';
import type { Entrada } from '../input/entrada';
import { RADIO_JOYSTICK } from '../input/joystick';
import { conectarTactil } from '../input/tactil';
import { joystick } from '../signals/controles';
import { controlesActivos } from '../signals/interfaz';
import { estadoMotor } from '../signals/motor';
import { liberarObjeto } from './carga/liberar';
import { aplicarACamara, girar } from './jugador/camara';
import type { Orientacion } from './jugador/camara';
import { desplazamiento } from './jugador/movimiento';
import { crearBucle } from './loop';
import { crearRenderer, seguirTamano } from './renderer';
import { crearEscenaProvisional } from './salas/provisional';

/** Altura de los ojos del jugador, en metros. */
export const ALTURA_OJOS = 1.6;

/** Publica el joystick para el HUD solo si cambió (una vez por cuadro como máximo). */
function publicarJoystick(entrada: Entrada): void {
  const j = entrada.joystick;
  const actual = joystick.value;
  if (!j) {
    if (actual) joystick.value = null;
    return;
  }
  if (
    actual &&
    actual.baseX === j.baseX &&
    actual.baseY === j.baseY &&
    actual.perillaX === j.perillaX &&
    actual.perillaY === j.perillaY
  ) {
    return;
  }
  joystick.value = { ...j, radio: RADIO_JOYSTICK };
}

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
  // Los controles solo funcionan jugando y sin un panel 2D abierto (signals/interfaz.ts).
  const activos = (): boolean => controlesActivos.value;
  const desconectarTactil = conectarTactil(canvas, entrada, { activos });
  const depuracion = { mirada: '', posicion: '' };

  const bucle = crearBucle({
    programar: (cuadro) => renderer.setAnimationLoop(cuadro),
    alCuadro: (dt) => {
      if (!activos()) {
        // Con un panel abierto el jugador se queda quieto y no gira.
        soltarTodo(entrada);
      } else {
        const { dx, dy } = consumirMirada(entrada);
        if (dx !== 0 || dy !== 0) {
          orientacion = girar(orientacion, dx, dy);
          aplicarACamara(camara, orientacion);
        }
        if (entrada.moverX !== 0 || entrada.moverY !== 0) {
          const d = desplazamiento(orientacion.yaw, entrada.moverX, entrada.moverY, dt);
          camara.position.x += d.x;
          camara.position.z += d.z;
        }
      }
      publicarJoystick(entrada);
      escribirDepuracion(canvas, depuracion, orientacion, camara.position);

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
    joystick.value = null;
    liberarObjeto(sala);
    renderer.dispose();
    delete canvas.dataset['motor'];
    delete canvas.dataset['mirada'];
    delete canvas.dataset['posicion'];
  };
}

/** Mirada y posición en atributos del canvas, para pruebas e2e. Solo escribe si cambian. */
function escribirDepuracion(
  canvas: HTMLCanvasElement,
  previo: { mirada: string; posicion: string },
  o: Orientacion,
  p: { x: number; z: number },
): void {
  const mirada = `${o.yaw.toFixed(2)},${o.pitch.toFixed(2)}`;
  const posicion = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
  if (mirada !== previo.mirada) canvas.dataset['mirada'] = previo.mirada = mirada;
  if (posicion !== previo.posicion) canvas.dataset['posicion'] = previo.posicion = posicion;
}
