/**
 * Sala 4 · Los carritos de préstamo, en la escena (T64).
 *
 * Con los ajustes del panel (signal `mecanismo`), en la biblioteca se ve:
 * - sobre cada carrito, un montón de libros tan alto como los que tiene ese día;
 * - la pila del mostrador, que baja a medida que se reparten los libros;
 * - en la pared, las cuatro lámparas del resumen semanal: apagada si está tapada en esta
 *   etapa, tenue si cuenta y verde cuando los carritos cumplen con su número.
 *
 * Los números salen de las mismas reglas del panel (`game/puzzles`). Son cuatro mallas más
 * (los focos).
 *
 * Pulir salas (sesión B): los montones y la pila son columnas de libros de verdad, en la misma
 * malla de cada carrito y de la pila (`biblioteca-piezas.ts`), de las que se dibujan tantos
 * libros como tiene cada lugar; los focos son domos de vidrio en su carcasa. Los carritos, la
 * pila y la carcasa los arma `pulirBiblioteca` antes de esta animación.
 */
import { effect } from '@preact/signals';
import { Mesh, MeshBasicMaterial } from 'three';
import type { Object3D } from 'three';
import { puzzleDeSala } from '../../content/puzzles';
import { esEstadoCarritos, librosEnPila } from '../../game/puzzles';
import { condiciones, etapa, mecanismo } from '../../signals/mecanismo';
import { sellos } from '../../signals/partida';
import {
  LIBROS_MAXIMOS,
  geometriaVidrio,
  mostrarLibros,
  xDeFoco,
  Y_FOCO,
  Z_VIDRIO,
} from './biblioteca-piezas';
import { acercar, sinRayo } from './comunes';
import type { AnimacionSala } from './tipos';

const SALA = 4;
const ID_SALA = 's4-biblioteca';
/** Grosor de un libro acostado sobre el carrito, en metros. */
export const GROSOR_LIBRO = 0.03;
/** Las cuatro lámparas, en el orden de la pared. */
export const LAMPARAS = ['media', 'mediana', 'moda', 'rango'] as const;

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

  // Un montón por carrito: la columna de 20 libros que lleva su malla (pulirBiblioteca), de la
  // que se dibujan los que tiene.
  const montones = (grupo.children.slice(0, 5) as Mesh[]).map((malla) => ({
    malla,
    meta: 0,
    alto: 0,
  }));

  // Las lámparas: el vidrio de cada foco, delante del resumen semanal (que mira hacia +Z).
  const vidrio = geometriaVidrio();
  const lamparas = LAMPARAS.map((id, i) => {
    const malla = sinRayo(
      new Mesh(vidrio, new MeshBasicMaterial({ color: COLOR_TAPADA, vertexColors: true })),
    );
    malla.name = `foco-${id}`;
    malla.position.set(xDeFoco(i), Y_FOCO, Z_VIDRIO);
    pared.add(malla);
    return malla;
  });

  // La pila se mide en libros (de 0 a 20): se dibujan los que quedan sobre su tarima.
  const llena = LIBROS_MAXIMOS;
  let enPila = llena;
  let metaPila = llena;
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
      metaPila = conSello ? 0 : llena;
      for (const l of lamparas) l.material.color.set(conSello ? COLOR_VERDE : COLOR_TAPADA);
      verdes = conSello ? lamparas.length : 0;
      return;
    }

    montones.forEach((m, i) => (m.meta = (estado.carritos[i] ?? 0) * GROSOR_LIBRO));
    const queda = librosEnPila(datos, estado) / datos.controles.libros;
    metaPila = llena * Math.max(0, Math.min(1, queda));
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
        // Los libros aparecen de a uno a medida que el montón sube.
        mostrarLibros(m.malla, Math.round(m.alto / GROSOR_LIBRO));
      }
      enPila = acercar(enPila, metaPila, dt, 8);
      falta ||= enPila !== metaPila;
      mostrarLibros(pila as Mesh, enPila);
      quieto = !falta;
    },
    get animando() {
      return !quieto;
    },
    get estado() {
      return quieto ? `lamparas-${verdes}` : 'moviendo';
    },
    liberar() {
      dejarDeSeguir();
    },
  };
}
