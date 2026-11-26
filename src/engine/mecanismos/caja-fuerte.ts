/**
 * Sala 5 · La caja fuerte se abre en 3D al resolver (punto 17 del hito 1).
 *
 * La caja de `salas.json` (`s5-caja-fuerte`) recibe una puerta con su dial y su manija,
 * bisagra a la izquierda, y la llave del sello adentro, sobre una repisa. Cuando la sala gana su
 * sello, la puerta gira hacia afuera y deja ver la llave: es la silueta del sello 5 en el mural
 * de la portería. Si el panel de la urna está abierto, espera a que se cierre o se recoja en su
 * pestaña, para que se vea.
 *
 * Son dos mallas más (la puerta y la llave); la llave solo se dibuja con la puerta abierta.
 * Cuelgan de la caja, así que se liberan con la sala. Pulir salas (sesión B): el cuerpo hueco
 * con su forro y su repisa, la puerta y la llave salen de `rectoria-piezas.ts`.
 */
import { effect } from '@preact/signals';
import { Group, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { panel, panelRecogido } from '../../signals/interfaz';
import { sellos } from '../../signals/partida';
import { sonar } from '../audio/eventos';
import { sinRayo } from './comunes';
import { suave } from './curvas';
import { CAJA, LLAVE_CAJA, REPISA_CAJA, geometriaLlave, geometriaPuerta } from './rectoria-piezas';
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
  const { ancho, alto, marco } = CAJA;
  const frente = CAJA.fondo / 2;
  const anchoPuerta = ancho - 2 * marco;
  const altoPuerta = alto - 2 * marco;

  // La bisagra va en el borde izquierdo del frente; la puerta cuelga de ella.
  const bisagra = new Group();
  bisagra.name = 'caja-fuerte-bisagra';
  bisagra.position.set(-anchoPuerta / 2, marco, frente + 0.016);
  const puerta = sinRayo(
    new Mesh(
      geometriaPuerta(anchoPuerta, altoPuerta),
      new MeshLambertMaterial({ vertexColors: true }),
    ),
  );
  puerta.name = 'caja-fuerte-puerta';
  bisagra.add(puerta);

  // Adentro, de pie sobre la repisa: la llave del sello, dorada y con un poco de brillo.
  const llave = sinRayo(
    new Mesh(
      geometriaLlave(),
      new MeshLambertMaterial({
        color: 0xd4ac0d,
        emissive: 0xd4ac0d,
        emissiveIntensity: 0.45,
        vertexColors: true,
      }),
    ),
  );
  llave.name = 'caja-fuerte-llave';
  llave.position.set(LLAVE_CAJA.x, REPISA_CAJA, LLAVE_CAJA.z);
  caja.add(bisagra, llave);

  // Si la sala ya tenía su sello al entrar, la caja está abierta desde el principio.
  let conSello = sellos.peek().includes(SALA);
  let apertura = conSello ? 1 : 0;

  const colocar = (): void => {
    bisagra.rotation.y = anguloPuerta(apertura);
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
      // Se abre cuando el jugador puede verla: sin panel encima o con el panel recogido.
      if (!conSello || apertura >= 1 || (panel.peek() !== null && !panelRecogido.peek())) return;
      // El cerrojo y la bisagra suenan al empezar a abrirse (T43).
      if (apertura === 0) sonar('caja-fuerte');
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
