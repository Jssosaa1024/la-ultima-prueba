/**
 * Qué se ve desde dónde en una sala con tramos de pasillo (`docs/pasillos.md`). Matemática pura,
 * sin Three, con tests.
 *
 * Three.js no dibuja lo que queda fuera del encuadre, pero sí lo que está detrás de una pared:
 * desde una esquina del pasillo, mirando hacia la portería, entraban en cuadro casi todos los
 * objetos de la portería y del pasillo (55 draw calls; el límite de AGENTS.md es 40). Como las
 * paredes van del piso al techo, basta mirar la planta en 2D:
 *
 * - El piso se parte en celdas de 2 m como máximo.
 * - Desde varios puntos de cada celda se traza una recta hasta las esquinas y el centro de la
 *   huella de cada objeto. Si alguna no cruza una pared, el objeto se ve desde esa celda.
 * - En el juego, al cambiar de celda, lo que no se ve desde ella deja de dibujarse.
 *
 * Es conservador: los muebles no tapan nada y un roce con la punta de una pared cuenta como
 * visto. Se calcula una vez, al armar la sala.
 */
import type { Rectangulo } from '../../content/tramos';
import type { ParedPlanta } from './planta';

/** Un tramo de pared en la planta: de (ax, az) a (bx, bz). */
export interface Segmento {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/** Lo que ocupa un objeto en el piso. */
export interface Huella {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Celda {
  x: readonly [number, number];
  z: readonly [number, number];
}

/** Lado máximo de una celda, en metros. */
export const LADO_CELDA = 2;
/**
 * Puntos por lado desde los que se mira en cada celda (4 × 4, con los bordes): si un objeto se
 * asoma apenas desde una orilla de la celda, también cuenta.
 */
const MUESTRAS = [0, 1 / 3, 2 / 3, 1] as const;
/** Cada cuánto se toma un punto del borde de una huella grande, en metros. */
const PASO_HUELLA = 1;
/** Lo que se considera cero al cruzar rectas. */
const EPS = 1e-9;

/** La cara de cada pared como segmento: a lo largo de la pared es (cos giro, −sen giro). */
export function segmentosDeParedes(paredes: readonly ParedPlanta[]): Segmento[] {
  return paredes.map((p) => {
    const ux = (Math.cos(p.giro) * p.largo) / 2;
    const uz = (-Math.sin(p.giro) * p.largo) / 2;
    return { ax: p.x - ux, az: p.z - uz, bx: p.x + ux, bz: p.z + uz };
  });
}

/** Las celdas de cada rectángulo, de `LADO_CELDA` como máximo, en orden. */
export function celdasDe(rects: readonly Rectangulo[], lado = LADO_CELDA): Celda[] {
  const celdas: Celda[] = [];
  for (const r of rects) {
    const nx = Math.max(1, Math.ceil((r.x[1] - r.x[0]) / lado - EPS));
    const nz = Math.max(1, Math.ceil((r.z[1] - r.z[0]) / lado - EPS));
    const dx = (r.x[1] - r.x[0]) / nx;
    const dz = (r.z[1] - r.z[0]) / nz;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        celdas.push({
          x: [r.x[0] + i * dx, r.x[0] + (i + 1) * dx],
          z: [r.z[0] + j * dz, r.z[0] + (j + 1) * dz],
        });
      }
    }
  }
  return celdas;
}

/** La celda donde está el punto, o −1 si no está en ninguna (fuera del piso). */
export function celdaEn(celdas: readonly Celda[], x: number, z: number): number {
  return celdas.findIndex((c) => x >= c.x[0] && x <= c.x[1] && z >= c.z[0] && z <= c.z[1]);
}

/** Producto cruz de (b − a) × (c − a): positivo si c queda a la izquierda de a→b. */
function cruz(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

/** `true` si el segmento p→q atraviesa la pared (cruce propio; rozar una punta no tapa). */
function cruza(px: number, pz: number, qx: number, qz: number, s: Segmento): boolean {
  const d1 = cruz(s.ax, s.az, s.bx, s.bz, px, pz);
  const d2 = cruz(s.ax, s.az, s.bx, s.bz, qx, qz);
  const d3 = cruz(px, pz, qx, qz, s.ax, s.az);
  const d4 = cruz(px, pz, qx, qz, s.bx, s.bz);
  return (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  );
}

/** `true` si desde (px, pz) se ve (qx, qz): ninguna pared se mete en medio. */
export function seVe(
  px: number,
  pz: number,
  qx: number,
  qz: number,
  paredes: readonly Segmento[],
): boolean {
  return !paredes.some((s) => cruza(px, pz, qx, qz, s));
}

/** El centro de una huella y puntos de su borde (las esquinas y uno cada metro): a donde se mira. */
export function puntosDe(h: Huella): [number, number][] {
  const puntos: [number, number][] = [[(h.minX + h.maxX) / 2, (h.minZ + h.maxZ) / 2]];
  const nx = Math.max(1, Math.ceil((h.maxX - h.minX) / PASO_HUELLA));
  const nz = Math.max(1, Math.ceil((h.maxZ - h.minZ) / PASO_HUELLA));
  for (let i = 0; i <= nx; i++) {
    const x = h.minX + ((h.maxX - h.minX) * i) / nx;
    puntos.push([x, h.minZ], [x, h.maxZ]);
  }
  for (let j = 1; j < nz; j++) {
    const z = h.minZ + ((h.maxZ - h.minZ) * j) / nz;
    puntos.push([h.minX, z], [h.maxX, z]);
  }
  return puntos;
}

/** Para cada celda, los índices de las huellas que se ven desde algún punto de ella. */
export function visiblesPorCelda(
  celdas: readonly Celda[],
  huellas: readonly Huella[],
  paredes: readonly Segmento[],
): number[][] {
  const destinos = huellas.map(puntosDe);
  return celdas.map((c) => {
    const desde: [number, number][] = [];
    for (const fx of MUESTRAS) {
      for (const fz of MUESTRAS) {
        desde.push([c.x[0] + (c.x[1] - c.x[0]) * fx, c.z[0] + (c.z[1] - c.z[0]) * fz]);
      }
    }
    const vistas: number[] = [];
    destinos.forEach((puntos, i) => {
      const visto = desde.some(([px, pz]) =>
        puntos.some(([qx, qz]) => seVe(px, pz, qx, qz, paredes)),
      );
      if (visto) vistas.push(i);
    });
    return vistas;
  });
}
