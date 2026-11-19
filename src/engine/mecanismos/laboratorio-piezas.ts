/**
 * Sala 2 · El laboratorio, pulido por código (pulir salas, sesión A).
 *
 * Lo que anima la máquina de los tanques se rehace con más detalle sin cambiar su malla, su id,
 * su pivote ni su caja de choque: las perillas (con su dial y, la morada, su candado), la
 * palanca (rótula, varilla y mango) y la campana (cúpula de latón y botón). Los tanques, su
 * líquido y la bandeja de la incubadora los arma `tanques.ts`.
 *
 * Lo fijo nuevo va unido a la malla fija de la sala (sin draw calls nuevas): las bases y tapas
 * de los tanques con su regla y sus varillas, las tuberías con bridas, codos, manómetro y la
 * válvula que une los tanques, la caja de la palanca, los pilotos del tablero, la base de la
 * campana con su temporizador, el microscopio, el computador, la gradilla con sus tubos y el extintor.
 *
 * La taza y la hoja de ayer se tocan: se visten igual que las piezas de la máquina.
 */
import type { Object3D } from 'three';
import { extintor, PALETA } from './piezas-comunes';
import { Piezas, sumarAFija, vestirMalla } from './piezas-por-codigo';

/** Centro de los tanques en el piso (x) y su fila (z), como en `salas.json`. */
export const TANQUES_X = [-2, -0.6] as const;
const TANQUES_Z = -1.8;
/** Radio y alto del vidrio de un tanque (el cilindro de `salas.json`). */
const RADIO_TANQUE = 0.35;
const ALTO_TANQUE = 1.6;
/** Altura del cielo raso y la pared norte, para las tuberías. */
const Y_TUBO = 2.66;
const Z_PARED_NORTE = -3;
/** Cubierta del tablero, donde van las perillas y la palanca. */
const Y_TABLERO = 0.9;
const CAMPANA = { x: 3.7, y: 1.2, z: -2.4 } as const;

const C = PALETA;

/** Base, tapa, varillas y regla de un tanque, alrededor de su vidrio. */
function tanque(p: Piezas, x: number): void {
  p.en({ pos: [x, 0, TANQUES_Z] }, () => {
    const r = RADIO_TANQUE + 0.002;
    p.caja([0.94, 0.05, 0.94], C.metalOscuro, { pos: [0, 0.025, 0], bisel: 0.018 });
    // Collar de abajo y tapa con su domo.
    p.torno(
      [
        [r, 0.05],
        [0.41, 0.05],
        [0.425, 0.065],
        [0.425, 0.15],
        [0.41, 0.165],
        [r, 0.165],
      ],
      C.metal,
      { lados: 24 },
    );
    p.torno(
      [
        [r, 1.47],
        [0.41, 1.47],
        [0.425, 1.485],
        [0.425, 1.6],
        [0.39, 1.635],
        [0.25, 1.685],
        [0.07, 1.705],
        [0, 1.705],
      ],
      C.metal,
      { lados: 24 },
    );
    // Tornillos del collar de arriba.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      p.esfera(0.013, C.cromo, {
        pos: [0.428 * Math.sin(a), 1.54, 0.428 * Math.cos(a)],
        lados: 6,
        anillos: 3,
      });
    }
    // Varillas de la jaula, a los lados y atrás: de frente no tapan el vidrio.
    for (const grados of [90, 150, 210, 270]) {
      const a = (grados * Math.PI) / 180;
      const px = 0.4 * Math.sin(a);
      const pz = 0.4 * Math.cos(a);
      p.barra([px, 0.165, pz], [px, 1.47, pz], 0.014, C.cromo, 6);
    }
    // Regla pintada por dentro, atrás: se lee a través del vidrio y del líquido.
    p.caja([0.06, 1.32, 0.004], C.blanco, { pos: [0, 0.83, -0.325] });
    for (let i = 0; i <= 13; i++) {
      const largo = i % 5 === 0 ? 0.05 : 0.026;
      p.caja([largo, 0.006, 0.003], C.negro, {
        pos: [-0.03 + largo / 2, 0.2 + i * 0.1, -0.3215],
      });
    }
    // Boca de la tubería sobre la tapa.
    p.cilindro(0.055, 0.06, C.metalOscuro, { pos: [0, 1.7, 0], bisel: 0.01 });
  });
}

/** Tuberías de los tanques al techo y a la pared norte, y la válvula que los une abajo. */
function tuberias(p: Piezas): void {
  for (const [i, x] of TANQUES_X.entries()) {
    const z = TANQUES_Z;
    p.barra([x, 1.76, z], [x, Y_TUBO, z], 0.045, C.metal, 10);
    p.cilindro(0.066, 0.03, C.metalOscuro, { pos: [x, 1.76, z], bisel: 0.008 });
    p.cilindro(0.066, 0.03, C.metalOscuro, { pos: [x, 2.45, z], bisel: 0.008 });
    p.esfera(0.06, C.metal, { pos: [x, Y_TUBO, z], lados: 10, anillos: 5 });
    p.barra([x, Y_TUBO, z], [x, Y_TUBO, Z_PARED_NORTE], 0.045, C.metal, 10);
    p.cilindro(0.08, 0.03, C.metalOscuro, {
      pos: [x, Y_TUBO, Z_PARED_NORTE + 0.005],
      giro: [90, 0, 0],
      bisel: 0.008,
    });
    // Abrazadera en la mitad del tramo horizontal.
    p.caja([0.13, 0.03, 0.05], C.metalOscuro, {
      pos: [x, Y_TUBO + 0.05, (z + Z_PARED_NORTE) / 2],
      bisel: 0.008,
    });
    // Manómetro en la tubería del tanque A.
    if (i === 0) {
      p.barra([x, 2.1, z], [x, 2.1, z + 0.08], 0.014, C.cromo, 6);
      p.cilindro(0.068, 0.03, C.negro, { pos: [x, 2.1, z + 0.07], giro: [90, 0, 0], bisel: 0.008 });
      p.cilindro(0.057, 0.004, C.blanco, { pos: [x, 2.1, z + 0.1], giro: [90, 0, 0] });
      p.caja([0.006, 0.045, 0.003], C.rojo, {
        pos: [x + 0.011, 2.116, z + 0.105],
        giro: [0, 0, -30],
      });
    }
    // Salida de abajo, hacia la válvula de atrás.
    p.barra([x, 0.11, z - 0.42], [x, 0.11, z - 0.5], 0.032, C.metal, 8);
    p.esfera(0.04, C.metal, { pos: [x, 0.11, z - 0.5], lados: 8, anillos: 4 });
  }
  const [xa, xb] = TANQUES_X;
  const zv = TANQUES_Z - 0.5;
  p.barra([xa, 0.11, zv], [xb, 0.11, zv], 0.032, C.metal, 8);
  const xv = (xa + xb) / 2;
  p.caja([0.11, 0.1, 0.1], C.metalOscuro, { pos: [xv, 0.11, zv], bisel: 0.015 });
  p.barra([xv, 0.16, zv], [xv, 0.27, zv], 0.012, C.cromo, 6);
  p.toro(0.065, 0.011, C.rojo, { pos: [xv, 0.27, zv], lados: 14, tubo: 5 });
  p.barra([xv - 0.065, 0.27, zv], [xv + 0.065, 0.27, zv], 0.007, C.rojo, 5);
  p.barra([xv, 0.27, zv - 0.065], [xv, 0.27, zv + 0.065], 0.007, C.rojo, 5);
}

/** La caja de la palanca y los pilotos de los tanques sobre el tablero. */
function tablero(p: Piezas): void {
  p.caja([0.13, 0.045, 0.22], C.negro, { pos: [-1.3, Y_TABLERO + 0.0225, -1], bisel: 0.01 });
  p.caja([0.026, 0.004, 0.17], C.ranura, { pos: [-1.3, Y_TABLERO + 0.046, -1] });
  for (const [x, color] of [
    [TANQUES_X[0], C.verde],
    [TANQUES_X[1], C.morado],
  ] as const) {
    p.cilindro(0.024, 0.012, C.metalOscuro, { pos: [x + 0.13, Y_TABLERO, -0.93], bisel: 0.004 });
    p.esfera(0.016, color, { pos: [x + 0.13, Y_TABLERO + 0.014, -0.93], lados: 8, anillos: 4 });
  }
}

/** Base de madera de la campana, con el temporizador de cocina a un lado. */
function baseCampana(p: Piezas): void {
  const { x, y, z } = CAMPANA;
  p.caja([0.36, 0.025, 0.23], C.madera, { pos: [x + 0.05, y + 0.0125, z], bisel: 0.007 });
  p.cilindro(0.04, 0.04, C.blanco, { pos: [x + 0.175, y + 0.025, z + 0.03], bisel: 0.01 });
  p.cilindro(0.032, 0.012, C.rojo, { pos: [x + 0.175, y + 0.065, z + 0.03], bisel: 0.004 });
  p.caja([0.006, 0.004, 0.026], C.negro, { pos: [x + 0.175, y + 0.079, z + 0.04] });
}

/** Microscopio sobre el mesón 2, mirando hacia +Z antes de girarlo. */
function microscopio(p: Piezas): void {
  p.en({ pos: [-3.45, Y_TABLERO, 0.95], giro: [0, 25, 0] }, () => {
    p.caja([0.15, 0.025, 0.19], C.negro, { pos: [0, 0.0125, 0], bisel: 0.008 });
    p.cilindro(0.02, 0.012, C.luz, { pos: [0, 0.025, 0.015] });
    p.caja([0.042, 0.2, 0.046], C.crema, { pos: [0, 0.125, -0.065], bisel: 0.01 });
    p.barra([0, 0.215, -0.065], [0, 0.265, -0.02], 0.022, C.crema, 8);
    p.caja([0.05, 0.04, 0.06], C.crema, { pos: [0, 0.27, -0.005], giro: [-20, 0, 0], bisel: 0.01 });
    p.barra([0, 0.28, 0.005], [0, 0.34, 0.035], 0.016, C.crema, 10);
    p.barra([0, 0.34, 0.035], [0, 0.372, 0.051], 0.012, C.negro, 10);
    p.cilindro(0.027, 0.014, C.negro, { pos: [0, 0.226, 0.005], rArriba: 0.02, bisel: 0.004 });
    p.barra([0, 0.226, 0.012], [0, 0.185, 0.02], 0.007, C.cromo, 6);
    p.barra([0.012, 0.226, 0.0], [0.02, 0.192, -0.002], 0.006, C.cromo, 6);
    p.caja([0.12, 0.012, 0.11], C.negro, { pos: [0, 0.15, 0.015], bisel: 0.003 });
    p.caja([0.075, 0.003, 0.026], C.vidrio, { pos: [0, 0.1575, 0.02] });
    for (const s of [1, -1]) {
      p.caja([0.01, 0.004, 0.04], C.cromo, { pos: [s * 0.03, 0.1585, 0.005] });
      p.cilindro(0.022, 0.016, C.negro, {
        pos: [s * 0.021, 0.11, -0.065],
        giro: [0, 0, -90 * s],
        bisel: 0.004,
      });
    }
  });
}

/** Computador sobre el mesón 1: pantalla con una gráfica, base, teclado y ratón. */
function computador(p: Piezas): void {
  p.en({ pos: [2.15, Y_TABLERO, 0.55] }, () => {
    p.caja([0.2, 0.014, 0.14], C.negro, { pos: [0, 0.007, -0.08], bisel: 0.005 });
    p.caja([0.05, 0.11, 0.03], C.negro, { pos: [0, 0.06, -0.1], bisel: 0.008 });
    p.caja([0.48, 0.3, 0.035], C.negro, { pos: [0, 0.25, -0.09], bisel: 0.012 });
    p.caja([0.44, 0.26, 0.004], C.pantalla, { pos: [0, 0.25, -0.0705] });
    // La gráfica de la pantalla: ejes y una recta que sube, como en el graficador.
    p.caja([0.36, 0.003, 0.002], C.blanco, { pos: [0, 0.15, -0.068] });
    p.caja([0.003, 0.2, 0.002], C.blanco, { pos: [-0.18, 0.245, -0.068] });
    p.barra([-0.17, 0.16, -0.067], [0.16, 0.33, -0.067], 0.003, C.verde, 4);
    p.caja([0.4, 0.016, 0.13], C.metalOscuro, { pos: [0, 0.008, 0.09], bisel: 0.005 });
    for (let fila = 0; fila < 4; fila++) {
      p.caja([0.37, 0.006, 0.022], C.negro, {
        pos: [0, 0.018, 0.045 + fila * 0.028],
        bisel: 0.002,
      });
    }
    p.caja([0.05, 0.02, 0.08], C.negro, { pos: [0.27, 0.01, 0.1], bisel: 0.009 });
  });
}

/** Gradilla de madera con cinco tubos de ensayo (líquido de color, vidrio y tapón). */
function gradilla(p: Piezas): void {
  const colores = [C.verde, C.morado, C.azul, C.amarillo, C.rojoClaro];
  p.en({ pos: [-2.45, Y_TABLERO, 0.85] }, () => {
    p.caja([0.3, 0.02, 0.09], C.madera, { pos: [0, 0.01, 0], bisel: 0.005 });
    p.caja([0.3, 0.015, 0.09], C.madera, { pos: [0, 0.0825, 0], bisel: 0.004 });
    for (const s of [1, -1]) {
      p.caja([0.02, 0.075, 0.09], C.madera, { pos: [s * 0.14, 0.0475, 0], bisel: 0.004 });
    }
    colores.forEach((color, i) => {
      const x = -0.1 + i * 0.05;
      p.en({ pos: [x, 0.02, 0] }, () => {
        p.torno(
          [
            [0, 0],
            [0.008, 0.002],
            [0.011, 0.01],
            [0.011, 0.075],
            [0, 0.075],
          ],
          color,
          { lados: 8 },
        );
        p.torno(
          [
            [0.0112, 0.075],
            [0.0112, 0.14],
          ],
          C.vidrio,
          { lados: 8 },
        );
        p.cilindro(0.0125, 0.02, C.corcho, { pos: [0, 0.135, 0], lados: 8 });
      });
    });
  });
}

/** Viste la taza «T. R.»: taza blanca con café y oreja. */
function taza(): Piezas {
  return new Piezas()
    .torno(
      [
        [0, 0],
        [0.04, 0],
        [0.044, 0.004],
        [0.045, 0.1],
        [0.04, 0.1],
        [0.04, 0.075],
      ],
      C.blanco,
      { lados: 14 },
    )
    .torno(
      [
        [0.04, 0.075],
        [0, 0.075],
      ],
      C.cafe,
      { lados: 14 },
    )
    .toro(0.026, 0.0075, C.blanco, {
      pos: [0.045, 0.05, 0],
      giro: [90, 0, 0],
      arco: 180,
      lados: 8,
      tubo: 5,
    })
    .caja([0.012, 0.016, 0.002], C.azul, { pos: [-0.007, 0.06, 0.045] })
    .caja([0.012, 0.016, 0.002], C.azul, { pos: [0.009, 0.06, 0.045] });
}

/** La hoja del graficador de ayer: papel milimetrado con la curva en rojo. */
function hoja(): Piezas {
  const p = new Piezas().caja([0.3, 0.004, 0.22], C.papel, { pos: [0, 0.002, 0] });
  for (let i = -3; i <= 3; i++) {
    p.caja([0.28, 0.0008, 0.0015], C.cuadricula, { pos: [0, 0.0044, i * 0.03] });
  }
  for (let i = -4; i <= 4; i++) {
    p.caja([0.0015, 0.0008, 0.2], C.cuadricula, { pos: [i * 0.033, 0.0044, 0] });
  }
  p.caja([0.27, 0.001, 0.003], C.negro, { pos: [0, 0.0046, 0.09] });
  p.caja([0.003, 0.001, 0.19], C.negro, { pos: [-0.13, 0.0046, 0] });
  const curva: [number, number][] = [
    [-0.13, 0.09],
    [-0.07, 0.06],
    [-0.01, 0.02],
    [0.05, -0.02],
    [0.12, -0.08],
  ];
  for (let i = 0; i + 1 < curva.length; i++) {
    const [x0, z0] = curva[i] ?? [0, 0];
    const [x1, z1] = curva[i + 1] ?? [0, 0];
    p.barra([x0, 0.005, z0], [x1, 0.005, z1], 0.0018, C.rojo, 4);
  }
  return p;
}

/** Una perilla: base negra con su dial, perilla de color con raya blanca. */
function perilla(color: string, bloqueada: boolean): Piezas {
  const p = new Piezas().cilindro(0.07, 0.012, C.negro, { bisel: 0.004, lados: 16 });
  for (let i = 0; i < 7; i++) {
    const grados = -135 + i * 45;
    const a = (grados * Math.PI) / 180;
    p.caja([0.006, 0.003, 0.014], C.blanco, {
      pos: [0.06 * Math.sin(a), 0.0135, 0.06 * Math.cos(a)],
      giro: [0, grados, 0],
    });
  }
  p.torno(
    [
      [0, 0.012],
      [0.05, 0.012],
      [0.052, 0.016],
      [0.052, 0.026],
      [0.044, 0.032],
      [0.038, 0.06],
      [0.032, 0.068],
      [0, 0.07],
    ],
    color,
    { lados: 14 },
  );
  p.caja([0.008, 0.004, 0.03], C.blanco, { pos: [0, 0.0705, 0.016] });
  if (bloqueada) {
    // Candado de latón al frente: la perilla morada no gira.
    p.caja([0.034, 0.028, 0.014], C.laton, { pos: [0.06, 0.03, 0.055], bisel: 0.004 });
    p.toro(0.011, 0.0035, C.cromo, {
      pos: [0.06, 0.044, 0.055],
      giro: [90, 0, 0],
      desde: 90,
      arco: 180,
      lados: 8,
      tubo: 4,
    });
    p.cilindro(0.004, 0.002, C.negro, { pos: [0.06, 0.026, 0.062], giro: [90, 0, 0], lados: 6 });
  }
  return p;
}

/** La palanca, con el pivote en su base: rótula, varilla cromada y mango rojo. */
function palanca(): Piezas {
  return new Piezas()
    .barra([-0.035, 0.012, 0], [0.035, 0.012, 0], 0.016, C.metalOscuro, 10)
    .barra([0, 0.012, 0], [0, 0.32, 0], 0.011, C.cromo, 8)
    .torno(
      [
        [0, 0.3],
        [0.02, 0.302],
        [0.029, 0.322],
        [0.032, 0.36],
        [0.027, 0.39],
        [0.012, 0.4],
        [0, 0.4],
      ],
      C.rojo,
      { lados: 12, suave: true },
    );
}

/** La campana de mesa: cúpula de latón y botón cromado. Se sacude alrededor de su base. */
function campana(): Piezas {
  return new Piezas()
    .cilindro(0.014, 0.03, C.cromo, { pos: [0, 0.02, 0], lados: 8 })
    .torno(
      [
        [0, 0.045],
        [0.1, 0.045],
      ],
      C.latonOscuro,
      { lados: 20 },
    )
    .torno(
      [
        [0.1, 0.045],
        [0.1, 0.055],
        [0.094, 0.075],
        [0.078, 0.112],
        [0.052, 0.135],
        [0.024, 0.147],
        [0, 0.15],
      ],
      C.laton,
      { lados: 20, suave: true },
    )
    .cilindro(0.009, 0.022, C.cromo, { pos: [0, 0.148, 0], lados: 8 })
    .esfera(0.017, C.cromo, { pos: [0, 0.18, 0], lados: 10, anillos: 5 });
}

/**
 * Pule el laboratorio ya armado. Se puede llamar otra vez con la misma sala (vuelve de la
 * caché): lo hecho no se repite.
 */
export function pulirLaboratorio(raiz: Object3D): void {
  vestirMalla(raiz.getObjectByName('s2-perilla-verde'), perilla(C.verde, false));
  vestirMalla(raiz.getObjectByName('s2-perilla-morada'), perilla(C.morado, true));
  vestirMalla(raiz.getObjectByName('s2-palanca'), palanca());
  vestirMalla(raiz.getObjectByName('s2-campana'), campana());
  vestirMalla(raiz.getObjectByName('s2-taza'), taza());
  vestirMalla(raiz.getObjectByName('s2-hoja-ayer'), hoja());

  const fijas = new Piezas();
  for (const x of TANQUES_X) tanque(fijas, x);
  tuberias(fijas);
  tablero(fijas);
  baseCampana(fijas);
  microscopio(fijas);
  gradilla(fijas);
  computador(fijas);
  // El extintor cuelga de la pared sur, junto a la puerta, mirando hacia la sala.
  fijas.en({ pos: [1.1, 0.75, 2.89], giro: [0, 180, 0] }, () => extintor(fijas));
  sumarAFija(raiz, 's2-laboratorio', fijas);
}

/** Lo que mide el tanque, para `tanques.ts`. */
export const VIDRIO = { radio: RADIO_TANQUE, alto: ALTO_TANQUE } as const;
