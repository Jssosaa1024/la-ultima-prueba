/**
 * Sala 1 · La etiquetadora en 3D (T45).
 *
 * Cada vez que la máquina responde (signal `resultado`), la palanca baja y vuelve a subir y
 * una etiqueta nueva sale por el frente. Cuando la sala gana su sello, el cajón de la
 * registradora se abre con la moneda del sello, y se queda abierto.
 *
 * Son tres mallas más en la sala (etiqueta, cajón y moneda), y solo se dibujan cuando se ven.
 */
import { effect } from '@preact/signals';
import { BoxGeometry, CylinderGeometry, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { resultado } from '../../signals/mecanismo';
import { sellos } from '../../signals/partida';
import { idaYVuelta, mezclar, suave } from './curvas';
import type { AnimacionSala } from './tipos';

const SALA = 's1-cooperativa';
const PUZZLE = 's1-etiquetadora';

/** Lo que dura una impresión: la palanca baja y sube, y la etiqueta sale. En segundos. */
export const DURACION_IMPRESION_S = 0.9;
/** Lo que tarda en abrirse el cajón de la registradora. */
export const DURACION_CAJON_S = 0.6;
/** Hasta dónde baja la palanca, en radianes (hacia el jugador). */
const ANGULO_PALANCA = 1.1;

// Posición en z de la etiqueta y del cajón, relativa a su máquina (el frente mira a +Z).
const ETIQUETA_DENTRO = 0.12;
const ETIQUETA_FUERA = 0.24;
const CAJON_CERRADO = 0.04;
const CAJON_ABIERTO = 0.26;

/** Cuánto ha bajado la palanca (0 arriba, 1 abajo) a los `t` segundos de la impresión. */
export function palancaEn(t: number): number {
  // Baja rápido en el primer 40 % y sube despacio en el resto.
  return idaYVuelta(t, DURACION_IMPRESION_S);
}

/** Cuánto ha salido la etiqueta (0 adentro, 1 afuera): empieza cuando la palanca llega abajo. */
export function etiquetaEn(t: number): number {
  const inicio = DURACION_IMPRESION_S * 0.4;
  return suave((t - inicio) / (DURACION_IMPRESION_S - inicio));
}

/**
 * @param raiz  la sala ya construida: se buscan la palanca, la etiquetadora y la registradora
 *              por su id. Si falta alguna, esa parte no se anima.
 */
export function animarEtiquetadora(raiz: Object3D): AnimacionSala {
  const palanca = raiz.getObjectByName('s1-palanca');
  const maquina = raiz.getObjectByName('s1-etiquetadora');
  const registradora = raiz.getObjectByName('s1-registradora');

  const etiqueta = new Mesh(
    new BoxGeometry(0.14, 0.004, 0.1),
    new MeshLambertMaterial({ color: 0xfdfefe }),
  );
  etiqueta.name = 'etiqueta-impresa';
  etiqueta.position.set(0, 0.08, ETIQUETA_DENTRO);
  etiqueta.visible = false;
  maquina?.add(etiqueta);

  const cajon = new Mesh(
    new BoxGeometry(0.38, 0.08, 0.3),
    new MeshLambertMaterial({ color: 0x3d4852 }),
  );
  cajon.name = 'cajon-registradora';
  cajon.position.set(0, 0.05, CAJON_CERRADO);
  // La moneda es la silueta del sello de la sala 1 en el mural de la portería.
  const moneda = new Mesh(
    new CylinderGeometry(0.045, 0.045, 0.012, 16),
    new MeshLambertMaterial({ color: 0xd4ac0d }),
  );
  moneda.position.set(0, 0.046, 0.07);
  cajon.add(moneda);
  registradora?.add(cajon);

  /** Segundos desde que empezó la impresión en curso, o `null` si la máquina está quieta. */
  let impresion: number | null = null;
  let hayEtiqueta = false;
  let conSello = sellos.peek().includes(SALA);
  // Si la sala ya tenía su sello al entrar, el cajón está abierto desde el principio.
  let apertura = conSello ? 1 : 0;

  const colocarCajon = (): void => {
    cajon.visible = apertura > 0;
    cajon.position.z = mezclar(CAJON_CERRADO, CAJON_ABIERTO, suave(apertura));
  };
  colocarCajon();

  // El resultado que ya estaba al entrar no se anima: pasó antes de llegar.
  let ultimo = resultado.peek()?.n ?? 0;
  const dejarResultado = effect(() => {
    const r = resultado.value;
    if (!r || r.n === ultimo) return;
    ultimo = r.n;
    if (r.puzzle === PUZZLE) impresion = 0;
  });
  const dejarSellos = effect(() => {
    conSello = sellos.value.includes(SALA);
    if (!conSello) {
      // Partida nueva sin salir de la sala (solo pasa con `?sala=`): todo vuelve a su sitio.
      apertura = 0;
      colocarCajon();
    }
  });

  return {
    actualizar(dt) {
      if (impresion !== null) {
        impresion += dt;
        const t = impresion;
        if (palanca) palanca.rotation.x = ANGULO_PALANCA * palancaEn(t);
        const fuera = etiquetaEn(t);
        // La etiqueta anterior desaparece al bajar la palanca y sale una nueva.
        hayEtiqueta = fuera > 0;
        etiqueta.visible = hayEtiqueta;
        etiqueta.position.z = mezclar(ETIQUETA_DENTRO, ETIQUETA_FUERA, fuera);
        if (t >= DURACION_IMPRESION_S) impresion = null;
      }
      // El cajón espera a que termine la impresión que ganó el sello.
      if (conSello && impresion === null && apertura < 1) {
        apertura = Math.min(1, apertura + dt / DURACION_CAJON_S);
        colocarCajon();
      }
    },
    get estado() {
      if (impresion !== null) return 'imprimiendo';
      if (apertura >= 1) return 'registradora-abierta';
      return hayEtiqueta ? 'etiqueta-impresa' : 'reposo';
    },
    liberar() {
      dejarResultado();
      dejarSellos();
    },
  };
}
