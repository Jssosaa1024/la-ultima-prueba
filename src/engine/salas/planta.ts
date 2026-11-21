/**
 * La planta de una sala con tramos de pasillo (`docs/pasillos.md`): dónde van las paredes cuando
 * el piso no es un solo rectángulo. Matemática pura, sin Three, con tests.
 *
 * El piso es la unión del rectángulo de la sala y sus `tramos`. Se parte en una cuadrícula con
 * todos los bordes de los rectángulos; una celda está adentro si su centro cae en alguno. Hay
 * pared en cada borde entre una celda de adentro y una de afuera, y los bordes seguidos de una
 * misma recta se unen en un solo tramo de pared. Donde un rectángulo toca a otro no hay pared.
 *
 * Una sala sin tramos da sus cuatro paredes de siempre, en el mismo orden (norte, sur, oeste y
 * este), para que nada cambie en las salas 1 a 5.
 */
import type { Rectangulo } from '../../content/tramos';

/**
 * Cara de adentro de una pared: su centro, su largo y el giro que lleva +Z hacia la sala (la
 * normal hacia adentro es (sen giro, cos giro)). `rincones` dice si cada punta (primero la de
 * −largo/2 a lo largo de la pared, después la de +largo/2) es un rincón de la sala: ahí se
 * oscurece la esquina. En la punta de un vano o de una esquina que sobresale, no.
 */
export interface ParedPlanta {
  x: number;
  z: number;
  largo: number;
  giro: number;
  rincones: [boolean, boolean];
}

/** Lo que se considera el mismo número (los bordes vienen de un JSON con dos decimales). */
const EPS = 1e-6;

function unicos(valores: number[]): number[] {
  const orden = [...valores].sort((a, b) => a - b);
  return orden.filter((v, i) => i === 0 || v - (orden[i - 1] as number) > EPS);
}

/** La cuadrícula de la planta: los cortes en x y z y qué celdas están adentro. */
export interface Cuadricula {
  xs: number[];
  zs: number[];
  /** `adentro(i, j)`: la celda de xs[i]..xs[i+1] y zs[j]..zs[j+1]. Fuera de rango, `false`. */
  adentro: (i: number, j: number) => boolean;
}

export function cuadricula(rects: readonly Rectangulo[]): Cuadricula {
  const xs = unicos(rects.flatMap((r) => [r.x[0], r.x[1]]));
  const zs = unicos(rects.flatMap((r) => [r.z[0], r.z[1]]));
  const celdas: boolean[][] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = ((xs[i] as number) + (xs[i + 1] as number)) / 2;
    const fila: boolean[] = [];
    for (let j = 0; j < zs.length - 1; j++) {
      const cz = ((zs[j] as number) + (zs[j + 1] as number)) / 2;
      fila.push(rects.some((r) => cx > r.x[0] && cx < r.x[1] && cz > r.z[0] && cz < r.z[1]));
    }
    celdas.push(fila);
  }
  return { xs, zs, adentro: (i, j) => celdas[i]?.[j] ?? false };
}

/**
 * Cuántas de las cuatro celdas alrededor del vértice (xs[i], zs[j]) están adentro. Con una
 * sola, el vértice es un rincón de la sala (ángulo de 90° por dentro); con tres, una esquina que
 * sobresale; con dos seguidas, la punta de una pared que se corta en un vano.
 */
function celdasAdentro(c: Cuadricula, i: number, j: number): number {
  return [
    c.adentro(i - 1, j - 1),
    c.adentro(i, j - 1),
    c.adentro(i - 1, j),
    c.adentro(i, j),
  ].filter(Boolean).length;
}

/** Un borde con pared, ya unido con los que le siguen en la misma recta y del mismo lado. */
interface Borde {
  /** `x`: pared en x = fijo, a lo largo de z. `z`: pared en z = fijo, a lo largo de x. */
  eje: 'x' | 'z';
  fijo: number;
  desde: number;
  hasta: number;
  /** Índice del corte fijo y de los cortes de las puntas, en la cuadrícula. */
  iFijo: number;
  iDesde: number;
  iHasta: number;
  /** Hacia dónde queda la sala: +1 si hacia el lado positivo del eje fijo. */
  lado: 1 | -1;
}

function bordes(c: Cuadricula): Borde[] {
  const lista: Borde[] = [];
  // Paredes en x = xs[i] (separan la celda i−1 de la i), recorridas a lo largo de z.
  for (let i = 0; i < c.xs.length; i++) {
    let abierto: Borde | null = null;
    for (let j = 0; j <= c.zs.length - 1; j++) {
      const a = c.adentro(i - 1, j);
      const b = c.adentro(i, j);
      const lado: 0 | 1 | -1 = a === b || j === c.zs.length - 1 ? 0 : b ? 1 : -1;
      if (abierto && (lado === 0 || lado !== abierto.lado)) {
        lista.push(abierto);
        abierto = null;
      }
      if (lado !== 0 && !abierto) {
        abierto = {
          eje: 'x',
          fijo: c.xs[i] as number,
          iFijo: i,
          desde: c.zs[j] as number,
          iDesde: j,
          hasta: c.zs[j + 1] as number,
          iHasta: j + 1,
          lado,
        };
      } else if (lado !== 0 && abierto) {
        abierto.hasta = c.zs[j + 1] as number;
        abierto.iHasta = j + 1;
      }
    }
    if (abierto) lista.push(abierto);
  }
  // Paredes en z = zs[j] (separan la celda j−1 de la j), recorridas a lo largo de x.
  for (let j = 0; j < c.zs.length; j++) {
    let abierto: Borde | null = null;
    for (let i = 0; i <= c.xs.length - 1; i++) {
      const a = c.adentro(i, j - 1);
      const b = c.adentro(i, j);
      const lado: 0 | 1 | -1 = a === b || i === c.xs.length - 1 ? 0 : b ? 1 : -1;
      if (abierto && (lado === 0 || lado !== abierto.lado)) {
        lista.push(abierto);
        abierto = null;
      }
      if (lado !== 0 && !abierto) {
        abierto = {
          eje: 'z',
          fijo: c.zs[j] as number,
          iFijo: j,
          desde: c.xs[i] as number,
          iDesde: i,
          hasta: c.xs[i + 1] as number,
          iHasta: i + 1,
          lado,
        };
      } else if (lado !== 0 && abierto) {
        abierto.hasta = c.xs[i + 1] as number;
        abierto.iHasta = i + 1;
      }
    }
    if (abierto) lista.push(abierto);
  }
  return lista;
}

/** Las paredes de la planta, con la cara hacia adentro. */
export function paredesDeRectangulos(rects: readonly Rectangulo[]): ParedPlanta[] {
  const c = cuadricula(rects);
  return bordes(c).map((b) => {
    const largo = b.hasta - b.desde;
    const medio = (b.desde + b.hasta) / 2;
    // Normal hacia adentro: en una pared x = fijo es (lado, 0); en una z = fijo, (0, lado).
    const [nx, nz] = b.eje === 'x' ? [b.lado, 0] : [0, b.lado];
    const giro = Math.atan2(nx, nz);
    // El eje «a lo largo» de la pared es (cos giro, −sen giro): la punta −largo/2 está en
    // `desde` si ese eje va hacia el lado positivo de la recta.
    const aLoLargo = b.eje === 'x' ? -Math.sin(giro) : Math.cos(giro);
    const rincon = (k: number): boolean =>
      b.eje === 'x' ? celdasAdentro(c, b.iFijo, k) === 1 : celdasAdentro(c, k, b.iFijo) === 1;
    const enDesde = rincon(b.iDesde);
    const enHasta = rincon(b.iHasta);
    const rincones: [boolean, boolean] = aLoLargo > 0 ? [enDesde, enHasta] : [enHasta, enDesde];
    return b.eje === 'x'
      ? { x: b.fijo, z: medio, largo, giro, rincones }
      : { x: medio, z: b.fijo, largo, giro, rincones };
  });
}

/**
 * Esquinas de afuera de la planta: en cada rincón, el cuadrado de `grosor` × `grosor` que las
 * dos paredes no tapan (por fuera, no se ve, pero así la pared es continua). Devuelve el centro.
 */
export function esquinasDeAfuera(
  rects: readonly Rectangulo[],
  grosor: number,
): { x: number; z: number }[] {
  const c = cuadricula(rects);
  const esquinas: { x: number; z: number }[] = [];
  for (let i = 0; i < c.xs.length; i++) {
    for (let j = 0; j < c.zs.length; j++) {
      if (celdasAdentro(c, i, j) !== 1) continue;
      // La celda de adentro está en una de las cuatro diagonales; el cuadrado va en la opuesta.
      const sx = c.adentro(i - 1, j - 1) || c.adentro(i - 1, j) ? 1 : -1;
      const sz = c.adentro(i - 1, j - 1) || c.adentro(i, j - 1) ? 1 : -1;
      esquinas.push({
        x: (c.xs[i] as number) + (sx * grosor) / 2,
        z: (c.zs[j] as number) + (sz * grosor) / 2,
      });
    }
  }
  return esquinas;
}
