/**
 * Encuadre de la máquina (corrección del 25 de noviembre, con la sesión C).
 *
 * Al abrir el panel de una máquina, la cámara se acerca suave y deja la máquina en la parte de
 * la pantalla que el panel no tapa (los dos tercios izquierdos, o lo que diga `franja`); al
 * cerrarlo, vuelve a donde estaba. Con `prefers-reduced-motion`, corte directo.
 *
 * Se dibuja con una cámara aparte: la del jugador no se mueve. Así su posición, sus choques, lo
 * que toca, su pose en el cooperativo y los atributos de las e2e siguen siendo los del jugador.
 */
import { Box3, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { Lugar } from '../../content/esquema-salas';
import type { EstadoEncuadre } from '../../signals/motor';

/** Lo que tarda en acercarse o en volver. */
export const DURACION_ENCUADRE_S = 0.6;
/** Parte del ancho que queda libre si el panel no dice otra cosa: los dos tercios izquierdos. */
export const FRACCION_LIBRE = 2 / 3;
/** Aire alrededor de la máquina. */
const MARGEN = 1.2;
/** Nunca más cerca que esto del centro de la máquina. */
const DISTANCIA_MIN = 0.7;
/** Se mira la máquina un poco desde arriba. */
const ELEVACION = (22 * Math.PI) / 180;

/**
 * Las piezas que forman la máquina de cada sala, por grupos. El grupo que se encuadra es el del
 * objeto que se usó; si el objeto no está en ninguno, el primero.
 */
export const MAQUINAS: Partial<Record<Lugar, readonly (readonly string[])[]>> = {
  's1-cooperativa': [['s1-etiquetadora', 's1-palanca']],
  's2-laboratorio': [['s2-tanque-a', 's2-tanque-b', 's2-panel']],
  's3-gimnasio': [
    ['s3-postes', 's3-sensores', 's3-reflector'],
    ['s3-polea', 's3-cinta-metrica'],
  ],
  's4-biblioteca': [['s4-carritos', 's4-pila-libros']],
  's5-rectoria': [['s5-urna', 's5-dispensadores', 's5-simulador', 's5-ver-parejas']],
};

export function grupoDeMaquina(lugar: Lugar, objeto: string | null): readonly string[] | null {
  const grupos = MAQUINAS[lugar];
  if (!grupos) return null;
  return grupos.find((g) => objeto !== null && g.includes(objeto)) ?? grupos[0] ?? null;
}

/** La caja que envuelve esas piezas en la sala, o `null` si no hay ninguna. */
export function cajaDe(raiz: Object3D, ids: readonly string[]): Box3 | null {
  const caja = new Box3();
  const parte = new Box3();
  for (const id of ids) {
    const o = raiz.getObjectByName(id);
    if (!o) continue;
    parte.setFromObject(o);
    if (!parte.isEmpty()) caja.union(parte);
  }
  return caja.isEmpty() ? null : caja;
}

/**
 * Dónde se pone la cámara para ver la máquina entera en la parte libre de la pantalla: del lado
 * desde el que la mira el jugador, un poco desde arriba, y nunca más lejos de lo que ya estaba.
 */
export function poseDeEncuadre(
  ojo: Vector3,
  caja: Box3,
  fovVerticalGrados: number,
  aspecto: number,
  libre: number,
): { posicion: Vector3; mira: Vector3 } {
  const mira = caja.getCenter(new Vector3());
  const radio = caja.getSize(new Vector3()).length() / 2;
  const medioV = (fovVerticalGrados * Math.PI) / 360;
  const medioH = Math.atan(Math.tan(medioV) * aspecto * libre);
  const ideal = (radio * MARGEN) / Math.sin(Math.min(medioV, medioH));
  const actual = ojo.distanceTo(mira);
  // Se acerca hasta la distancia ideal (no menos de 70 cm), pero nunca se aleja.
  const distancia = Math.min(actual, Math.max(DISTANCIA_MIN, ideal));
  let dx = ojo.x - mira.x;
  let dz = ojo.z - mira.z;
  const largo = Math.hypot(dx, dz);
  if (largo < 1e-6) {
    dx = 0;
    dz = 1;
  } else {
    dx /= largo;
    dz /= largo;
  }
  const horizontal = distancia * Math.cos(ELEVACION);
  const posicion = new Vector3(
    mira.x + dx * horizontal,
    mira.y + distancia * Math.sin(ELEVACION),
    mira.z + dz * horizontal,
  );
  return { posicion, mira };
}

/** Sube rápido y llega despacio. */
const suave = (t: number): number => 1 - (1 - t) ** 3;

export interface Encuadre {
  /** Empieza a acercarse a esa pose; `libre` es la parte del ancho que el panel no tapa. */
  acercar(objetivo: { posicion: Vector3; mira: Vector3 }, libre: number): void;
  /** Cambia la parte libre sin moverse (el panel se recogió o se abrió). */
  liberar(libre: number): void;
  /** Vuelve a la cámara del jugador. */
  volver(): void;
  /**
   * Avanza la transición y devuelve la cámara con la que se dibuja: la del encuadre o, sin
   * encuadre, la del jugador.
   */
  actualizar(dt: number, jugador: PerspectiveCamera): PerspectiveCamera;
  readonly estado: EstadoEncuadre;
}

export function crearEncuadre(movimientoReducido: () => boolean): Encuadre {
  const vista = new PerspectiveCamera();
  let estado: EstadoEncuadre = 'libre';
  /** 0: la cámara del jugador; 1: encuadrada. */
  let progreso = 0;
  let libre = FRACCION_LIBRE;
  /** Lo que se ve corrido a la izquierda, de 0 a 1, para que no salte al cambiar la franja. */
  let corrimiento = 0;
  const destino = new Vector3();
  const giroDestino = new Quaternion();
  const giroJugador = new Quaternion();
  const posJugador = new Vector3();

  return {
    acercar(objetivo, nuevaLibre) {
      destino.copy(objetivo.posicion);
      // El giro que mira la máquina desde el destino.
      vista.position.copy(objetivo.posicion);
      vista.lookAt(objetivo.mira);
      giroDestino.copy(vista.quaternion);
      libre = nuevaLibre;
      estado = 'acercando';
      if (movimientoReducido()) {
        progreso = 1;
        estado = 'encuadrada';
      }
    },
    liberar(nuevaLibre) {
      libre = nuevaLibre;
    },
    volver() {
      if (estado === 'libre') return;
      estado = 'volviendo';
      if (movimientoReducido()) {
        progreso = 0;
        estado = 'libre';
      }
    },
    actualizar(dt, jugador) {
      if (estado === 'acercando') {
        progreso = Math.min(1, progreso + dt / DURACION_ENCUADRE_S);
        if (progreso >= 1) estado = 'encuadrada';
      } else if (estado === 'volviendo') {
        progreso = Math.max(0, progreso - dt / DURACION_ENCUADRE_S);
        if (progreso <= 0) estado = 'libre';
      }
      // El corrimiento sigue a la franja sin saltos, también ya encuadrada.
      const meta = (1 - libre) / 2;
      corrimiento += (meta - corrimiento) * Math.min(1, dt / (DURACION_ENCUADRE_S / 3));
      if (estado === 'libre') return jugador;

      const e = suave(progreso);
      jugador.getWorldPosition(posJugador);
      jugador.getWorldQuaternion(giroJugador);
      vista.position.lerpVectors(posJugador, destino, e);
      vista.quaternion.slerpQuaternions(giroJugador, giroDestino, e);
      vista.fov = jugador.fov;
      vista.near = jugador.near;
      vista.far = jugador.far;
      vista.aspect = jugador.aspect;
      // La máquina queda en el centro de la parte libre: el cuadro se corre a la izquierda.
      vista.setViewOffset(1, 1, corrimiento * e, 0, 1, 1);
      vista.updateProjectionMatrix();
      vista.updateMatrixWorld();
      return vista;
    },
    get estado() {
      return estado;
    },
  };
}
