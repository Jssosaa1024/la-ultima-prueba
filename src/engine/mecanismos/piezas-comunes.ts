/**
 * Lo que comparten el laboratorio y el gimnasio pulidos (pulir salas, sesión A): la paleta de
 * colores planos, cercana a la de KayKit y Kenney, y el extintor de pared.
 */
import type { Piezas } from './piezas-por-codigo';

export const PALETA = {
  negro: '#272c30',
  ranura: '#121517',
  metalOscuro: '#3e4a50',
  metal: '#76858c',
  cromo: '#c5ced3',
  blanco: '#eef1ee',
  crema: '#e8e2d0',
  papel: '#fbfaf3',
  cuadricula: '#bcd5e6',
  rojo: '#c4392d',
  rojoClaro: '#ec7063',
  naranja: '#e67e22',
  amarillo: '#f4d03f',
  verde: '#58d68d',
  morado: '#a569bd',
  azul: '#5dade2',
  laton: '#d9b23c',
  latonOscuro: '#a9852a',
  madera: '#b9834f',
  corcho: '#9b6b43',
  vidrio: '#d6e8ee',
  pantalla: '#2f6f8f',
  luz: '#fff1b8',
  cafe: '#4a2c1d',
} as const;

const C = PALETA;

/**
 * Extintor de pared, con la base en y = 0 y el frente hacia +Z: cilindro rojo con hombros,
 * etiqueta, válvula, palancas, pasador, manguera y la abrazadera que lo cuelga.
 */
export function extintor(p: Piezas): void {
  p.torno(
    [
      [0, 0],
      [0.074, 0],
      [0.08, 0.012],
      [0.08, 0.37],
      [0.07, 0.415],
      [0.045, 0.44],
      [0, 0.45],
    ],
    C.rojo,
    { lados: 16 },
  );
  // Etiqueta curva al frente y abrazadera alrededor.
  p.torno(
    [
      [0.0806, 0.16],
      [0.0806, 0.28],
    ],
    C.blanco,
    { desde: -45, arco: 90, lados: 6 },
  );
  p.torno(
    [
      [0.0812, 0.32],
      [0.0812, 0.34],
    ],
    C.metalOscuro,
    { lados: 16 },
  );
  p.caja([0.06, 0.14, 0.02], C.metalOscuro, { pos: [0, 0.3, -0.09], bisel: 0.004 });
  p.cilindro(0.022, 0.04, C.negro, { pos: [0, 0.445, 0], lados: 10 });
  p.caja([0.05, 0.035, 0.04], C.metalOscuro, { pos: [0, 0.5, 0], bisel: 0.006 });
  p.caja([0.13, 0.012, 0.03], C.negro, { pos: [0.03, 0.53, 0], giro: [0, 0, 8], bisel: 0.004 });
  p.caja([0.11, 0.012, 0.028], C.negro, { pos: [0.025, 0.506, 0], bisel: 0.004 });
  p.toro(0.012, 0.003, C.amarillo, {
    pos: [-0.03, 0.505, 0.02],
    giro: [90, 0, 0],
    lados: 8,
    tubo: 4,
  });
  const manguera: [number, number, number][] = [
    [0.02, 0.5, 0.02],
    [0.06, 0.46, 0.05],
    [0.09, 0.3, 0.06],
    [0.095, 0.15, 0.05],
  ];
  for (let i = 0; i + 1 < manguera.length; i++) {
    const a = manguera[i];
    const b = manguera[i + 1];
    if (a && b) p.barra(a, b, 0.009, C.negro, 6);
  }
  p.barra([0.095, 0.15, 0.05], [0.095, 0.09, 0.05], 0.014, C.negro, 8);
}
