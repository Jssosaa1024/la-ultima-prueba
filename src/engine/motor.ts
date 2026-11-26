/**
 * Motor 3D del juego (T12): renderer, escena, cámara y bucle.
 * La interfaz lo monta con `iniciarMotor(canvas)` y lo desmonta con la función que devuelve.
 * Se comunica con ui/ solo por src/signals/.
 */
import { effect, untracked } from '@preact/signals';
import { PerspectiveCamera, Scene } from 'three';
import type { Mesh, Object3D } from 'three';
import type { Lugar } from '../content/esquema-salas';
import { destinoDePuerta, salaPorId } from '../content/salas';
import { consumirMirada, crearEntrada, movimiento, soltarTodo } from '../input/entrada';
import type { Entrada } from '../input/entrada';
import { RADIO_JOYSTICK } from '../input/joystick';
import { conectarEscritorio } from '../input/escritorio';
import { conectarTactil } from '../input/tactil';
import { ajustes } from '../signals/ajustes';
import { joystick, punteroBloqueado } from '../signals/controles';
import { controlesActivos, enfocado, panel } from '../signals/interfaz';
import { etapa as etapaActual } from '../signals/mecanismo';
import { encuadre as encuadreActual, estadoMotor } from '../signals/motor';
import { escalaResolucion, girarTelefono, pantalla } from '../signals/pantalla';
import { fase, modo, sala, sellos } from '../signals/partida';
import { enviar, escuchar } from '../signals/puente';
import { audioDesbloqueado } from '../signals/audio';
import {
  depuracionAbierta,
  estresActivo,
  marcarInicioSala,
  marcarPrimerCuadro,
} from '../debug/metricas';
import type { MedidorMotor } from '../debug/medidor';
import { iniciarAudio } from './audio/audio';
import { sonar } from './audio/eventos';
import { crearRetroalimentacion, escucharRetroalimentacion } from './audio/retroalimentacion';
import type { Companeros } from './coop/companeros';
import { crearInteraccion } from './interaccion/interaccion';
import type { Interaccion } from './interaccion/interaccion';
import { aplicarACamara, girar } from './jugador/camara';
import {
  cajaDe,
  crearEncuadre,
  FRACCION_LIBRE,
  grupoDeMaquina,
  poseDeEncuadre,
} from './jugador/encuadre';
import type { Orientacion } from './jugador/camara';
import { moverConColision } from './jugador/colision';
import { desplazamiento } from './jugador/movimiento';
import { crearEscalaDinamica } from './escala';
import { crearBucle } from './loop';
import { animacionDeSala } from './mecanismos';
import type { AnimacionSala } from './mecanismos';
import { crearRenderer, exposicionDe, seguirTamano } from './renderer';
import type { Cargador } from './carga/cargador';
import { pedirIndice } from './carga/manifiesto';
import type { IndiceAssets } from './carga/manifiesto';
import { crearCargadorSalas } from './salas/cargador';
import { construirSala } from './salas/construir';
import { objetosConModelo } from './salas/modelos';
import { conTazaDePrueba, esPruebaAsset } from './salas/prueba-asset';
import { necesitaVestir, urlsDeSala, vestirSala } from './salas/vestir';
import type { FuentesAssets } from './salas/vestir';
import { puntoDeEntrada, siguienteSala } from './salas/recorrido';
import { salaDeLaUrl } from './salas/url';
import { crearVistaPorCeldas } from './salas/vista-por-celdas';
import type { VistaPorCeldas } from './salas/vista-por-celdas';

/** Altura de los ojos del jugador, en metros. */
export const ALTURA_OJOS = 1.6;
/** Al entrar a una sala se mira un poco hacia abajo, a la altura de los muebles. */
const PITCH_INICIAL = -0.12;
/**
 * Con un panel 2D abierto y nada que se mueva, se dibuja a unos 10 cuadros por segundo (punto
 * 21 del hito 1): en un celular es batería y calor, y en las e2e deja el procesador libre para
 * los clics. Mientras la máquina se anima o la cámara se acerca a ella, a velocidad normal
 * (corrección del 25 de noviembre).
 */
export const MS_POR_CUADRO_CON_PANEL = 100;
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

  // Lo que se descarga (modelos T19e y texturas T19g): el manifiesto y el cargador KTX2 (T10) se piden solo la primera
  // vez que una sala los necesita, con import dinámico, para no pesar en la primera carga.
  let indice: Promise<IndiceAssets> | null = null;
  let cargadorAssets: Cargador | null = null;
  const pedirIndiceUnaVez = (): Promise<IndiceAssets> => (indice ??= pedirIndice());
  let fuentes: Promise<FuentesAssets> | null = null;
  const fuentesAssets = (): Promise<FuentesAssets> =>
    (fuentes ??= import('./carga/cargador').then(({ crearCargador }) => {
      const c = crearCargador(renderer);
      cargadorAssets = c;
      return {
        indice: pedirIndiceUnaVez,
        textura: (url) => c.cargarTextura(url),
        modelo: (url) => c.cargar(url).then((gltf) => gltf.scene),
      };
    }));

  // `?prueba=asset` (T10b): la portería lleva además la taza de prueba sobre el escritorio.
  const distribucion = esPruebaAsset(window.location.search)
    ? (l: Lugar) => conTazaDePrueba(salaPorId(l))
    : salaPorId;

  // Salas por código (src/content/salas.json) con el cargador de salas (T20): compila antes
  // de mostrar, deja en la GPU solo la portería y la sala actual, y prepara la siguiente.
  const cargador = crearCargadorSalas({
    renderer,
    escena,
    camara,
    distribucion,
    construir: construirSala,
    vestir: async (construida, datos) => {
      if (!necesitaVestir(datos) || detenido) return;
      await vestirSala(construida.raiz, datos, await fuentesAssets());
    },
    precalentar: (datos) => {
      if (!necesitaVestir(datos)) return;
      void pedirIndiceUnaVez().then((i) => {
        for (const url of urlsDeSala(datos, i)) void fetch(url).catch(() => undefined);
      });
    },
  });
  // Tocar un objeto lo enfoca y el HUD muestra su botón contextual (T18).
  let interaccion: Interaccion | null = null;
  // La máquina de la sala se opera en su panel 2D; en la escena solo anima lo que pasó (T45).
  let animacion: AnimacionSala | null = null;
  // El acierto o el error de cada etapa suenan cuando la máquina termina de moverse
  // (corrección del 25 de noviembre).
  const retroalimentacion = crearRetroalimentacion(sonar);
  const dejarDeEscucharRetroalimentacion = escucharRetroalimentacion(retroalimentacion);
  // Con el panel de una máquina abierto, la cámara se acerca a ella (corrección del 25 de
  // noviembre). Se dibuja con otra cámara: la del jugador no se mueve.
  const encuadre = crearEncuadre(
    () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  let camaraDibujo: PerspectiveCamera = camara;
  /** Algo se mueve en la escena: la máquina o la cámara del encuadre. */
  const hayMovimiento = (): boolean =>
    (animacion?.animando ?? false) ||
    encuadre.estado === 'acercando' ||
    encuadre.estado === 'volviendo';
  // Pasillos: en la portería con su pasillo solo se dibuja lo que se ve desde donde está el
  // jugador (`vista-por-celdas.ts`).
  let vista: VistaPorCeldas | null = null;
  let mostrada: Lugar | null = null;
  let precarga: ReturnType<typeof setTimeout> | undefined;
  let detenido = false;
  // Escala dinámica de resolución (T13): baja los píxeles si no se alcanzan los 30 fps.
  const escala = crearEscalaDinamica(escalaResolucion.peek());
  canvas.dataset['escala'] = String(escala.valor);
  const depuracion = { mirada: '', posicion: '' };
  // Panel ?debug=1 (T11m y T11o): el medidor y la prueba de estrés existen solo con el panel
  // abierto.
  let medidor: MedidorMotor | null = null;
  // Tiempo de carga de la sala: de `sala:inicio` al primer cuadro con la sala en la escena.
  let medirPrimerCuadro = false;

  /** Dibuja un cuadro. Lo llama el bucle y, con el bucle en pausa, quien cambie la escena. */
  const dibujar = (): void => {
    escribirDepuracion(canvas, depuracion, orientacion, camara.position);
    const geometrias = String(renderer.info.memory.geometries);
    if (canvas.dataset['geometrias'] !== geometrias) canvas.dataset['geometrias'] = geometrias;
    seguirTamano(renderer, camara);
    renderer.info.reset();
    renderer.render(escena, camaraDibujo);
    if (medirPrimerCuadro) {
      medirPrimerCuadro = false;
      marcarPrimerCuadro();
    }
  };
  /**
   * Detrás del menú y de los finales el bucle no corre (T20b). Si la escena cambia mientras
   * tanto (terminó de cargar una sala), se dibuja un solo cuadro para que no quede la anterior.
   */
  const dibujarSiEnPausa = (): void => {
    if (!detenido && estadoMotor.value === 'pausado' && !document.hidden) dibujar();
  };

  /**
   * Exposición de la sala que está en pantalla, sin el brillo (T19k). Cambia cuando la sala
   * nueva ya se ve, no cuando se pide: mientras carga, la anterior sigue con la suya.
   */
  let exposicionSala: number | null = null;
  /**
   * Pone la exposición de la sala en pantalla por el ajuste «Brillo». Es un uniform: cambiarla
   * no recompila nada. Queda en un atributo para las pruebas e2e.
   */
  const ponerExposicion = (brillo: number): void => {
    if (exposicionSala === null) return;
    const exposicion = exposicionSala * brillo;
    renderer.toneMappingExposure = exposicion;
    canvas.dataset['exposicion'] = exposicion.toFixed(3);
  };

  const cambiarA = async (lugar: Lugar): Promise<void> => {
    if (mostrada === lugar) return;
    const desde = mostrada;
    mostrada = lugar;
    clearTimeout(precarga);
    interaccion?.liberar();
    interaccion = null;
    animacion?.liberar();
    animacion = null;
    vista?.liberar();
    vista = null;
    delete canvas.dataset['maquina'];
    delete canvas.dataset['detalle'];
    // Compilar y armar la sala da tirones que no dicen nada del rendimiento al jugar.
    escala.reiniciar();
    marcarInicioSala(lugar);
    const nueva = await cargador.entrar(lugar);
    // Si mientras compilaba se pidió otra sala, o se cerró el juego, esta ya no se usa.
    if (!nueva || detenido || mostrada !== lugar) return;
    // Los objetos llevados que se ocultaron de esta sala, para las e2e (T84c).
    interaccion = crearInteraccion(camara, nueva.raiz, (ids) => {
      const texto = ids.join(',');
      if (canvas.dataset['ocultos'] !== texto) canvas.dataset['ocultos'] = texto;
    });
    animacion = animacionDeSala(lugar, nueva.raiz);
    // Después de la animación: lo que ella agrega (el mural, las luces) también cuenta.
    vista = crearVistaPorCeldas(nueva.raiz, salaPorId(lugar));
    // Se aparece frente a la puerta por la que se llegó (o en el inicio de la sala).
    const p = puntoDeEntrada(salaPorId(lugar), desde);
    camara.position.set(p.x, ALTURA_OJOS, p.z);
    orientacion = { yaw: p.yaw, pitch: PITCH_INICIAL };
    aplicarACamara(camara, orientacion);
    vista?.actualizar(p.x, p.z);
    canvas.dataset['sala'] = lugar;
    exposicionSala = exposicionDe(salaPorId(lugar), 1);
    ponerExposicion(ajustes.peek().brillo);
    // Mallas de la sala, con las que agregan sus animaciones: las geometrías en la GPU no deben
    // pasar de aquí (más las de la portería).
    canvas.dataset['mallas'] = String(contarMallas(nueva.raiz));
    // Los objetos que ya muestran su modelo (T19e), para las e2e.
    canvas.dataset['modelos'] = objetosConModelo(nueva.raiz).join(',');
    medirPrimerCuadro = true;
    dibujarSiEnPausa();
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

  // El jugador cambia el brillo en los ajustes (T19k): se ve en el acto, también en pausa.
  const dejarDeSeguirBrillo = effect(() => {
    ponerExposicion(ajustes.value.brillo);
    // Solo el brillo despierta este effect: el estado del motor se lee sin suscribirse.
    untracked(dibujarSiEnPausa);
  });

  // Audio (T43): suena después del primer toque. El último efecto queda en un atributo del
  // canvas para las pruebas e2e y, desde T42c, los últimos doce en orden (`data-sonidos`).
  const sonidos: string[] = [];
  const detenerAudio = iniciarAudio({
    alSonar: (nombre) => {
      canvas.dataset['sonido'] = nombre;
      sonidos.push(nombre);
      if (sonidos.length > 12) sonidos.shift();
      canvas.dataset['sonidos'] = sonidos.join(' ');
    },
  });
  const dejarDeSeguirAudio = effect(() => {
    canvas.dataset['audio'] = audioDesbloqueado.value ? 'listo' : 'bloqueado';
  });

  const entrada = crearEntrada();
  // Los controles solo funcionan jugando y sin un panel 2D abierto (signals/interfaz.ts).
  const activos = (): boolean => controlesActivos.value;
  const desconectarTactil = conectarTactil(canvas, entrada, {
    activos,
    // Ajustes del jugador (T39): se leen sin suscribirse, en cada toque.
    zurdo: () => ajustes.peek().zurdo,
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
  let cuadro = 0;
  // Cooperativo (T82): los demás jugadores y la pose propia. Solo existe en una partida en grupo.
  let companeros: Companeros | null = null;

  /** Solo cuentan los cuadros a velocidad normal: con un panel abierto se dibuja más lento. */
  const medirRendimiento = (dt: number): void => {
    // Durante la prueba de estrés (?debug=1) el pixel ratio lo fija la prueba.
    if (panel.peek() !== null || estresActivo.peek()) {
      escala.reiniciar();
      return;
    }
    const nueva = escala.registrar(dt);
    if (nueva === null) return;
    escalaResolucion.value = nueva;
    canvas.dataset['escala'] = String(nueva);
  };

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
          // Sensibilidad elegida en los ajustes (T39), para el dedo y el ratón.
          const s = ajustes.peek().sensibilidad;
          orientacion = girar(orientacion, dx * s, dy * s);
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
          vista?.actualizar(p.x, p.z);
        }
      }
      // Con el puntero bloqueado, la mira del centro apunta (unas 10 veces por segundo).
      if (punteroBloqueado.value && activos() && cuadro % 6 === 0) interaccion?.tocar(0, 0);
      interaccion?.actualizar();
      if (companeros && mostrada) {
        companeros.cuadro(
          performance.now(),
          mostrada,
          camara.position.x,
          camara.position.z,
          orientacion.yaw,
        );
      }
      if (animacion) {
        // También con un panel abierto (a 10 cuadros por segundo): al cerrarlo, la máquina ya
        // terminó de moverse.
        animacion.actualizar(dt);
        // Atributo para las pruebas e2e. Solo se escribe si cambió.
        if (canvas.dataset['maquina'] !== animacion.estado) {
          canvas.dataset['maquina'] = animacion.estado;
        }
        const detalle = animacion.detalle;
        if (detalle !== undefined && canvas.dataset['detalle'] !== detalle) {
          canvas.dataset['detalle'] = detalle;
        }
      }
      retroalimentacion.actualizar(dt, animacion?.animando ?? false);
      camaraDibujo = encuadre.actualizar(dt, camara);
      if (encuadreActual.peek() !== encuadre.estado) {
        encuadreActual.value = encuadre.estado;
        // Atributo para las pruebas e2e.
        canvas.dataset['encuadre'] = encuadre.estado;
      }
      publicarJoystick(entrada);
      dibujar();
      medirRendimiento(dt);
      if (medidor) {
        // Con un panel del juego abierto se dibuja a 10 cuadros por segundo: no cuenta.
        if (panel.peek() === null) medidor.cuadro(performance.now());
        else medidor.reiniciar();
      }
    },
    alCambiarEstado: (estado) => {
      estadoMotor.value = estado;
      // Atributo para las pruebas e2e y para depurar desde el navegador.
      canvas.dataset['motor'] = estado;
    },
    // Hasta que empiece la partida no hay nada que animar.
    permitido: fase.peek() === 'jugando',
    intervaloMs: () => (panel.peek() === null || hayMovimiento() ? 0 : MS_POR_CUADRO_CON_PANEL),
  });

  // El motor solo dibuja durante la partida (T20b). Detrás del menú y de las pantallas de
  // final, que tapan la escena, se detiene del todo: en un celular es batería y calor. Lo
  // mismo detrás del aviso de girar el teléfono (T41b).
  // El panel de una máquina abierto: la cámara se acerca a ella y la deja en la parte de la
  // pantalla que el panel no tapa; al cerrarlo, vuelve a donde estaba. El grupo de piezas que
  // se encuadra es el del objeto que se usó.
  const dejarDeSeguirEncuadre = effect(() => {
    const abierto = panel.value === 'mecanismo';
    const raiz = cargador.actual?.raiz;
    const grupo =
      abierto && mostrada
        ? grupoDeMaquina(mostrada, enfocado.peek()?.id ?? null, etapaActual.peek()?.etapa ?? 0)
        : null;
    const caja = grupo && raiz ? cajaDe(raiz, grupo) : null;
    if (!caja) {
      encuadre.volver();
      return;
    }
    const libre = FRACCION_LIBRE;
    encuadre.acercar(
      poseDeEncuadre(camara.position, caja, camara.fov, camara.aspect, libre),
      libre,
    );
  });

  const dejarDeSeguirFase = effect(() => {
    const jugando = fase.value === 'jugando' && !girarTelefono.value;
    if (!jugando) {
      // Lo que hacía el bucle en cada cuadro sin controles: soltar dedos, teclas y ratón.
      soltarTodo(entrada);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      joystick.value = null;
    }
    bucle.permitir(jugando);
  });

  // Los compañeros se cargan aparte (import dinámico) y solo en el modo cooperativo.
  let pedidoCompaneros = 0;
  const dejarDeSeguirModo = effect(() => {
    const enGrupo = modo.value === 'cooperativo';
    const este = ++pedidoCompaneros;
    companeros?.liberar();
    companeros = null;
    if (!enGrupo) return;
    void import('./coop/companeros').then(({ crearCompaneros }) => {
      if (detenido || este !== pedidoCompaneros) return;
      companeros = crearCompaneros(escena, canvas, {
        camara,
        // T83c: el paquete de personajes, con el mismo cargador de las salas.
        cargarModelo: async () => {
          await fuentesAssets();
          const [{ cargarModeloPersonajes }, i] = await Promise.all([
            import('./coop/modelo-personajes'),
            pedirIndiceUnaVez(),
          ]);
          const c = cargadorAssets;
          if (!c || detenido) return null;
          return cargarModeloPersonajes(i, (url) => c.cargar(url));
        },
      });
    });
  });

  // El medidor del panel ?debug=1 se carga aparte (import dinámico) y solo mientras se ve.
  let pedidoMedidor = 0;
  const dejarDeSeguirDepuracion = effect(() => {
    const abierta = depuracionAbierta.value;
    const este = ++pedidoMedidor;
    medidor?.liberar();
    medidor = null;
    if (!abierta) return;
    void import('../debug/herramientas').then(({ crearHerramientas }) => {
      if (detenido || este !== pedidoMedidor) return;
      medidor = crearHerramientas({
        renderer,
        escena,
        camara,
        canvas,
        sala: () => mostrada,
        raizSala: () => cargador.actual?.raiz ?? null,
        pixeles: () => {
          const p = pantalla.peek();
          return { equipo: p.dprEquipo, usado: p.dprUsado };
        },
      });
    });
  });

  return () => {
    bucle.detener();
    dejarDeSeguirModo();
    companeros?.liberar();
    companeros = null;
    dejarDeSeguirDepuracion();
    medidor?.liberar();
    medidor = null;
    detenerAudio();
    dejarDeEscucharRetroalimentacion();
    dejarDeSeguirEncuadre();
    encuadreActual.value = 'libre';
    dejarDeSeguirAudio();
    desconectarTactil();
    desconectarEscritorio();
    punteroBloqueado.value = false;
    detenido = true;
    clearTimeout(precarga);
    dejarDeSeguirSala();
    dejarDeSeguirBrillo();
    dejarDeSeguirFase();
    dejarDeEscuchar();
    interaccion?.liberar();
    animacion?.liberar();
    vista?.liberar();
    joystick.value = null;
    cargador.liberar();
    cargadorAssets?.liberar();
    renderer.dispose();
    delete canvas.dataset['motor'];
    delete canvas.dataset['mirada'];
    delete canvas.dataset['posicion'];
    delete canvas.dataset['sala'];
    delete canvas.dataset['geometrias'];
    delete canvas.dataset['mallas'];
    delete canvas.dataset['modelos'];
    delete canvas.dataset['maquina'];
    delete canvas.dataset['detalle'];
    delete canvas.dataset['sonido'];
    delete canvas.dataset['audio'];
    delete canvas.dataset['escala'];
    delete canvas.dataset['exposicion'];
    escalaResolucion.value = 1;
  };
}

/** Mallas que cuelgan de `raiz`: una draw call cada una. */
function contarMallas(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    if ((o as Mesh).isMesh) n++;
  });
  return n;
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
