/**
 * Motor 3D del juego (T12): renderer, escena, cámara y bucle.
 * La interfaz lo monta con `iniciarMotor(canvas)` y lo desmonta con la función que devuelve.
 * Se comunica con ui/ solo por src/signals/.
 */
import { effect } from '@preact/signals';
import { PerspectiveCamera, Scene } from 'three';
import type { Lugar } from '../content/esquema-salas';
import { salaPorId } from '../content/salas';
import { consumirMirada, crearEntrada, movimiento, soltarTodo } from '../input/entrada';
import type { Entrada } from '../input/entrada';
import { RADIO_JOYSTICK } from '../input/joystick';
import { conectarEscritorio } from '../input/escritorio';
import { conectarTactil } from '../input/tactil';
import { joystick, punteroBloqueado } from '../signals/controles';
import { controlesActivos, enfocado } from '../signals/interfaz';
import { estadoMotor } from '../signals/motor';
import { sala } from '../signals/partida';
import { enviar } from '../signals/puente';
import { liberarObjeto } from './carga/liberar';
import { crearInteraccion } from './interaccion/interaccion';
import type { Interaccion } from './interaccion/interaccion';
import { aplicarACamara, girar } from './jugador/camara';
import type { Orientacion } from './jugador/camara';
import { moverConColision } from './jugador/colision';
import { desplazamiento } from './jugador/movimiento';
import { crearBucle } from './loop';
import { crearRenderer, seguirTamano } from './renderer';
import { construirSala } from './salas/construir';
import type { SalaConstruida } from './salas/construir';
import { salaDeLaUrl } from './salas/url';

/** Altura de los ojos del jugador, en metros. */
export const ALTURA_OJOS = 1.6;
/** Al entrar a una sala se mira un poco hacia abajo, a la altura de los muebles. */
const PITCH_INICIAL = -0.12;

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
  let orientacion: Orientacion = { yaw: 0, pitch: PITCH_INICIAL };

  // Salas por código: la sala de `signals/partida.ts` (la portería al empezar), armada con
  // primitivas desde src/content/salas.json, con sus cajas de colisión (T17).
  let actual: SalaConstruida | null = null;
  // Tocar un objeto lo enfoca y el HUD muestra su botón contextual (T18).
  let interaccion: Interaccion | null = null;
  const entrar = (lugar: Lugar): void => {
    if (actual?.id === lugar) return;
    if (actual) {
      interaccion?.liberar();
      liberarObjeto(actual.raiz);
    }
    actual = construirSala(salaPorId(lugar));
    escena.add(actual.raiz);
    interaccion = crearInteraccion(camara, actual.raiz);
    camara.position.set(actual.inicio.x, ALTURA_OJOS, actual.inicio.z);
    orientacion = { yaw: actual.inicio.yaw, pitch: PITCH_INICIAL };
    aplicarACamara(camara, orientacion);
    canvas.dataset['sala'] = lugar;
  };
  // `?sala=…` solo elige la primera sala que se dibuja; en cuanto la partida cambia de sala,
  // manda la partida.
  let forzada = salaDeLaUrl(window.location.search);
  const salaInicial = sala.value;
  const dejarDeSeguirSala = effect(() => {
    const lugar = sala.value;
    if (lugar !== salaInicial) forzada = null;
    entrar(forzada ?? lugar);
  });

  const entrada = crearEntrada();
  // Los controles solo funcionan jugando y sin un panel 2D abierto (signals/interfaz.ts).
  const activos = (): boolean => controlesActivos.value;
  const desconectarTactil = conectarTactil(canvas, entrada, {
    activos,
    alTocar: (x, y) => {
      const ancho = Math.max(1, canvas.clientWidth);
      const alto = Math.max(1, canvas.clientHeight);
      interaccion?.tocar((x / ancho) * 2 - 1, -(y / alto) * 2 + 1);
    },
  });
  // Escritorio (T19): WASD, puntero bloqueado y E o clic para usar lo apuntado.
  const desconectarEscritorio = conectarEscritorio(canvas, entrada, {
    activos,
    alUsar: () => {
      const objeto = enfocado.value;
      if (objeto) enviar({ t: 'accion', objeto: objeto.id, accion: objeto.accion });
    },
    // El toque (pointerup) llega antes que el clic: si seleccionó un objeto, no se bloquea.
    puedeBloquear: () => !interaccion?.seleccionado,
    alCambiarBloqueo: (bloqueado) => {
      punteroBloqueado.value = bloqueado;
    },
  });
  const depuracion = { mirada: '', posicion: '' };
  let cuadro = 0;

  const bucle = crearBucle({
    programar: (cuadro) => renderer.setAnimationLoop(cuadro),
    alCuadro: (dt) => {
      cuadro++;
      if (!activos()) {
        // Con un panel abierto el jugador se queda quieto y no gira, y se suelta el puntero.
        soltarTodo(entrada);
        if (punteroBloqueado.value) document.exitPointerLock();
      } else {
        const { dx, dy } = consumirMirada(entrada);
        if (dx !== 0 || dy !== 0) {
          orientacion = girar(orientacion, dx, dy);
          aplicarACamara(camara, orientacion);
        }
        const pedido = movimiento(entrada);
        if (pedido.x !== 0 || pedido.y !== 0) {
          const d = desplazamiento(orientacion.yaw, pedido.x, pedido.y, dt);
          // Los pies están en el piso (y = 0); la cámara va a la altura de los ojos.
          const cajas = actual?.cajas ?? [];
          const p = moverConColision(camara.position.x, camara.position.z, d.x, d.z, 0, cajas);
          camara.position.x = p.x;
          camara.position.z = p.z;
        }
      }
      // Con el puntero bloqueado, la mira del centro apunta (unas 10 veces por segundo).
      if (punteroBloqueado.value && activos() && cuadro % 6 === 0) interaccion?.tocar(0, 0);
      interaccion?.actualizar();
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
    desconectarEscritorio();
    punteroBloqueado.value = false;
    dejarDeSeguirSala();
    interaccion?.liberar();
    joystick.value = null;
    if (actual) liberarObjeto(actual.raiz);
    renderer.dispose();
    delete canvas.dataset['motor'];
    delete canvas.dataset['mirada'];
    delete canvas.dataset['posicion'];
    delete canvas.dataset['sala'];
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
