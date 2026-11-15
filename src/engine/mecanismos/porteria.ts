/**
 * La portería en la escena (punto 16 del hito 1).
 *
 * - **Mural de sellos.** Cinco huecos con la silueta de cada sello (moneda, gota, balón, libro
 *   y llave). Cada sello ganado aparece como una pieza que se enciende en su hueco. Si se ganó
 *   en otra sala, se enciende al volver a la portería, a la vista del jugador.
 * - **Luces sobre las puertas.** Encima de la puerta que toca abrir se enciende una luz ámbar
 *   que late; sobre las salas ya resueltas queda una luz verde tenue, y las cerradas están
 *   apagadas. Con los cinco sellos se encienden las dos luces de la puerta de salida.
 *
 * Son pocas mallas: los huecos van unidos en una sola, las siete luces son una `InstancedMesh`
 * (una draw call) y las piezas solo se dibujan cuando ya se ganaron. La portería se queda en
 * memoria todo el juego, así que todo se arma una vez y se reutiliza en cada visita.
 */
import { effect } from '@preact/signals';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import type { Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sellos } from '../../signals/partida';
import { ORDEN_SALAS } from '../salas/recorrido';
import { sinRayo } from './comunes';
import { suave } from './curvas';
import type { AnimacionSala } from './tipos';

/** Lo que tarda una pieza en encenderse en su hueco, en segundos. */
export const DURACION_PIEZA_S = 1.2;
/** Latidos por segundo de la luz de la puerta que toca abrir. */
const LATIDO_HZ = 0.8;

/** Cómo está la luz de una puerta. */
export type EstadoLuz = 'apagada' | 'siguiente' | 'hecha';

/**
 * Las luces de la portería: una por cada puerta de sala (en orden) y, al final, la de la
 * puerta de salida. Las puertas se abren en orden: la 1 desde el principio y cada una de las
 * demás cuando la sala anterior tiene su sello. La de salida, con los cinco sellos.
 */
export function lucesDePuertas(conSello: readonly string[]): EstadoLuz[] {
  const salas = ORDEN_SALAS.map((sala, i): EstadoLuz => {
    if (conSello.includes(sala)) return 'hecha';
    const anterior = ORDEN_SALAS[i - 1];
    const abierta = anterior === undefined || conSello.includes(anterior);
    return abierta ? 'siguiente' : 'apagada';
  });
  const todas = ORDEN_SALAS.every((s) => conSello.includes(s));
  return [...salas, todas ? 'siguiente' : 'apagada'];
}

/** Une varias geometrías en una y libera las partes. */
function unir(partes: BufferGeometry[]): BufferGeometry {
  const unida = mergeGeometries(partes);
  partes.forEach((g) => g.dispose());
  if (!unida) throw new Error('No se pudo unir la geometría del mural');
  return unida;
}

/** Las cinco siluetas, en el orden de las salas, con el color de su sello. */
const PIEZAS: readonly { forma: () => BufferGeometry; color: number }[] = [
  // Moneda (sala 1): la misma de la registradora.
  {
    forma: () => new CylinderGeometry(0.09, 0.09, 0.02, 20).rotateX(Math.PI / 2),
    color: 0xd4ac0d,
  },
  // Gota (sala 2): la de la incubadora.
  { forma: () => new SphereGeometry(0.075, 12, 8).scale(1, 1.3, 0.4), color: 0x3498db },
  // Balón (sala 3).
  { forma: () => new SphereGeometry(0.085, 12, 8).scale(1, 1, 0.4), color: 0xe67e22 },
  // Libro (sala 4).
  { forma: () => new BoxGeometry(0.13, 0.17, 0.03), color: 0xc0392b },
  // Llave (sala 5): cabeza redonda, caña y un diente.
  {
    forma: () =>
      unir([
        new CylinderGeometry(0.045, 0.045, 0.02, 16).rotateX(Math.PI / 2).translate(0, 0.06, 0),
        new BoxGeometry(0.03, 0.14, 0.02).translate(0, -0.02, 0),
        new BoxGeometry(0.05, 0.025, 0.02).translate(0.025, -0.075, 0),
      ]),
    color: 0xbdc3c7,
  },
];

/** Separación entre huecos y altura de la fila en el mural (base en y = 0, 1 m de alto). */
const PASO_HUECO = 0.3;
const ALTO_FILA = 0.5;
/** El mural es un plano de 3 cm: lo que sobresalen del centro los huecos y las piezas. */
const FRENTE_HUECO = 0.017;
const FRENTE_PIEZA = 0.03;
const COLOR_HUECO = 0x2c3640;

const COLORES_LUZ: Record<EstadoLuz, Color> = {
  apagada: new Color(0x2b3036),
  siguiente: new Color(0xffc94d),
  hecha: new Color(0x3f8f5c),
};

const xHueco = (i: number): number => (i - (PIEZAS.length - 1) / 2) * PASO_HUECO;

interface Porteria {
  piezas: Mesh<BufferGeometry, MeshLambertMaterial>[];
  luces: InstancedMesh | null;
  /** Salas cuya pieza ya se vio encenderse. Vive con la portería, entre visitas. */
  mostradas: Set<string>;
}

/** Arma el mural y las luces la primera vez; en las visitas siguientes, los reutiliza. */
function armar(raiz: Object3D, mural: Object3D): Porteria {
  const previo = raiz.getObjectByName('mural-piezas');
  if (previo?.userData['porteria']) return previo.userData['porteria'] as Porteria;

  // El grupo sigue al mural pero no cuelga de él: así el resaltado del mural (T18) no toca
  // los materiales de las piezas.
  const grupo = new Group();
  grupo.name = 'mural-piezas';
  grupo.position.copy(mural.position);
  grupo.rotation.copy(mural.rotation);

  const huecos = sinRayo(
    new Mesh(
      unir(
        PIEZAS.map(({ forma }, i) =>
          forma().scale(1.18, 1.18, 0.3).translate(xHueco(i), ALTO_FILA, FRENTE_HUECO),
        ),
      ),
      new MeshLambertMaterial({ color: COLOR_HUECO }),
    ),
  );
  huecos.name = 'mural-huecos';
  grupo.add(huecos);

  const piezas = PIEZAS.map(({ forma, color }, i) => {
    const pieza = sinRayo(
      new Mesh(forma(), new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0 })),
    );
    pieza.name = `mural-pieza-${i + 1}`;
    pieza.position.set(xHueco(i), ALTO_FILA, FRENTE_PIEZA);
    pieza.visible = false;
    grupo.add(pieza);
    return pieza;
  });
  raiz.add(grupo);

  const luces = armarLuces(raiz);
  if (luces) raiz.add(luces);

  const porteria: Porteria = { piezas, luces, mostradas: new Set() };
  grupo.userData['porteria'] = porteria;
  return porteria;
}

/** Una luz encima de cada puerta de sala y dos en la de salida, a los lados del reloj. */
function armarLuces(raiz: Object3D): InstancedMesh | null {
  const salida = raiz.getObjectByName('porteria-salida');
  const puertas = ORDEN_SALAS.map((_, i) => raiz.getObjectByName(`porteria-puerta-${i + 1}`));
  if (!salida || puertas.some((p) => !p)) return null;

  // Sobre el marco: las puertas miden 2,2 m y la de salida 2,4 m (el reloj va en su centro).
  const sitios: { puerta: Object3D; x: number; y: number }[] = [
    ...puertas.map((p) => ({ puerta: p as Object3D, x: 0, y: 2.35 })),
    { puerta: salida, x: -0.6, y: 2.52 },
    { puerta: salida, x: 0.6, y: 2.52 },
  ];
  const luces = sinRayo(
    new InstancedMesh(
      new BoxGeometry(0.3, 0.1, 0.06),
      new MeshBasicMaterial({ color: 0xffffff }),
      sitios.length,
    ),
  );
  luces.name = 'luces-puertas';
  const desplazar = new Matrix4();
  const m = new Matrix4();
  sitios.forEach(({ puerta, x, y }, i) => {
    puerta.updateMatrix();
    m.copy(puerta.matrix).multiply(desplazar.makeTranslation(x, y, 0.05));
    luces.setMatrixAt(i, m);
    luces.setColorAt(i, COLORES_LUZ.apagada);
  });
  return luces;
}

/**
 * @param raiz  la portería ya construida: se buscan el mural, las puertas y la de salida por
 *              su id. Si falta el mural, no se anima nada.
 */
export function animarPorteria(raiz: Object3D): AnimacionSala {
  const mural = raiz.getObjectByName('porteria-mural');
  if (!mural) {
    return { actualizar: () => undefined, estado: 'sin-piezas', liberar: () => undefined };
  }
  const { piezas, luces, mostradas } = armar(raiz, mural);

  /** De 0 (apagada) a 1 (encendida), para cada pieza. */
  const encendido: number[] = ORDEN_SALAS.map((sala) => (mostradas.has(sala) ? 1 : 0));
  let conSello: readonly string[] = [];
  let estadosLuz = lucesDePuertas([]);
  let tiempo = 0;
  const color = new Color();

  const pintarPieza = (i: number): void => {
    const pieza = piezas[i];
    if (!pieza) return;
    const f = encendido[i] ?? 0;
    pieza.visible = f > 0;
    const e = suave(f);
    pieza.scale.setScalar(0.4 + 0.6 * e);
    // Brilla fuerte mientras llega y después se queda con un brillo suave.
    pieza.material.emissiveIntensity = f >= 1 ? 0.35 : 0.9 * e;
  };

  const pintarLuces = (): void => {
    if (!luces) return;
    const latido = 0.7 + 0.3 * Math.sin(tiempo * Math.PI * 2 * LATIDO_HZ);
    estadosLuz.forEach((estado, i) => {
      color.copy(COLORES_LUZ[estado]);
      if (estado === 'siguiente') color.multiplyScalar(latido);
      luces.setColorAt(i, color);
      // La salida tiene dos luces: la última va igual que la penúltima.
      if (i === estadosLuz.length - 1) luces.setColorAt(i + 1, color);
    });
    if (luces.instanceColor) luces.instanceColor.needsUpdate = true;
  };

  const dejarSellos = effect(() => {
    conSello = sellos.value;
    estadosLuz = lucesDePuertas(conSello);
    // Partida nueva: las piezas que ya no tienen sello se apagan sin animación.
    ORDEN_SALAS.forEach((sala, i) => {
      if (!conSello.includes(sala)) {
        mostradas.delete(sala);
        encendido[i] = 0;
      }
      pintarPieza(i);
    });
    pintarLuces();
  });

  return {
    actualizar(dt) {
      tiempo += dt;
      ORDEN_SALAS.forEach((sala, i) => {
        const actual = encendido[i] ?? 0;
        if (!conSello.includes(sala) || actual >= 1) return;
        const nuevo = Math.min(1, actual + dt / DURACION_PIEZA_S);
        encendido[i] = nuevo;
        if (nuevo >= 1) mostradas.add(sala);
        pintarPieza(i);
      });
      if (estadosLuz.includes('siguiente')) pintarLuces();
    },
    get estado() {
      return `mural-${encendido.filter((f) => f >= 1).length}`;
    },
    get detalle() {
      const i = estadosLuz.indexOf('siguiente');
      if (i < 0) return 'luz-ninguna';
      return i < ORDEN_SALAS.length ? `luz-puerta-${i + 1}` : 'luz-salida';
    },
    liberar() {
      dejarSellos();
    },
  };
}
