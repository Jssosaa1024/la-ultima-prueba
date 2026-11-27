/**
 * Director de las escenas de la historia (Historia A): mueve una cámara propia por la portería
 * según los planos de `content/escenas.ts` y pone lo que la escena necesita y la sala no tiene:
 * Don Efraín (una silueta a contraluz con gorra), la pantalla encima del casillero y la luz de
 * la calle cuando la puerta de salida está abierta.
 *
 * Todo es geometría por código (unas siete draw calls, menos de 1.500 triángulos) y se libera
 * con `liberar()` al terminar la escena: nada se descarga. La cámara del jugador no se toca.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import type { Object3D } from 'three';
import {
  escenaPorId,
  orientacionHacia,
  PANTALLA,
  planoEn,
  tomaEn,
  type EscenaId,
  type EstadoPantalla,
  type Plano,
} from '../../content/escenas';
import { liberarObjeto } from '../carga/liberar';
import { aplicarACamara } from '../jugador/camara';
import { sonar } from '../audio/eventos';

/** Más cerrado que la cámara del jugador (70°): se ve como un plano de cine. */
const FOV_ESCENA = 58;

const COLOR_PANTALLA: Readonly<Record<EstadoPantalla, number>> = {
  apagada: 0x07090c,
  encendida: 0x2c5fae,
  copiando: 0x2f8a58,
  borrada: 0x7c2a22,
};

/** La puerta de salida mide 1,6 × 2,4 m y está en la pared norte (`salas.json`). */
const PUERTA = { ancho: 1.5, alto: 2.3, z: -4.955 };

export interface Director {
  /** Cámara con la que se dibuja mientras dura la escena. */
  readonly camara: PerspectiveCamera;
  /** Pone la escena en el instante `ms` (`performance.now()`). Devuelve dónde está la cámara. */
  actualizar(ms: number, aspecto: number): { x: number; z: number };
  liberar(): void;
}

export interface OpcionesDirector {
  id: EscenaId;
  /** `performance.now()` del inicio (`signals/escena.ts`). */
  desde: number;
  /** La portería ya construida: los props cuelgan de ella y se esconde la puerta al abrirla. */
  raiz: Object3D;
  /** `prefers-reduced-motion`: sin desplazamientos de cámara, un corte por plano. */
  reducido: () => boolean;
  /** Para las pruebas: sin sonidos. */
  sonar?: typeof sonar;
}

/** Silueta de Don Efraín: cuerpo, cabeza y gorra con visera. Mira hacia +Z del grupo. */
function crearEfrain(): { grupo: Group; gorra: Group } {
  const grupo = new Group();
  grupo.name = 'escena-efrain';
  const ropa = new MeshLambertMaterial({ color: 0x1f2633 });
  const piel = new MeshLambertMaterial({ color: 0x5b4636 });
  const azul = new MeshLambertMaterial({ color: 0x22355a });
  const cuerpo = new Mesh(new CapsuleGeometry(0.21, 0.83, 4, 10), ropa);
  cuerpo.position.y = 0.21 + 0.83 / 2 + 0.06;
  const cabeza = new Mesh(new SphereGeometry(0.13, 12, 8), piel);
  cabeza.position.y = 1.5;
  const gorra = new Group();
  const copa = new Mesh(new CylinderGeometry(0.135, 0.14, 0.08, 12), azul);
  const visera = new Mesh(new BoxGeometry(0.18, 0.02, 0.13), azul);
  visera.position.set(0, -0.03, 0.13);
  gorra.add(copa, visera);
  grupo.add(cuerpo, cabeza, gorra);
  return { grupo, gorra };
}

/** La pantalla de la portería: un monitor sobre el casillero; el vidrio cambia de color. */
function crearPantalla(): { grupo: Group; vidrio: MeshBasicMaterial } {
  const grupo = new Group();
  grupo.name = 'escena-pantalla';
  const negro = new MeshLambertMaterial({ color: 0x1b1d22 });
  const marco = new Mesh(new BoxGeometry(0.8, 0.5, 0.06), negro);
  // El pie llega al techo del casillero (1,8 m).
  const pie = new Mesh(new BoxGeometry(0.14, 0.1, 0.14), negro);
  pie.position.y = 1.85 - PANTALLA[1];
  const vidrio = new MeshBasicMaterial({ color: COLOR_PANTALLA.apagada });
  const plano = new Mesh(new PlaneGeometry(0.72, 0.42), vidrio);
  plano.position.z = 0.031;
  grupo.add(marco, pie, plano);
  grupo.position.set(PANTALLA[0], PANTALLA[1], PANTALLA[2]);
  return { grupo, vidrio };
}

/** La puerta abierta: la luz de la calle, cálida, del tamaño del vano. */
function crearLuzPuerta(): Mesh {
  const luz = new Mesh(
    new PlaneGeometry(PUERTA.ancho, PUERTA.alto),
    new MeshBasicMaterial({ color: 0xf4d59a }),
  );
  luz.name = 'escena-luz-puerta';
  luz.position.set(0, PUERTA.alto / 2, PUERTA.z);
  return luz;
}

export function crearDirector(o: OpcionesDirector): Director {
  const escena = escenaPorId(o.id);
  const tocar = o.sonar ?? sonar;
  const camara = new PerspectiveCamera(FOV_ESCENA, 1, 0.05, 50);
  const props = new Group();
  props.name = 'escena-props';
  const efrain = crearEfrain();
  const pantalla = crearPantalla();
  const luz = crearLuzPuerta();
  props.add(efrain.grupo, pantalla.grupo, luz);
  o.raiz.add(props);

  // La puerta de salida (su modelo) se esconde cuando está abierta; al terminar, vuelve.
  const puerta = o.raiz.getObjectByName('porteria-salida') ?? null;
  const puertaVisible = puerta?.visible ?? true;
  let planoAnterior = -1;

  const aplicarPlano = (p: Plano): void => {
    pantalla.vidrio.color.setHex(COLOR_PANTALLA[p.pantalla ?? 'apagada']);
    pantalla.grupo.visible = p.pantalla !== undefined;
    luz.visible = p.puerta === true;
    if (puerta) puerta.visible = p.puerta === true ? false : puertaVisible;
    const e = p.efrain ?? null;
    efrain.grupo.visible = e !== null;
    if (e) {
      efrain.grupo.position.set(e.x, 0, e.z);
      efrain.grupo.rotation.y = Math.atan2(e.mira[0] - e.x, e.mira[1] - e.z);
      // Con la gorra puesta, en la cabeza; sin ella, en la mano, a la altura de la cintura.
      if (e.gorra) {
        efrain.gorra.position.set(0, 1.63, 0);
        efrain.gorra.rotation.set(0, 0, 0);
      } else {
        efrain.gorra.position.set(0.27, 0.86, 0.08);
        efrain.gorra.rotation.set(Math.PI / 2.4, 0, 0);
      }
    }
    if (p.sonido) tocar(p.sonido);
  };

  return {
    camara,
    actualizar(ms, aspecto) {
      const t = (ms - o.desde) / 1000;
      // Después del último plano se queda en el último cuadro hasta que la interfaz la cierre.
      const ultimo = escena.planos.length - 1;
      const en = planoEn(escena, t) ?? {
        indice: ultimo,
        plano: escena.planos[ultimo] as Plano,
        avance: 1,
      };
      if (en.indice !== planoAnterior) {
        planoAnterior = en.indice;
        aplicarPlano(en.plano);
      }
      const toma = tomaEn(en.plano, en.avance, o.reducido());
      camara.position.set(toma.pos[0], toma.pos[1], toma.pos[2]);
      aplicarACamara(camara, orientacionHacia(toma.pos, toma.mira));
      if (camara.aspect !== aspecto) {
        camara.aspect = aspecto;
        camara.updateProjectionMatrix();
      }
      return { x: toma.pos[0], z: toma.pos[2] };
    },
    liberar() {
      if (puerta) puerta.visible = puertaVisible;
      props.removeFromParent();
      liberarObjeto(props);
    },
  };
}
