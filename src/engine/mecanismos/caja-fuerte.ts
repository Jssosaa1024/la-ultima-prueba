/**
 * Sala 5 · La caja fuerte se abre en 3D al resolver (punto 17 del hito 1).
 *
 * La caja de `salas.json` (`s5-caja-fuerte`) recibe una puerta con su perilla, bisagra a la
 * izquierda, y un fondo oscuro con la llave del sello adentro. Cuando la sala gana su sello,
 * la puerta gira hacia afuera y deja ver la llave: es la silueta del sello 5 en el mural de la
 * portería. Si el panel de la urna está abierto, espera a que se cierre, para que se vea.
 *
 * Son cuatro mallas más (puerta, perilla, fondo y llave); el fondo y la llave solo se dibujan
 * con la puerta abierta. Cuelgan de la caja, así que se liberan con la sala.
 */
import { effect } from '@preact/signals';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { panel } from '../../signals/interfaz';
import { sellos } from '../../signals/partida';
import { sinRayo } from './comunes';
import { suave } from './curvas';
import type { AnimacionSala } from './tipos';

const SALA = 's5-rectoria';
const OBJETO = 's5-caja-fuerte';
/** Lo que tarda la puerta en abrirse, en segundos. */
export const DURACION_APERTURA_S = 1.4;
/** Cuánto gira la puerta al abrirse, en radianes (hacia afuera, unos 110°). */
export const ANGULO_ABIERTA = 1.9;

/** Ángulo de la puerta (negativo: gira hacia +Z, afuera) cuando va `f` de la apertura. */
export function anguloPuerta(f: number): number {
  return -ANGULO_ABIERTA * suave(f);
}

export function animarCajaFuerte(raiz: Object3D): AnimacionSala {
  const caja = raiz.getObjectByName(OBJETO);
  if (!caja) {
    return { actualizar: () => undefined, estado: 'sin-caja', liberar: () => undefined };
  }
  // Medidas de la caja de `salas.json` (0,7 × 0,9 × 0,6 m; base en y = 0, frente hacia +Z).
  const ancho = 0.7;
  const alto = 0.9;
  const frente = 0.3;
  const marco = 0.05;
  const anchoPuerta = ancho - 2 * marco;
  const altoPuerta = alto - 2 * marco;

  // La bisagra va en el borde izquierdo del frente; la puerta cuelga de ella.
  const bisagra = new Group();
  bisagra.name = 'caja-fuerte-bisagra';
  bisagra.position.set(-anchoPuerta / 2, marco, frente + 0.016);
  const puerta = sinRayo(
    new Mesh(
      new BoxGeometry(anchoPuerta, altoPuerta, 0.03).translate(anchoPuerta / 2, altoPuerta / 2, 0),
      new MeshLambertMaterial({ color: 0x34495e }),
    ),
  );
  puerta.name = 'caja-fuerte-puerta';
  const perilla = sinRayo(
    new Mesh(
      new CylinderGeometry(0.06, 0.06, 0.03, 20).rotateX(Math.PI / 2),
      new MeshLambertMaterial({ color: 0xbdc3c7 }),
    ),
  );
  perilla.position.set(anchoPuerta * 0.7, altoPuerta / 2, 0.03);
  bisagra.add(puerta, perilla);

  // Adentro: un fondo oscuro sobre el frente (hace de hueco) y la llave del sello.
  const fondo = sinRayo(
    new Mesh(
      new BoxGeometry(anchoPuerta - 0.02, altoPuerta - 0.02, 0.004),
      new MeshLambertMaterial({ color: 0x111418 }),
    ),
  );
  fondo.position.set(0, alto / 2, frente + 0.003);
  const piezas = [
    new CylinderGeometry(0.05, 0.05, 0.02, 16).rotateX(Math.PI / 2).translate(0, 0.07, 0),
    new BoxGeometry(0.035, 0.16, 0.02).translate(0, -0.03, 0),
    new BoxGeometry(0.06, 0.03, 0.02).translate(0.03, -0.09, 0),
  ];
  const forma = mergeGeometries(piezas);
  piezas.forEach((g) => g.dispose());
  const llave = sinRayo(
    new Mesh(
      forma ?? new BoxGeometry(0.06, 0.2, 0.02),
      new MeshLambertMaterial({ color: 0xd4ac0d, emissive: 0xd4ac0d, emissiveIntensity: 0.25 }),
    ),
  );
  llave.name = 'caja-fuerte-llave';
  llave.position.set(0, alto / 2, frente + 0.02);
  caja.add(bisagra, fondo, llave);

  // Si la sala ya tenía su sello al entrar, la caja está abierta desde el principio.
  let conSello = sellos.peek().includes(SALA);
  let apertura = conSello ? 1 : 0;

  const colocar = (): void => {
    bisagra.rotation.y = anguloPuerta(apertura);
    fondo.visible = apertura > 0;
    llave.visible = apertura > 0;
  };
  colocar();

  const dejarSellos = effect(() => {
    conSello = sellos.value.includes(SALA);
    if (!conSello) {
      // Partida nueva sin salir de la sala (solo con `?sala=`): la caja vuelve a cerrarse.
      apertura = 0;
      colocar();
    }
  });

  return {
    actualizar(dt) {
      // Se abre cuando el jugador puede verla: sin panel encima.
      if (!conSello || apertura >= 1 || panel.peek() !== null) return;
      apertura = Math.min(1, apertura + dt / DURACION_APERTURA_S);
      colocar();
    },
    get estado() {
      if (apertura >= 1) return 'caja-abierta';
      return apertura > 0 ? 'caja-abriendo' : 'caja-cerrada';
    },
    liberar() {
      dejarSellos();
    },
  };
}
