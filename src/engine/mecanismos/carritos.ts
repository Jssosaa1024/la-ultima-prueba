/**
 * Sala 4 · Los carritos de préstamo, en la escena (T64).
 *
 * Con los ajustes del panel (signal `mecanismo`), en la biblioteca se ve:
 * - sobre cada carrito, un montón de libros tan alto como los que tiene ese día;
 * - la pila del mostrador, que baja a medida que se reparten los libros;
 * - en la pared, las cuatro lámparas del resumen semanal: apagada si está tapada en esta
 *   etapa, tenue si cuenta y verde cuando los carritos cumplen con su número.
 *
 * Los números salen de las mismas reglas del panel (`game/puzzles`). Son nueve mallas más.
 */
import { effect } from '@preact/signals';
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { puzzleDeSala } from '../../content/puzzles';
import { esEstadoCarritos, librosEnPila } from '../../game/puzzles';
import { condiciones, etapa, mecanismo } from '../../signals/mecanismo';
import { sellos } from '../../signals/partida';
import { acercar, sinRayo } from './comunes';
import type { AnimacionSala } from './tipos';

const SALA = 4;
const ID_SALA = 's4-biblioteca';
/** Grosor de un libro acostado sobre el carrito, en metros. */
export const GROSOR_LIBRO = 0.03;
/** La pila nunca desaparece del todo: queda una base para poder tocarla. */
const PILA_MINIMA = 0.08;
/** Las cuatro lámparas, en el orden de la pared. */
export const LAMPARAS = ['media', 'mediana', 'moda', 'rango'] as const;

const COLOR_LIBROS = 0xd9822b;
const COLOR_TAPADA = 0x20262d;
const COLOR_ESPERA = 0x6b5a2a;
const COLOR_VERDE = 0x4ee08a;

export function animarCarritos(raiz: Object3D): AnimacionSala {
  const puzzle = puzzleDeSala(SALA);
  const grupo = raiz.getObjectByName('s4-carritos') ?? null;
  const pila = raiz.getObjectByName('s4-pila-libros') ?? null;
  const pared = raiz.getObjectByName('s4-lamparas') ?? null;
  // Sin esas piezas (otra distribución de la sala) no hay nada que animar.
  if (!puzzle || puzzle.mecanismo !== 'carritos' || !grupo || !pila || !pared) {
    return { actualizar: () => undefined, estado: 'sin-piezas', liberar: () => undefined };
  }

  // Un montón por carrito: una caja de un metro de alto que se estira con la escala.
  const caja = new BoxGeometry(0.36, 1, 0.26).translate(0, 0.5, 0);
  const tapas = new MeshLambertMaterial({ color: COLOR_LIBROS });
  const montones = grupo.children.map((carrito) => {
    const monton = sinRayo(new Mesh(caja, tapas));
    // Encima del carrito: su caja mide 0,7 m de alto y tiene la base en el piso.
    monton.position.set(carrito.position.x, 0.7, carrito.position.z);
    monton.scale.y = 0.001;
    monton.visible = false;
    grupo.add(monton);
    return { malla: monton, meta: 0, alto: 0 };
  });

  // Las lámparas, delante del cartel del resumen semanal (que mira hacia +Z).
  const foco = new BoxGeometry(0.34, 0.2, 0.04);
  const lamparas = LAMPARAS.map((_, i) => {
    const malla = sinRayo(new Mesh(foco, new MeshBasicMaterial({ color: COLOR_TAPADA })));
    malla.position.set(-0.84 + i * 0.56, 0.3, 0.04);
    pared.add(malla);
    return malla;
  });

  const altoPila = pila.scale.y;
  let metaPila = altoPila;
  let quieto = false;
  let verdes = 0;

  const dejarDeSeguir = effect(() => {
    const actual = etapa.value;
    const datos = actual?.puzzle === puzzle.id ? puzzle.etapas[actual.etapa] : undefined;
    const estado: unknown = mecanismo.value;
    const cumple = condiciones.value;
    const conSello = sellos.value.includes(ID_SALA);
    quieto = false;
    verdes = 0;

    if (!datos || !esEstadoCarritos(datos, estado)) {
      // Sala resuelta: los libros se quedan como en la solución y las cuatro lámparas en verde.
      const final = conSello ? puzzle.etapas[puzzle.etapas.length - 1]?.solucion.carritos : null;
      montones.forEach((m, i) => (m.meta = (final?.[i] ?? 0) * GROSOR_LIBRO));
      metaPila = conSello ? altoPila * PILA_MINIMA : altoPila;
      for (const l of lamparas) l.material.color.set(conSello ? COLOR_VERDE : COLOR_TAPADA);
      verdes = conSello ? lamparas.length : 0;
      return;
    }

    montones.forEach((m, i) => (m.meta = (estado.carritos[i] ?? 0) * GROSOR_LIBRO));
    const queda = librosEnPila(datos, estado) / datos.controles.libros;
    metaPila = altoPila * Math.max(PILA_MINIMA, queda);
    LAMPARAS.forEach((id, i) => {
      const activa = datos.exito.lamparas[id] !== undefined;
      const verde = activa && cumple[id] === true;
      if (verde) verdes++;
      lamparas[i]?.material.color.set(verde ? COLOR_VERDE : activa ? COLOR_ESPERA : COLOR_TAPADA);
    });
  });

  return {
    actualizar(dt) {
      if (quieto) return;
      let falta = false;
      for (const m of montones) {
        m.alto = acercar(m.alto, m.meta, dt);
        falta ||= m.alto !== m.meta;
        m.malla.visible = m.alto > 0.002;
        m.malla.scale.y = Math.max(m.alto, 0.001);
      }
      const y = acercar(pila.scale.y, metaPila, dt);
      falta ||= y !== metaPila;
      pila.scale.y = y;
      quieto = !falta;
    },
    get estado() {
      return quieto ? `lamparas-${verdes}` : 'moviendo';
    },
    liberar() {
      dejarDeSeguir();
    },
  };
}
