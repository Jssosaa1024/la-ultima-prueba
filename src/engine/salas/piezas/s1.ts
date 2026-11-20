/**
 * Piezas por código de la sala 1, la cooperativa (pulir las salas, sesión C): la palanca de la
 * etiquetadora (con su base, que no se mueve) y lo que el Food Kit no tiene de los productos:
 * la empanada y las etiquetas (T19p). Cada una cabe en el `tam` de su objeto de `salas.json`
 * y es una sola malla.
 */
import { CylinderGeometry, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { ObjetoSala } from '../../../content/esquema-salas';
import { cajaBiselada, cilindro, parte, unirPartes } from './comunes';
import type { ConstructorPieza, Parte, Pieza } from './comunes';
import { PALETA } from './porteria';

// ---------- Palanca de la etiquetadora ----------

/**
 * La palanca que baja con cada impresión (`etiquetadora.ts` gira el objeto en x desde su
 * base): el eje, la vara y el pomo rojo. La base va aparte (`base-palanca`) para no girar.
 */
const palanca: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, alto] = o.tam;
  const r = ancho / 2;
  const pomo = r * 0.95;
  const partes: Parte[] = [
    // Eje a lo ancho, a ras de la base.
    parte(
      cilindro(r * 0.55, r * 0.55, ancho, 12),
      PALETA.metalOscuro,
      [0, r * 0.55, 0],
      [0, 0, 90],
    ),
    // Vara con un collar donde se une al eje.
    parte(cilindro(r * 0.38, r * 0.38, r * 0.5, 10), PALETA.metal, [0, r * 0.9, 0]),
    parte(cilindro(r * 0.22, r * 0.26, alto - 2 * pomo - r * 0.6, 10), PALETA.metalClaro, [
      0,
      r * 0.6 + (alto - 2 * pomo - r * 0.6) / 2,
      0,
    ]),
    parte(new SphereGeometry(pomo, 12, 8), PALETA.rojo, [0, alto - pomo, 0]),
  ];
  return { geometria: unirPartes(partes) };
};

/** La base atornillada al mostrador, con la ranura por donde baja la palanca. */
const basePalanca: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, alto, fondo] = o.tam;
  const partes: Parte[] = [
    parte(cajaBiselada(ancho, alto * 0.55, fondo, alto * 0.2), PALETA.metalOscuro, [
      0,
      alto * 0.275,
      0,
    ]),
    // Dos orejas que sostienen el eje.
    ...[-1, 1].map((lado) =>
      parte(cajaBiselada(ancho * 0.16, alto, fondo * 0.4, ancho * 0.03), PALETA.metal, [
        lado * ancho * 0.36,
        alto / 2,
        0,
      ]),
    ),
    ...[-1, 1].flatMap((lado) =>
      [-1, 1].map((frente) =>
        parte(cilindro(ancho * 0.05, ancho * 0.05, alto * 0.1, 8), PALETA.metalClaro, [
          lado * ancho * 0.36,
          alto * 0.57,
          frente * fondo * 0.36,
        ]),
      ),
    ),
  ];
  return { geometria: unirPartes(partes) };
};

// ---------- Detalle de los productos ----------

/**
 * Centro en x de la cajita de jugo y de la bolsa del combo, en metros desde el borde del objeto.
 * El modelo `productos` (Kenney Food Kit, T19p) mide 2,4 unidades de punta a punta y el motor
 * lo ajusta al ancho de 1,2 m: 0,5 m por unidad, con la cajita de 20 cm de alto y la bolsa de
 * 30. La cajita (0,23 unidades de ancho) empieza en el borde izquierdo y la bolsa, de lado
 * (0,412), acaba en el derecho. Ver `art/modelos.json`.
 */
const CENTRO_JUGO = 0.0575;
const CENTRO_COMBO = 0.103;

/**
 * Grosor de la repisa de exhibición. El objeto del detalle va esa medida más abajo que
 * `s1-productos` (ver `salas.json`), así que la cara de arriba de la repisa queda justo donde
 * el modelo apoya su base.
 */
export const GROSOR_REPISA = 0.012;

/** Etiqueta de precio del estante: borde amarillo, papel blanco, el «$» y el precio garabateado. */
function etiqueta(x: number, y: number, z: number, giro: number): Parte[] {
  const en = (dx: number, dy: number, dz: number): [number, number, number] => {
    const r = (giro * Math.PI) / 180;
    return [
      x + dx * Math.cos(r) - dy * Math.sin(r),
      y + dx * Math.sin(r) + dy * Math.cos(r),
      z + dz,
    ];
  };
  return [
    parte(new PlaneGeometry(0.09, 0.045), '#f7dc6f', en(0, 0, 0), [0, 0, giro]),
    parte(new PlaneGeometry(0.08, 0.036), PALETA.blanco, en(0, 0, 0.0006), [0, 0, giro]),
    parte(new PlaneGeometry(0.012, 0.022), '#1d1a16', en(-0.026, 0, 0.0012), [0, 0, giro]),
    parte(new PlaneGeometry(0.04, 0.007), '#1d1a16', en(0.01, 0.005, 0.0012), [0, 0, giro]),
    parte(new PlaneGeometry(0.03, 0.005), '#5d5a55', en(0.005, -0.007, 0.0012), [0, 0, giro]),
  ];
}

/**
 * Lo que el Food Kit no tiene (T19p): la empanada en su plato, con su servilleta, las tres
 * etiquetas de precio y la repisa de exhibición que los sostiene. La fila va delante del
 * estante del fondo (su caja de choque llega a z = −1,95 y taparía el toque), y sin repisa se
 * vería flotando delante del mueble. Va en un objeto aparte que no se toca, sin dibujo, así que
 * se une a la malla fija de la sala: cero draw calls. El jugo y el combo son el modelo de
 * `s1-productos`, que es el objeto que se examina. Todo queda DENTRO de las cajas de toque de
 * `s1-productos` (tres cajas con la cara a 0,1 m del centro): si algo de la malla
 * fija asomara delante, el rayo la tocaría primero y el toque se perdería.
 */
const detalleProductos: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, , fondo] = o.tam;
  const xJugo = -ancho / 2 + CENTRO_JUGO;
  const xCombo = ancho / 2 - CENTRO_COMBO;
  // Todo lo que va encima de la repisa sube su grosor.
  const e = GROSOR_REPISA;
  const plato = 0.092;
  const empanada: Parte[] = [
    parte(cilindro(plato, plato * 0.8, 0.012, 20), PALETA.blanco, [0, e + 0.006, 0]),
    parte(new PlaneGeometry(plato * 1.1, plato * 1.1), '#f5cba7', [0, e + 0.0125, 0], [-90, 0, 20]),
    parte(
      new CylinderGeometry(plato * 0.78, plato * 0.78, 0.035, 14, 1, false, 0, Math.PI).scale(
        1,
        1,
        0.75,
      ),
      '#e0a040',
      [0, e + 0.03, plato * 0.15],
      [0, 90, 0],
    ),
    parte(
      new TorusGeometry(plato * 0.76, 0.008, 4, 14, Math.PI),
      '#c98a2e',
      [0, e + 0.03, plato * 0.15],
      [-90, 0, 0],
    ),
  ];
  // Las etiquetas, de pie en el borde de la repisa, 4 mm detrás de la cara de las cajas de toque.
  const y = e + 0.0245;
  const z = fondo / 2 - 0.004;
  return {
    geometria: unirPartes([
      parte(cajaBiselada(ancho, e, fondo, 0.003), '#b9773f', [0, e / 2, 0]),
      ...empanada,
      // La del jugo, medio despegada (ver la ficha 2D).
      ...etiqueta(xJugo, y, z, 14),
      ...etiqueta(0, y, z, 0),
      ...etiqueta(xCombo, y, z, 0),
    ]),
  };
};

export const PIEZAS_S1: Readonly<Record<string, ConstructorPieza>> = {
  palanca,
  'base-palanca': basePalanca,
  'detalle-productos': detalleProductos,
};
