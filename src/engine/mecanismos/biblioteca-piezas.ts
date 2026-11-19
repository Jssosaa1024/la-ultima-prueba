/**
 * Sala 4 · La biblioteca, pulida por código (pulir salas, sesión B).
 *
 * Lo que anima la máquina de los carritos se rehace con más detalle sin cambiar su id, su caja
 * de choque ni su animación:
 * - **Carritos de préstamo:** cada caja azul pasa a ser un carrito de biblioteca con ruedas,
 *   costados y espaldar azules, tres repisas de madera, manija y portaetiqueta. Sigue siendo la
 *   misma malla (la que se toca); el espaldar cierra la parte de atrás, así que el toque no
 *   atraviesa el carrito.
 * - **Montones de libros:** cada carrito lleva encima, en su misma malla, una columna de 20
 *   libros de colores (tapas, lomo y hojas), de la que se dibujan solo los que tiene
 *   (`setDrawRange`). Así se ven y se cuentan libros de verdad, sin mallas aparte.
 * - **Pila del mostrador:** 20 libros sobre una tarima baja. La máquina dibuja los que quedan;
 *   la tarima siempre se ve y se puede tocar, aunque la pila quede vacía.
 * - **Focos del resumen semanal:** la carcasa (placa, aro cromado y tornillos) es una malla hija
 *   del tablero: tocarla es tocar el resumen semanal. El vidrio de cada foco sigue siendo la
 *   malla que cambia de color.
 *
 * Lo que no se anima (la ficha rota y la alfombra) son piezas del registro de la sesión C
 * (`src/engine/salas/piezas/biblioteca.ts`).
 */
import { Mesh, MeshLambertMaterial } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { PALETA } from './piezas-comunes';
import { Piezas, vestirMalla } from './piezas-por-codigo';

const C = PALETA;

/** Colores del carrito: el azul de la caja de antes, más vivo, y madera de las repisas. */
const AZUL = '#2a6fa8';
const AZUL_OSCURO = '#1d4f7a';
const MADERA = '#c98b52';
const MADERA_OSCURA = '#9c6538';

/** Tapas de los libros, en el orden en que se apilan (se repiten). El naranja va primero. */
export const TAPAS = [
  '#d9822b',
  '#2e86c1',
  '#c0392b',
  '#27ae60',
  '#f1c40f',
  '#8e44ad',
  '#16a085',
  '#e67e22',
  '#34495e',
] as const;
const HOJAS = '#f3ead7';

/** Libros por montón y en la pila: el puzzle reparte 20. */
export const LIBROS_MAXIMOS = 20;
/** Grosor de un libro de la pila: 20 libros y la tarima llenan los 0,6 m de su caja. */
const GROSOR_PILA = 0.027;
const ALTO_TARIMA = 0.06;
/** Altura de la bandeja de arriba del carrito, donde se apoya el montón. */
export const ALTURA_BANDEJA = 0.672;

/** Un número entre 0 y 1 que siempre es el mismo para la misma semilla (sin azar). */
function fijo(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Un libro acostado, con la base en y = 0: tapa de abajo, hojas, tapa de arriba y lomo hacia −X.
 * Siempre tiene los mismos triángulos, para poder dibujar los primeros `k` libros de una pila.
 */
function libro(p: Piezas, ancho: number, fondo: number, grosor: number, tapa: string): void {
  const t = Math.min(0.004, grosor * 0.15);
  p.caja([ancho, t, fondo], tapa, { pos: [0, t / 2, 0] });
  p.caja([ancho, t, fondo], tapa, { pos: [0, grosor - t / 2, 0] });
  p.caja([ancho - 0.012, grosor - 2 * t, fondo - 0.01], HOJAS, { pos: [0.004, grosor / 2, 0] });
  p.caja([0.008, grosor, fondo], tapa, { pos: [-ancho / 2 + 0.004, grosor / 2, 0] });
}

/** Una columna de libros desde y = `base`, con las marcas de dónde termina cada uno. */
function columnaDeLibros(
  p: Piezas,
  semilla: number,
  base: number,
  grosor: number,
  medidas: { ancho: number; fondo: number; mueve: number },
): number[] {
  const cortes = [p.triangulos * 3];
  for (let i = 0; i < LIBROS_MAXIMOS; i++) {
    const s = semilla * 31 + i * 7;
    const ancho = medidas.ancho - 0.03 * fijo(s);
    const fondo = medidas.fondo - 0.025 * fijo(s + 1);
    const tapa = TAPAS[(i + semilla) % TAPAS.length] ?? TAPAS[0];
    p.en(
      {
        pos: [(fijo(s + 2) - 0.5) * medidas.mueve, base + i * grosor, (fijo(s + 3) - 0.5) * 0.02],
        // Uno de cada dos va con el lomo al otro lado, y todos algo girados.
        giro: [0, (i % 2 === 0 ? 0 : 180) + (fijo(s + 4) - 0.5) * 8, 0],
      },
      () => libro(p, ancho, fondo, grosor, tapa),
    );
    cortes.push(p.triangulos * 3);
  }
  return cortes;
}

/** En `userData` de una columna de libros: los vértices hasta el libro `k` (de 0 a 20). */
const CORTES = 'cortesLibros';

/** Dibuja solo los primeros `k` libros de una columna (y su base, si la tiene). */
export function mostrarLibros(malla: Mesh, k: number): void {
  const cortes = malla.userData[CORTES] as number[] | undefined;
  if (!cortes) return;
  const n = Math.max(0, Math.min(LIBROS_MAXIMOS, Math.round(k)));
  malla.geometry.setDrawRange(0, cortes[n] ?? Infinity);
  malla.userData['libros'] = n;
}

/**
 * Libros que se dibujan en una columna, según el rango de dibujo de su geometría (para las
 * pruebas y el panel de depuración). 0 si la malla no es una columna de libros.
 */
export function librosVisibles(malla: Object3D): number {
  const cortes = malla.userData[CORTES] as number[] | undefined;
  const geometria = (malla as Mesh).geometry as BufferGeometry | undefined;
  if (!cortes || !geometria) return 0;
  const hasta = Math.min(geometria.drawRange.count, cortes[cortes.length - 1] ?? 0);
  return Math.max(
    0,
    cortes.findIndex((c) => c >= hasta),
  );
}

/** Un carrito con su montón de 20 libros sobre la bandeja de arriba. Devuelve los cortes. */
export function carritoConLibros(p: Piezas, semilla: number): number[] {
  carrito(p);
  return columnaDeLibros(p, semilla, ALTURA_BANDEJA, 0.03, {
    ancho: 0.29,
    fondo: 0.21,
    mueve: 0.03,
  });
}

/** Prepara una malla que dibuja una columna de libros con `mostrarLibros`. */
export function comoColumna(malla: Mesh, cortes: number[], k = 0): Mesh {
  malla.userData[CORTES] = cortes;
  mostrarLibros(malla, k);
  return malla;
}

/** Un carrito de préstamo en su caja de 0,5 × 0,7 × 0,4 m, con la base en y = 0 y el frente hacia +Z. */
export function carrito(p: Piezas): void {
  // Ruedas en las cuatro esquinas: rueda de 8 lados y horquilla.
  for (const x of [-0.19, 0.19]) {
    for (const z of [-0.14, 0.14]) {
      p.cilindro(0.03, 0.022, C.negro, { pos: [x + 0.011, 0.03, z], giro: [0, 0, 90], lados: 8 });
      p.caja([0.036, 0.05, 0.03], C.metal, { pos: [x, 0.065, z] });
    }
  }
  // Chasis, costados, espaldar y moldura de arriba de los costados.
  p.caja([0.5, 0.025, 0.4], AZUL_OSCURO, { pos: [0, 0.0925, 0], bisel: 0.008 });
  for (const x of [-0.2375, 0.2375]) {
    p.caja([0.025, 0.6, 0.38], AZUL, { pos: [x, 0.4, 0], bisel: 0.008 });
    p.caja([0.027, 0.05, 0.385], AZUL_OSCURO, { pos: [x, 0.675, 0] });
  }
  p.caja([0.45, 0.6, 0.02], AZUL, { pos: [0, 0.4, -0.17] });
  // Repisas de madera con su ceja delantera y una raya de veta.
  for (const [y, ceja] of [
    [0.115, 0.05],
    [0.39, 0.05],
    [ALTURA_BANDEJA - 0.0125, 0.03],
  ] as const) {
    p.caja([0.45, 0.025, 0.36], MADERA, { pos: [0, y, 0] });
    p.caja([0.45, ceja, 0.016], AZUL_OSCURO, {
      pos: [0, Math.min(y - 0.0125 + ceja / 2, 0.7 - ceja / 2), 0.186],
      bisel: 0.004,
    });
    p.caja([0.4, 0.002, 0.008], MADERA_OSCURA, { pos: [0, y + 0.0135, 0.06] });
  }
  // Portaetiqueta de latón con su tarjeta, en la ceja de la repisa del medio.
  p.caja([0.13, 0.04, 0.006], C.laton, { pos: [0, 0.39, 0.195] });
  p.caja([0.11, 0.028, 0.004], C.papel, { pos: [0, 0.39, 0.197] });
  // Manija atrás, de lado a lado, con sus dos soportes (dentro de la caja del carrito).
  p.barra([-0.17, 0.6, -0.188], [0.17, 0.6, -0.188], 0.01, C.cromo, 6);
  for (const x of [-0.17, 0.17]) {
    p.barra([x, 0.6, -0.16], [x, 0.6, -0.19], 0.008, C.cromo, 6);
  }
}

/** La pila del mostrador: tarima baja y 20 libros encima. Devuelve sus cortes. */
export function pila(p: Piezas): number[] {
  p.caja([0.38, 0.03, 0.28], MADERA, { pos: [0, ALTO_TARIMA - 0.015, 0], bisel: 0.006 });
  for (const z of [-0.11, 0, 0.11]) {
    p.caja([0.36, ALTO_TARIMA - 0.03, 0.04], MADERA_OSCURA, {
      pos: [0, (ALTO_TARIMA - 0.03) / 2, z],
      bisel: 0.004,
    });
  }
  return columnaDeLibros(p, 4, ALTO_TARIMA, GROSOR_PILA, { ancho: 0.31, fondo: 0.22, mueve: 0.02 });
}

/** Columnas de los focos en el resumen semanal, respecto a su centro (las de su lámina). */
export function xDeFoco(i: number): number {
  const margen = 0.03;
  const columna = (2.4 - 2 * margen) / 4;
  return -1.2 + margen + columna * (i + 0.5);
}
/** Nombre de la malla de las carcasas de los focos, hija del resumen semanal. */
export const CARCASA_FOCOS = 'carcasa-focos';
/** Altura del centro de los focos sobre la base del resumen semanal (0,6 m de alto). */
export const Y_FOCO = 0.27;
/** Dónde empieza el vidrio del foco, delante del tablero (que mide 3 cm de grueso). */
export const Z_VIDRIO = 0.058;

/** Carcasa de un foco: placa con tornillos y aro cromado, delante del tablero. */
function carcasaFoco(p: Piezas, x: number): void {
  p.caja([0.25, 0.25, 0.02], C.metalOscuro, { pos: [x, Y_FOCO, 0.025], bisel: 0.02 });
  for (const dx of [-0.095, 0.095]) {
    for (const dy of [-0.095, 0.095]) {
      p.cilindro(0.01, 0.006, C.cromo, {
        pos: [x + dx, Y_FOCO + dy, 0.035],
        giro: [90, 0, 0],
        lados: 6,
      });
    }
  }
  p.torno(
    [
      [0.104, 0.035],
      [0.106, 0.045],
      [0.1, 0.06],
      [0.086, 0.062],
      [0.084, 0.05],
    ],
    C.cromo,
    { pos: [x, Y_FOCO, 0], giro: [90, 0, 0], lados: 20 },
  );
}

/** El vidrio de un foco: un domo bajo que mira hacia +Z, con la base en z = 0. */
export function geometriaVidrio(): BufferGeometry {
  const p = new Piezas();
  p.torno(
    [
      [0.086, 0],
      [0.082, 0.014],
      [0.066, 0.026],
      [0.04, 0.034],
      [0, 0.037],
    ],
    '#ffffff',
    { giro: [90, 0, 0], lados: 20, suave: true },
  );
  return p.geometria();
}

/**
 * Viste los carritos y la pila, y une las carcasas de los focos a lo fijo. Se puede llamar
 * varias veces con la misma sala: lo hecho no se repite.
 */
export function pulirBiblioteca(raiz: Object3D): void {
  const grupo = raiz.getObjectByName('s4-carritos');
  // Los cinco carritos son las piezas del grupo, cada uno con su montón (vacío al empezar).
  grupo?.children.slice(0, 5).forEach((carro, i) => {
    const p = new Piezas();
    const cortes = carritoConLibros(p, i);
    if (vestirMalla(carro, p)) comoColumna(carro as Mesh, cortes, 0);
  });

  const malla = raiz.getObjectByName('s4-pila-libros') as Mesh | undefined;
  if (malla?.isMesh && !malla.userData[CORTES]) {
    const p = new Piezas();
    const cortes = pila(p);
    if (vestirMalla(malla, p)) comoColumna(malla, cortes, LIBROS_MAXIMOS);
  }

  // La carcasa de los focos cuelga del tablero: si se toca, se examina el resumen semanal.
  const pared = raiz.getObjectByName('s4-lamparas');
  if (pared && !pared.getObjectByName(CARCASA_FOCOS)) {
    const p = new Piezas();
    for (let i = 0; i < 4; i++) carcasaFoco(p, xDeFoco(i));
    const carcasa = new Mesh(p.geometria(), new MeshLambertMaterial({ vertexColors: true }));
    carcasa.name = CARCASA_FOCOS;
    pared.add(carcasa);
  }
}
