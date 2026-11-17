/**
 * Ventanas de noche (T19k): lo que más rápido dice «son las 23:59 y el colegio está cerrado».
 *
 * Las paredes son cajas sin huecos, así que la ventana va pegada a la pared: un cielo hecho
 * con geometría low-poly y colores por vértice (degradado azul de noche, cerros oscuros,
 * casitas encendidas y, si se pide, la luna), sin texturas, y delante el marco metálico con
 * sus parteluces y el alféizar.
 *
 * - El marco es de color plano: se une a la malla fija de la sala (`acabados.ts`).
 * - El cielo no toma luz de la sala: va en la malla de los difusores de las lámparas, que ya
 *   se dibuja sin luz y sin tono. Ninguna de las dos es una draw call nueva.
 *
 * Todo se arma en las coordenadas de la pared (x a lo largo, y hacia arriba, z hacia la sala)
 * y se pone en el mundo con el giro de la pared, como el zócalo.
 */
import { BoxGeometry, CircleGeometry, Color, Float32BufferAttribute, PlaneGeometry } from 'three';
import type { BufferGeometry } from 'three';
import type { Sala } from '../../content/esquema-salas';
import type { Pared } from './acabados';

export type Ventana = NonNullable<NonNullable<Sala['acabados']>['ventanas']>[number];

/** Perfil del marco: ancho y cuánto sobresale de la pared. */
export const MARCO = 0.06;
const FONDO_MARCO = 0.05;
/** Los parteluces dividen el vidrio en paños de más o menos este ancho. */
const ANCHO_PANO = 0.75;
const PARTELUZ = 0.035;
/** Por debajo de esta altura no lleva travesaño. */
const ALTO_CON_TRAVESANO = 0.6;
/** Alféizar: la repisa de abajo, más ancha que el marco. */
export const ALFEIZAR = { alto: 0.04, fondo: 0.1, sobra: 0.05 };

/** Capas del cielo, de atrás hacia adelante, en metros desde la pared. */
const CAPA = { cielo: 0.006, halo: 0.007, luna: 0.008, cerros: 0.01, casas: 0.012 };

const CIELO_ARRIBA = new Color('#060b18');
const CIELO_ABAJO = new Color('#1c2b4d');
const COLOR_CERROS = new Color('#0a1120');
const COLOR_CASA = new Color('#ffd27a');
const COLOR_LUNA = new Color('#f2ecd4');
const COLOR_HALO_LUNA = new Color('#22345c');

/** Número entre 0 y 1 que depende solo de `n`: la misma ventana sale igual siempre. */
export function azar(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Pinta los vértices de una geometría con un color, o con el que diga `colorDe`. */
function pintar(g: BufferGeometry, colorDe: (y: number) => Color): BufferGeometry {
  const p = g.getAttribute('position');
  const datos = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = colorDe(p.getY(i));
    datos[i * 3] = c.r;
    datos[i * 3 + 1] = c.g;
    datos[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(datos, 3));
  return g;
}

/** Altura de los cerros (desde el borde de abajo del vidrio) en `x`: entre el 15 y el 42 %. */
export function alturaCerros(x: number, alto: number, semilla: number): number {
  const s = semilla * 1.7;
  const ola = 0.5 + 0.5 * Math.sin(x * 3.1 + s);
  const detalle = 0.5 + 0.5 * Math.sin(x * 7.3 + 2 * s + 1);
  return alto * (0.15 + 0.17 * ola + 0.1 * detalle);
}

/** El cielo de una ventana de `ancho × alto`, con la base en y = 0 y centrado en x = 0. */
function cielo(v: Ventana, semilla: number): BufferGeometry[] {
  const { ancho: a, alto: h } = v;
  const tono = new Color();
  const fondo = pintar(new PlaneGeometry(a, h).translate(0, h / 2, CAPA.cielo), (y) =>
    tono.copy(CIELO_ABAJO).lerp(CIELO_ARRIBA, y / h),
  );

  // Cerros: una tira con la fila de arriba subida o bajada a la altura de cada punto.
  const tramos = Math.max(4, Math.round(a / 0.2));
  const cerros = new PlaneGeometry(a, 1, tramos, 1);
  const p = cerros.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const arriba = i <= tramos;
    p.setY(i, arriba ? alturaCerros(p.getX(i), h, semilla) : 0);
    p.setZ(i, CAPA.cerros);
  }
  pintar(cerros, () => COLOR_CERROS);

  // Casitas encendidas en la ladera, un poco por debajo del borde de los cerros.
  const escala = Math.min(1, h / 0.75);
  const n = 3 + Math.floor(azar(semilla * 7 + 1) * 3);
  const casas = Array.from({ length: n }, (_, k) => {
    const x = -a / 2 + (a * (k + 0.25 + 0.5 * azar(semilla * 13 + k))) / n;
    const borde = alturaCerros(x, h, semilla);
    const y = Math.max(0.03, borde - (0.05 + 0.07 * azar(semilla * 17 + k)) * escala);
    return pintar(
      new PlaneGeometry(0.07 * escala, 0.05 * escala).translate(x, y, CAPA.casas),
      () => COLOR_CASA,
    );
  });

  const partes = [fondo, cerros, ...casas];
  if (v.luna) {
    const r = 0.09 * escala;
    const x = a * 0.22;
    const y = h * 0.72;
    partes.push(
      pintar(new CircleGeometry(r * 2.2, 12).translate(x, y, CAPA.halo), () => COLOR_HALO_LUNA),
      pintar(new CircleGeometry(r, 12).translate(x, y, CAPA.luna), () => COLOR_LUNA),
    );
  }
  return partes;
}

/** Marco, parteluces, travesaño y alféizar, con la base del vidrio en y = 0. */
function marco(v: Ventana): BufferGeometry[] {
  const { ancho: a, alto: h } = v;
  const b = MARCO;
  const d = FONDO_MARCO;
  const piezas = [
    new BoxGeometry(b, h + 2 * b, d).translate(-(a + b) / 2, h / 2, d / 2),
    new BoxGeometry(b, h + 2 * b, d).translate((a + b) / 2, h / 2, d / 2),
    new BoxGeometry(a, b, d).translate(0, h + b / 2, d / 2),
    new BoxGeometry(a, b, d).translate(0, -b / 2, d / 2),
    new BoxGeometry(a + 2 * b + 2 * ALFEIZAR.sobra, ALFEIZAR.alto, ALFEIZAR.fondo).translate(
      0,
      -b - ALFEIZAR.alto / 2,
      ALFEIZAR.fondo / 2,
    ),
  ];
  const panos = Math.max(1, Math.round(a / ANCHO_PANO));
  for (let k = 1; k < panos; k++) {
    piezas.push(
      new BoxGeometry(PARTELUZ, h, PARTELUZ).translate(
        -a / 2 + (a * k) / panos,
        h / 2,
        PARTELUZ / 2 + CAPA.cielo,
      ),
    );
  }
  if (h >= ALTO_CON_TRAVESANO) {
    piezas.push(
      new BoxGeometry(a, PARTELUZ, PARTELUZ).translate(0, h * 0.62, PARTELUZ / 2 + CAPA.cielo),
    );
  }
  return piezas;
}

/**
 * Una ventana puesta en el mundo.
 *
 * @param pared    la pared donde va (ver `paredesDe`).
 * @param a        su centro a lo largo de la pared, en las coordenadas de la pared.
 * @param semilla  distinta para cada ventana de la sala: cambia los cerros y las casitas.
 */
export function armarVentana(
  pared: Pared,
  a: number,
  v: Ventana,
  semilla: number,
): { marco: BufferGeometry[]; cielo: BufferGeometry[] } {
  const poner = (g: BufferGeometry): BufferGeometry =>
    g.translate(a, v.y, 0).rotateY(pared.giro).translate(pared.x, 0, pared.z);
  return { marco: marco(v).map(poner), cielo: cielo(v, semilla).map(poner) };
}
