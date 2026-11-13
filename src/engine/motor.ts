/**
 * Motor 3D del juego (T12): renderer, escena, cámara y bucle.
 * La interfaz lo monta con `iniciarMotor(canvas)` y lo desmonta con la función que devuelve.
 * Se comunica con ui/ solo por src/signals/.
 */
import { effect } from '@preact/signals';
import { PerspectiveCamera, Scene } from 'three';
import type { Lugar } from '../content/esquema-salas';
import { destinoDePuerta, salaPorId } from '../content/salas';
import { consumirMirada, crearEntrada, movimiento, soltarTodo } from '../input/entrada';
import type { Entrada } from '../input/entrada';
import { RADIO_JOYSTICK } from '../input/joystick';
import { conectarEscritorio } from '../input/escritorio';
import { conectarTactil } from '../input/tactil';
import { joystick, punteroBloqueado } from '../signals/controles';
import { controlesActivos, enfocado } from '../signals/interfaz';
import { estadoMotor } from '../signals/motor';
import { sala, sellos } from '../signals/partida';
import { enviar, escuchar } from '../signals/puente';
import { crearInteraccion } from './interaccion/interaccion';
import type { Interaccion } from './interaccion/interaccion';
import { aplicarACamara, girar } from './jugador/camara';
import type { Orientacion } from './jugador/camara';
import { moverConColision } from './jugador/colision';
import { desplazamiento } from './jugador/movimiento';
import { crearBucle } from './loop';
import { crearRenderer, seguirTamano } from './renderer';
import { crearCargadorSalas } from './salas/cargador';
import { construirSala } from './salas/construir';
import { puntoDeEntrada, siguienteSala } from './salas/recorrido';
import { salaDeLaUrl } from './salas/url';

/** Altura de los ojos del jugador, en metros. */
export const ALTURA_OJOS = 1.6;
/** Al entrar a una sala se mira un poco hacia abajo, a la altura de los muebles. */
const PITCH_INICIAL = -0.12;
/** Espera antes de preparar la siguiente sala, para no competir con la entrada. */
const ESPERA_PRECARGA_MS = 1500;

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

  // Salas por código (src/content/salas.json) con el cargador de salas (T20): compila antes
  // de mostrar, deja en la GPU solo la portería y la sala actual, y prepara la siguiente.
  const cargador = crearCargadorSalas({
    renderer,
    escena,
    camara,
    distribucion: salaPorId,
    construir: construirSala,
  });
  // Tocar un objeto lo enfoca y el HUD muestra su botón contextual (T18).
  let interaccion: Interaccion | null = null;
  let mostrada: Lugar | null = null;
  let precarga: ReturnType<typeof setTimeout> | undefined;
  let detenido = false;

  const cambiarA = async (lugar: Lugar): Promise<void> => {
    if (mostrada === lugar) return;
    const desde = mostrada;
    mostrada = lugar;
    clearTimeout(precarga);
    interaccion?.liberar();
    interaccion = null;
    const nueva = await cargador.entrar(lugar);
    // Si mientras compilaba se pidió otra sala, o se cerró el juego, esta ya no se usa.
    if (!nueva || detenido || mostrada !== lugar) return;
    interaccion = crearInteraccion(camara, nueva.raiz);
    // Se aparece frente a la puerta por la que se llegó (o en el inicio de la sala).
    const p = puntoDeEntrada(salaPorId(lugar), desde);
    camara.position.set(p.x, ALTURA_OJOS, p.z);
    orientacion = { yaw: p.yaw, pitch: PITCH_INICIAL };
    aplicarACamara(camara, orientacion);
    canvas.dataset['sala'] = lugar;
    // Mallas de la sala: las geometrías en la GPU no deben pasar de aquí (más las de la portería).
    canvas.dataset['mallas'] = String(nueva.mallas);
    // Con calma, se arma en la CPU la siguiente sala sin sello.
    precarga = setTimeout(() => {
      const siguiente = siguienteSala(lugar, sellos.value);
      if (siguiente && !detenido) cargador.precargar(siguiente);
    }, ESPERA_PRECARGA_MS);
  };

  // `?sala=…` solo elige la primera sala que se dibuja; en cuanto la partida cambia de sala,
  // manda la partida.
  let forzada = salaDeLaUrl(window.location.search);
  const salaInicial = sala.value;
  const dejarDeSeguirSala = effect(() => {
    const lugar = sala.value;
    if (lugar !== salaInicial) forzada = null;
    void cambiarA(forzada ?? lugar);
  });
  // Con `?sala=`, usar la puerta hacia la sala en la que la partida ya está no cambia el
  // signal: se deja de forzar y se muestra la sala de la partida.
  const dejarDeEscuchar = escuchar((c) => {
    if (forzada && c.t === 'accion' && c.accion === 'usar') {
      if (destinoDePuerta(c.objeto) === sala.value) {
        forzada = null;
        void cambiarA(sala.value);
      }
    }
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
          const cajas = cargador.actual?.cajas ?? [];
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
      const geometrias = String(renderer.info.memory.geometries);
      if (canvas.dataset['geometrias'] !== geometrias) canvas.dataset['geometrias'] = geometrias;

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
    detenido = true;
    clearTimeout(precarga);
    dejarDeSeguirSala();
    dejarDeEscuchar();
    interaccion?.liberar();
    joystick.value = null;
    cargador.liberar();
    renderer.dispose();
    delete canvas.dataset['motor'];
    delete canvas.dataset['mirada'];
    delete canvas.dataset['posicion'];
    delete canvas.dataset['sala'];
    delete canvas.dataset['geometrias'];
    delete canvas.dataset['mallas'];
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
