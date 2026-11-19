/**
 * Piezas por código de la sala 1, la cooperativa (pulir las salas, sesión C): la palanca de la
 * etiquetadora (con su base, que no se mueve) y los tres productos del estante con sus
 * etiquetas. Cada una cabe en el `tam` de su objeto de `salas.json` y es una sola malla.
 */
import { CylinderGeometry, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { ObjetoSala } from '../../../content/esquema-salas';
import { LETRA_TITULO, aleatorio, garabatos } from '../laminas';
import { cajaBiselada, cilindro, enRegion, parte, unirPartes } from './comunes';
import type { ConstructorPieza, Parte, Pieza } from './comunes';
import { PALETA } from './porteria';

type Ctx = CanvasRenderingContext2D;

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

// ---------- Productos ----------

/** Regiones del lienzo de los productos: [x0, y0, x1, y1] en fracciones. */
const REGION = {
  jugo: [0, 0, 0.4, 0.55],
  combo: [0.42, 0, 0.92, 0.55],
  etiqueta: [0, 0.6, 0.3, 0.92],
} as const;

function etiquetasProductos(ctx: Ctx, w: number, h: number): void {
  const zona = (r: readonly number[]) => ({
    x: (r[0] ?? 0) * w,
    y: (r[1] ?? 0) * h,
    w: ((r[2] ?? 0) - (r[0] ?? 0)) * w,
    h: ((r[3] ?? 0) - (r[1] ?? 0)) * h,
  });
  // Cajita de jugo: naranja con una franja blanca, una fruta y el nombre.
  const j = zona(REGION.jugo);
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(j.x, j.y, j.w, j.h);
  ctx.fillStyle = '#fdf2e9';
  ctx.fillRect(j.x, j.y + j.h * 0.58, j.w, j.h * 0.22);
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(j.x + j.w * 0.5, j.y + j.h * 0.3, j.h * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#27ae60';
  ctx.beginPath();
  ctx.ellipse(j.x + j.w * 0.56, j.y + j.h * 0.12, j.h * 0.07, j.h * 0.035, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7e3c08';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(j.h * 0.16)}px ${LETRA_TITULO}`;
  ctx.fillText('JUGO', j.x + j.w / 2, j.y + j.h * 0.69);
  // Caja del combo: roja con el nombre y unas rayas.
  const c = zona(REGION.combo);
  ctx.fillStyle = PALETA.rojo;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = '#f9e79f';
  for (let i = 0; i < 5; i++) ctx.fillRect(c.x + (c.w * (i + 0.3)) / 5, c.y, c.w * 0.06, c.h);
  ctx.fillStyle = '#fdfefe';
  ctx.fillRect(c.x + c.w * 0.1, c.y + c.h * 0.32, c.w * 0.8, c.h * 0.36);
  ctx.fillStyle = PALETA.rojoOscuro;
  ctx.font = `700 ${Math.round(c.h * 0.24)}px ${LETRA_TITULO}`;
  ctx.fillText('COMBO', c.x + c.w / 2, c.y + c.h * 0.51);
  // Etiqueta de precio del estante: blanca con borde amarillo; el precio se lee en la vista 2D.
  const e = zona(REGION.etiqueta);
  ctx.fillStyle = '#f7dc6f';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#fdfefe';
  ctx.fillRect(e.x + e.w * 0.06, e.y + e.h * 0.1, e.w * 0.88, e.h * 0.8);
  ctx.fillStyle = '#1d1a16';
  ctx.font = `700 ${Math.round(e.h * 0.5)}px ${LETRA_TITULO}`;
  ctx.fillText('$', e.x + e.w * 0.2, e.y + e.h * 0.52);
  garabatos(
    ctx,
    aleatorio(3),
    e.x + e.w * 0.36,
    e.y + e.h * 0.5,
    e.w * 0.5,
    e.h * 0.25,
    1,
    '#1d1a16',
  );
}

const productos: ConstructorPieza = (o: ObjetoSala): Pieza => {
  const [ancho, alto, fondo] = o.tam;
  const paso = ancho * 0.375;
  const etiqueta = (x: number, giro: number): Parte =>
    conRegion(
      parte(
        new PlaneGeometry(0.09, 0.045),
        PALETA.blanco,
        [x, 0.03, fondo / 2 + 0.001],
        [0, 0, giro],
      ),
      REGION.etiqueta,
    );
  // Jugo: cajita de cartón con pitillo.
  const jugoW = Math.min(0.12, paso * 0.4);
  const jugoH = alto * 0.78;
  const jugoD = fondo * 0.45;
  const jugo: Parte[] = [
    parte(cajaBiselada(jugoW, jugoH, jugoD, 0.006), '#f39c12', [-paso, jugoH / 2, 0]),
    conRegion(
      parte(new PlaneGeometry(jugoW * 0.94, jugoH * 0.9), PALETA.blanco, [
        -paso,
        jugoH / 2,
        jugoD / 2 + 0.0008,
      ]),
      REGION.jugo,
    ),
    parte(
      cilindro(0.004, 0.004, alto * 0.24, 6),
      '#e74c3c',
      [-paso + jugoW * 0.25, jugoH + alto * 0.08, 0],
      [0, 0, -15],
    ),
  ];
  // Empanada en su plato, con una servilleta.
  const plato = Math.min(0.11, paso * 0.45);
  const empanada: Parte[] = [
    parte(cilindro(plato, plato * 0.8, 0.012, 20), PALETA.blanco, [0, 0.006, 0]),
    parte(new PlaneGeometry(plato * 1.1, plato * 1.1), '#f5cba7', [0, 0.0125, 0], [-90, 0, 20]),
    parte(
      new CylinderGeometry(plato * 0.78, plato * 0.78, 0.035, 14, 1, false, 0, Math.PI).scale(
        1,
        1,
        0.75,
      ),
      '#e0a040',
      [0, 0.03, plato * 0.15],
      [0, 90, 0],
    ),
    parte(
      new TorusGeometry(plato * 0.76, 0.008, 4, 14, Math.PI),
      '#c98a2e',
      [0, 0.03, plato * 0.15],
      [-90, 0, 0],
    ),
  ];
  // Combo: caja de cartón con asa.
  const comboW = Math.min(0.26, paso * 0.85);
  const comboH = alto * 0.62;
  const comboD = fondo * 0.8;
  const combo: Parte[] = [
    parte(cajaBiselada(comboW, comboH, comboD, 0.008), PALETA.rojo, [paso, comboH / 2, 0]),
    conRegion(
      parte(new PlaneGeometry(comboW * 0.96, comboH * 0.9), PALETA.blanco, [
        paso,
        comboH / 2,
        comboD / 2 + 0.0008,
      ]),
      REGION.combo,
    ),
    parte(new TorusGeometry(comboW * 0.22, 0.008, 4, 12, Math.PI), '#f9e79f', [paso, comboH, 0]),
  ];
  return {
    geometria: unirPartes([
      ...jugo,
      ...empanada,
      ...combo,
      // Las etiquetas del estante; la del jugo, medio despegada (ver la ficha 2D).
      etiqueta(-paso, 14),
      etiqueta(0, 0),
      etiqueta(paso, 0),
    ]),
    dibujo: { ancho: 512, alto: 256, pintar: etiquetasProductos },
  };
};

function conRegion(p: Parte, region: readonly [number, number, number, number]): Parte {
  enRegion(p.g, region);
  return { ...p, conDibujo: true };
}

export const PIEZAS_S1: Readonly<Record<string, ConstructorPieza>> = {
  palanca,
  'base-palanca': basePalanca,
  productos,
};
