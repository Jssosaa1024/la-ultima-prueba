/**
 * Sala 3 · El gimnasio, pulido por código (pulir salas, sesión A).
 *
 * Lo que anima o se toca se rehace con más detalle sin cambiar su malla, su id, su pivote ni
 * su caja de choque: el reflector (cuerpo con aletas, aro y lente; gira en su bisagra), el riel
 * y los tres postes (base con peso, franjas cada medio metro y tapa), la franja de sensores,
 * la cinta métrica (marcas cada 10 cm y su carrete), la polea del marcador (malacate con
 * manivela), la planilla (tabla con pinza) y los cuatro balones, con sus costuras.
 *
 * Lo fijo nuevo va unido a la malla fija de la sala (sin draw calls nuevas): tablas, narices de
 * aluminio, franja, costados y barandas de las gradas; la base del reflector con su cuadrante de
 * muescas y su cable; el tablero y el aro con su red; las guías de la cuerda; las cerchas del techo; las colchonetas y el
 * extintor.
 * El gancho y los discos de los sensores los arma `reflector.ts`.
 */
import type { Object3D } from 'three';
import { BALONES } from '../../content/grabaciones';
import { extintor, PALETA } from './piezas-comunes';
import { Piezas, sumarAFija, vestirMalla } from './piezas-por-codigo';

const C = {
  ...PALETA,
  costado: '#2c4a63',
  baranda: '#e3b341',
  carcasa: '#e0aa2e',
  aro: '#f08a4b',
  colchoneta: '#4a7cc4',
  colchonetaClara: '#5a8bd0',
  cuerda: '#d8c9a3',
  cercha: '#4d5966',
  costura: '#4a4a4a',
} as const;

/** Las gradas (`salas.json`): de x −8 a 0, contra la pared norte (z = −6). */
const GRADAS = { x0: -8, x1: 0, fondo: -6, escalones: 3, alto: 0.5, huella: 0.5 } as const;
/** Donde está el reflector, sobre el escalón de arriba. */
const REFLECTOR = { x: -4, y: 1.5, z: -5.75 } as const;
/** Las alturas de los postes, en el orden de `salas.json` (como `ALTURAS_POSTES`). */
const ALTURAS = [1, 2, 3] as const;
const ALTO_RIEL = 0.04;
/** Altura del aro de baloncesto (su centro). */
const Y_ARO = 3.075;

/** Tablas, narices, franja, costados y barandas de las gradas. */
function gradas(p: Piezas): void {
  const { x0, x1, fondo, escalones, alto, huella } = GRADAS;
  const centro = (x0 + x1) / 2;
  const ancho = x1 - x0;
  for (let k = 0; k < escalones; k++) {
    const arriba = alto * (k + 1);
    const frente = fondo + 1.4 - huella * k;
    const ultimo = k === escalones - 1;
    if (ultimo) {
      // El escalón de arriba deja libre el sitio del reflector.
      const hueco = 0.35;
      const largo = REFLECTOR.x - hueco - (x0 + 0.07);
      for (const xc of [x0 + 0.07 + largo / 2, REFLECTOR.x + hueco + largo / 2]) {
        p.caja([largo, 0.05, 0.3], C.madera, {
          pos: [xc, arriba + 0.025, frente - 0.17],
          bisel: 0.012,
        });
      }
    } else {
      p.caja([ancho - 0.14, 0.05, 0.34], C.madera, {
        pos: [centro, arriba + 0.025, frente - 0.19],
        bisel: 0.012,
      });
    }
    p.caja([ancho, 0.03, 0.035], C.cromo, { pos: [centro, arriba - 0.015, frente - 0.015] });
    p.caja([ancho, 0.06, 0.006], C.crema, { pos: [centro, arriba - 0.25, frente + 0.003] });
    // Costados de cada escalón, a los dos lados.
    for (const x of [x0 - 0.03, x1 + 0.03]) {
      const fondoEscalon = frente - fondo;
      p.caja([0.06, arriba, fondoEscalon], C.costado, {
        pos: [x, arriba / 2, (frente + fondo) / 2],
        bisel: 0.012,
      });
    }
  }
  // Barandas amarillas a los dos lados: un parante por escalón y el pasamanos inclinado.
  for (const x of [x0 + 0.12, x1 - 0.12]) {
    const tope: [number, number, number][] = [];
    for (let k = 0; k < escalones; k++) {
      const arriba = alto * (k + 1);
      const z = fondo + 1.4 - huella * k - 0.1;
      p.barra([x, arriba, z], [x, arriba + 0.85, z], 0.022, C.baranda, 8);
      p.cilindro(0.04, 0.02, C.metalOscuro, { pos: [x, arriba, z], bisel: 0.006, lados: 8 });
      tope.push([x, arriba + 0.85, z]);
    }
    for (let i = 0; i + 1 < tope.length; i++) {
      const a = tope[i];
      const b = tope[i + 1];
      if (a && b) p.barra(a, b, 0.025, C.baranda, 8);
    }
    const ultimo = tope[tope.length - 1];
    if (ultimo) p.esfera(0.03, C.baranda, { pos: ultimo, lados: 8, anillos: 4 });
    const primero = tope[0];
    if (primero) p.esfera(0.03, C.baranda, { pos: primero, lados: 8, anillos: 4 });
  }
}

/** La base del reflector: placa, bisagras, cuadrante con muescas y el cable a la pared. */
function baseReflector(p: Piezas): void {
  p.en({ pos: [REFLECTOR.x, REFLECTOR.y, REFLECTOR.z] }, () => {
    p.caja([0.58, 0.04, 0.42], C.metalOscuro, { pos: [0, 0.02, 0], bisel: 0.012 });
    for (const s of [1, -1]) {
      p.caja([0.05, 0.09, 0.1], C.metalOscuro, { pos: [s * 0.16, 0.045, 0], bisel: 0.012 });
    }
    // Cuadrante a un lado: una placa de un cuarto de círculo (de vertical a horizontal, hacia
    // la cancha) con una muesca amarilla cada 10°, de 10° a 80°.
    const radio = 0.3;
    const grueso = 0.006;
    p.torno(
      [
        [0, -grueso],
        [radio, -grueso],
        [radio, grueso],
        [0, grueso],
      ],
      C.metalOscuro,
      { pos: [0.26, 0, 0], giro: [0, 0, 90], desde: 0, arco: 90, lados: 9 },
    );
    p.caja([2 * grueso, radio, 0.03], C.metalOscuro, { pos: [0.26, radio / 2, 0.015] });
    for (let grados = 10; grados <= 80; grados += 10) {
      const a = (grados * Math.PI) / 180;
      p.caja([0.02, 0.03, 0.014], C.amarillo, {
        pos: [0.26, (radio + 0.01) * Math.cos(a), (radio + 0.01) * Math.sin(a)],
        giro: [grados, 0, 0],
      });
    }
    p.barra([-0.22, 0.03, -0.1], [-0.22, 0.03, -0.23], 0.012, C.negro, 6);
  });
  const x = REFLECTOR.x - 0.22;
  p.barra(
    [x, REFLECTOR.y + 0.03, -5.98],
    [x, REFLECTOR.y + 0.03, REFLECTOR.z - 0.23],
    0.012,
    C.negro,
    6,
  );
  p.barra([x, 0, -5.98], [x, REFLECTOR.y + 0.03, -5.98], 0.012, C.negro, 6);
}

/** El reflector, con el pivote en su bisagra: la luz sale hacia +Y y se inclina hacia +Z. */
function reflector(): Piezas {
  const p = new Piezas()
    .barra([-0.13, 0, 0], [0.13, 0, 0], 0.04, C.negro, 10)
    .caja([0.1, 0.1, 0.1], C.metalOscuro, { pos: [0, 0.07, 0], bisel: 0.015 })
    .cilindro(0.17, 0.06, C.carcasa, { pos: [0, 0.11, 0], rArriba: 0.2, bisel: 0.012, lados: 18 })
    .torno(
      [
        [0.2, 0.17],
        [0.2, 0.5],
      ],
      C.carcasa,
      { lados: 18 },
    );
  for (let i = 0; i < 4; i++) {
    const y = 0.19 + i * 0.04;
    p.torno(
      [
        [0.2, y],
        [0.218, y + 0.008],
        [0.218, y + 0.018],
        [0.2, y + 0.026],
      ],
      C.metalOscuro,
      { lados: 18 },
    );
  }
  p.torno(
    [
      [0.2, 0.5],
      [0.226, 0.51],
      [0.226, 0.56],
      [0.205, 0.566],
    ],
    C.negro,
    { lados: 18 },
  );
  p.torno(
    [
      [0.205, 0.566],
      [0.15, 0.571],
      [0, 0.576],
    ],
    C.luz,
    { lados: 18, suave: true },
  );
  // Asa atrás (del lado −Z, que queda arriba al inclinarlo).
  p.barra([0, 0.24, -0.2], [0, 0.24, -0.27], 0.012, C.negro, 6)
    .barra([0, 0.44, -0.2], [0, 0.44, -0.27], 0.012, C.negro, 6)
    .barra([0, 0.24, -0.27], [0, 0.44, -0.27], 0.014, C.negro, 6);
  return p;
}

/** El riel de los postes: placa, dos rieles, topes amarillos y la marca de cada poste. */
function riel(): Piezas {
  const p = new Piezas()
    .caja([5, 0.02, 0.22], C.metalOscuro, { pos: [0, 0.01, 0], bisel: 0.006 })
    .caja([5, 0.02, 0.03], C.cromo, { pos: [0, 0.03, 0.06], bisel: 0.005 })
    .caja([5, 0.02, 0.03], C.cromo, { pos: [0, 0.03, -0.06], bisel: 0.005 });
  for (const s of [1, -1]) {
    p.caja([0.07, 0.06, 0.24], C.amarillo, { pos: [s * 2.47, 0.03, 0], bisel: 0.01 });
  }
  for (const x of [-1.5, 0, 1.5]) p.caja([0.02, 0.002, 0.2], C.blanco, { pos: [x, 0.021, 0] });
  return p;
}

/**
 * Un poste de `alto` metros (con la base en la cara del riel): base con peso, franjas blancas y
 * rojas de medio metro (contadas desde el piso, para leer la altura) y tapa amarilla.
 */
function poste(alto: number): Piezas {
  const p = new Piezas()
    .cilindro(0.13, 0.05, C.metalOscuro, { bisel: 0.015, lados: 16 })
    .cilindro(0.07, 0.04, C.negro, { pos: [0, 0.05, 0], bisel: 0.01, lados: 12 });
  const desde = 0.09;
  const hasta = alto - 0.05;
  let y = desde;
  while (y < hasta - 0.001) {
    // Las franjas cambian en cada medio metro del piso (el riel sube la base 4 cm).
    const medio = Math.floor((y + ALTO_RIEL) / 0.5 + 1e-6);
    const fin = Math.min(hasta, (medio + 1) * 0.5 - ALTO_RIEL);
    p.cilindro(0.045, fin - y, medio % 2 === 0 ? C.blanco : C.rojo, { pos: [0, y, 0], lados: 12 });
    y = fin;
  }
  return p.cilindro(0.06, 0.05, C.amarillo, { pos: [0, hasta, 0], bisel: 0.015, lados: 12 });
}

/** La franja de sensores: tapete negro con bordes verdes, tres bases y la caja de conexión. */
function sensores(): Piezas {
  const p = new Piezas().caja([4, 0.016, 0.3], C.negro, { pos: [0, 0.008, 0], bisel: 0.006 });
  for (const s of [1, -1]) p.caja([3.96, 0.004, 0.02], C.verde, { pos: [0, 0.017, s * 0.12] });
  for (const x of [-1.5, 0, 1.5]) {
    p.cilindro(0.215, 0.012, C.metalOscuro, { pos: [x, 0.006, 0], bisel: 0.004, lados: 16 });
  }
  return p
    .caja([0.18, 0.07, 0.18], C.metalOscuro, { pos: [2.12, 0.035, 0], bisel: 0.012 })
    .esfera(0.012, C.verde, { pos: [2.12, 0.072, 0.04], lados: 6, anillos: 3 })
    .barra([2.21, 0.02, 0], [2.7, 0.02, 0], 0.01, C.negro, 5);
}

/** La cinta métrica pegada al piso: 8 m con marcas cada 10 cm y el carrete al sur. */
function cinta(): Piezas {
  const largo = 8;
  const p = new Piezas().caja([0.22, 0.006, largo], C.amarillo, { pos: [0, 0.003, 0] });
  for (let i = 0; i <= largo * 10; i++) {
    const marca = i % 10 === 0 ? 0.14 : i % 5 === 0 ? 0.09 : 0.045;
    const z = -largo / 2 + i * 0.1;
    p.caja([marca, 0.0012, 0.008], C.negro, { pos: [-0.11 + marca / 2, 0.0066, z] });
    if (i % 10 === 0) p.caja([0.02, 0.0012, 0.02], C.rojo, { pos: [0.07, 0.0066, z] });
  }
  return p
    .caja([0.3, 0.12, 0.3], C.negro, { pos: [0, 0.06, largo / 2 + 0.16], bisel: 0.03 })
    .cilindro(0.1, 0.02, C.amarillo, {
      pos: [0.15, 0.06, largo / 2 + 0.16],
      giro: [0, 0, -90],
      bisel: 0.006,
      lados: 14,
    })
    .caja([0.24, 0.03, 0.012], C.cromo, { pos: [0, 0.015, -largo / 2 - 0.006] });
}

/** La polea: malacate en la pared, con su tambor de cuerda y la manivela roja. */
function polea(): Piezas {
  const p = new Piezas().caja([0.04, 0.62, 0.34], C.metalOscuro, {
    pos: [0.15, 0.31, 0],
    bisel: 0.01,
  });
  for (const y of [0.05, 0.57]) {
    for (const z of [0.14, -0.14]) {
      p.esfera(0.015, C.cromo, { pos: [0.128, y, z], lados: 6, anillos: 3 });
    }
  }
  for (const z of [0.1, -0.1]) {
    p.caja([0.24, 0.32, 0.03], C.metal, { pos: [0.02, 0.3, z], bisel: 0.008 });
  }
  return p
    .cilindro(0.07, 0.17, C.cuerda, { pos: [0, 0.3, -0.085], giro: [90, 0, 0], lados: 12 })
    .cilindro(0.09, 0.012, C.metalOscuro, { pos: [0, 0.3, -0.085], giro: [90, 0, 0], lados: 12 })
    .cilindro(0.09, 0.012, C.metalOscuro, { pos: [0, 0.3, 0.073], giro: [90, 0, 0], lados: 12 })
    .barra([0, 0.3, -0.13], [0, 0.3, 0.17], 0.015, C.cromo, 6)
    .barra([0, 0.3, 0.17], [-0.12, 0.2, 0.17], 0.015, C.metalOscuro, 6)
    .cilindro(0.022, 0.08, C.rojo, {
      pos: [-0.12, 0.2, 0.17],
      giro: [90, 0, 0],
      bisel: 0.006,
      lados: 10,
    })
    .caja([0.04, 0.06, 0.02], C.amarillo, {
      pos: [0.06, 0.42, 0.12],
      giro: [0, 0, 25],
      bisel: 0.005,
    });
}

/** Guías de la cuerda en la pared, hasta el marcador. */
function guiasCuerda(p: Piezas): void {
  for (const y of [3, 5, 7]) {
    p.caja([0.05, 0.04, 0.04], C.metalOscuro, { pos: [9.975, y, -1.2], bisel: 0.008 });
    p.toro(0.03, 0.007, C.cromo, { pos: [9.93, y, -1.2], lados: 10, tubo: 4 });
  }
}

/** Tablero de baloncesto en la pared oeste: blanco, con borde y cuadro rojos y un cojín abajo. */
function tablero(p: Piezas): void {
  const x = -9.96;
  const abajo = 2.9;
  const alto = 1.05;
  const ancho = 1.8;
  const cara = x + 0.0215;
  p.caja([0.04, alto, ancho], C.blanco, { pos: [x, abajo + alto / 2, 0], bisel: 0.012 });
  p.caja([0.05, 0.08, ancho], C.colchoneta, { pos: [x + 0.005, abajo + 0.02, 0], bisel: 0.02 });
  const linea = 0.035;
  const marco = (y0: number, y1: number, z0: number, z1: number): void => {
    p.caja([0.004, linea, z1 - z0], C.rojo, { pos: [cara, y0, (z0 + z1) / 2] });
    p.caja([0.004, linea, z1 - z0], C.rojo, { pos: [cara, y1, (z0 + z1) / 2] });
    p.caja([0.004, y1 - y0, linea], C.rojo, { pos: [cara, (y0 + y1) / 2, z0] });
    p.caja([0.004, y1 - y0, linea], C.rojo, { pos: [cara, (y0 + y1) / 2, z1] });
  };
  marco(abajo + 0.1, abajo + alto - 0.05, -ancho / 2 + 0.06, ancho / 2 - 0.06);
  marco(Y_ARO + 0.05, Y_ARO + 0.5, -0.3, 0.3);
}

/** El aro de baloncesto: aro naranja, soporte y red de cuerdas blancas. */
function aro(p: Piezas): void {
  const x = -9.62;
  const y = Y_ARO;
  p.toro(0.23, 0.018, C.aro, { pos: [x, y, 0], lados: 20, tubo: 5 });
  p.caja([0.16, 0.04, 0.12], C.metalOscuro, { pos: [-9.89, y, 0], bisel: 0.01 });
  p.barra([-9.96, y - 0.25, 0], [-9.84, y - 0.02, 0], 0.012, C.metalOscuro, 6);
  const abajo = 0.14;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 12;
    p.barra(
      [x + 0.23 * Math.sin(a), y, 0.23 * Math.cos(a)],
      [x + abajo * Math.sin(b), y - 0.42, abajo * Math.cos(b)],
      0.004,
      C.blanco,
      3,
    );
  }
  p.toro(0.18, 0.005, C.blanco, { pos: [x, y - 0.2, 0], lados: 16, tubo: 3 });
  p.toro(abajo, 0.005, C.blanco, { pos: [x, y - 0.42, 0], lados: 16, tubo: 3 });
}

/** Las cinco cerchas del techo: cordón de arriba y de abajo con diagonales en zigzag. */
function cerchas(p: Piezas): void {
  const arriba = 8.95;
  const abajo = 8.6;
  const fondo = 6;
  for (const x of [-6.67, -3.33, 0, 3.33, 6.67]) {
    p.caja([0.14, 0.08, 2 * fondo], C.cercha, { pos: [x, arriba, 0], bisel: 0.015 });
    p.caja([0.12, 0.06, 2 * fondo - 0.4], C.cercha, { pos: [x, abajo, 0], bisel: 0.012 });
    for (let i = 0; i < 12; i++) {
      const z0 = -fondo + 0.2 + i * ((2 * fondo - 0.4) / 12);
      const z1 = z0 + (2 * fondo - 0.4) / 12;
      const [ya, yb] = i % 2 === 0 ? [abajo, arriba] : [arriba, abajo];
      p.barra([x, ya, z0], [x, yb, z1], 0.025, C.cercha, 6);
    }
  }
}

/** Tres colchonetas azules apiladas, con los bordes redondeados y asas negras. */
function colchonetas(p: Piezas): void {
  const capas: [number, number, number, number, string][] = [
    [-8.3, 0.075, 4.95, 2, C.colchoneta],
    [-8.25, 0.225, 4.93, 1.94, C.colchonetaClara],
    [-8.33, 0.375, 4.98, 2, C.colchoneta],
  ];
  for (const [x, y, z, ancho, color] of capas) {
    p.caja([ancho, 0.15, ancho === 2 ? 1.2 : 1.14], color, { pos: [x, y, z], bisel: 0.03 });
    for (const s of [1, -1]) {
      p.caja([0.012, 0.04, 0.22], C.negro, { pos: [x + s * (ancho / 2 + 0.004), y, z] });
    }
  }
}

/** La planilla del torneo: tabla con pinza y la hoja con sus filas. */
function planilla(): Piezas {
  const p = new Piezas()
    .caja([0.3, 0.008, 0.22], C.madera, { pos: [0, 0.004, 0], bisel: 0.003 })
    .caja([0.25, 0.002, 0.19], C.papel, { pos: [0.015, 0.009, 0] });
  for (let i = 0; i < 7; i++) {
    p.caja([0.23, 0.0008, 0.0015], C.cuadricula, { pos: [0.015, 0.0104, -0.075 + i * 0.025] });
  }
  for (const x of [-0.04, 0.06])
    p.caja([0.0015, 0.0008, 0.17], C.cuadricula, { pos: [x, 0.0104, 0] });
  return p.caja([0.03, 0.014, 0.08], C.cromo, { pos: [-0.125, 0.012, 0], bisel: 0.004 });
}

/**
 * Un balón de 24 cm con la base en y = 0. El cuerpo va en blanco y las costuras en gris: el
 * color del balón lo pone el material (cada balón conserva el suyo).
 */
function balon(id: string): Piezas {
  const r = 0.12;
  const c = 0.0045;
  const p = new Piezas().esfera(r, C.blanco, { pos: [0, r, 0], lados: 14, anillos: 9 });
  const anillo = (
    radio: number,
    donde: { pos: [number, number, number]; giro?: [number, number, number] },
  ) => p.toro(radio, c, C.costura, { ...donde, lados: 20, tubo: 4 });
  switch (id) {
    case 's3-balon-1': {
      // Baloncesto: ecuador, meridiano y las dos curvas de los lados.
      anillo(r, { pos: [0, r, 0] });
      anillo(r, { pos: [0, r, 0], giro: [90, 0, 0] });
      const lado = 0.085;
      const radio = Math.sqrt(r * r - lado * lado);
      for (const s of [1, -1]) anillo(radio, { pos: [s * lado, r, 0], giro: [0, 0, 90] });
      break;
    }
    case 's3-balon-2': {
      // Voleibol de franjas: ecuador y dos paralelos.
      anillo(r, { pos: [0, r, 0] });
      const alto = 0.06;
      const radio = Math.sqrt(r * r - alto * alto);
      for (const s of [1, -1]) anillo(radio, { pos: [0, r + s * alto, 0] });
      break;
    }
    case 's3-balon-3':
      // Gajos: tres meridianos.
      for (const g of [0, 60, 120]) anillo(r, { pos: [0, r, 0], giro: [90, g, 0] });
      break;
    default:
      // Voleibol: tres círculos en planos distintos.
      anillo(r, { pos: [0, r, 0] });
      anillo(r, { pos: [0, r, 0], giro: [90, 0, 0] });
      anillo(r, { pos: [0, r, 0], giro: [0, 0, 90] });
  }
  return p;
}

/**
 * Pule el gimnasio ya armado. Se puede llamar otra vez con la misma sala (vuelve de la caché):
 * lo hecho no se repite.
 */
export function pulirGimnasio(raiz: Object3D): void {
  vestirMalla(raiz.getObjectByName('s3-reflector'), reflector());
  const postes = raiz.getObjectByName('s3-postes');
  if (postes) {
    // Como en `reflector.ts`: la primera pieza es el riel y las tres siguientes, los postes.
    vestirMalla(postes.children[0], riel());
    ALTURAS.forEach((alto, i) => vestirMalla(postes.children[i + 1], poste(alto)));
  }
  vestirMalla(raiz.getObjectByName('s3-sensores'), sensores());
  vestirMalla(raiz.getObjectByName('s3-cinta-metrica'), cinta());
  vestirMalla(raiz.getObjectByName('s3-polea'), polea());
  vestirMalla(raiz.getObjectByName('s3-planilla'), planilla());
  for (const id of BALONES) {
    const malla = raiz.getObjectByName(id);
    // Cada balón conserva su color en el material: las piezas son blancas y grises.
    const color = (malla as { material?: { color?: { getHex(): number } } } | undefined)?.material
      ?.color;
    vestirMalla(malla, balon(id), color?.getHex() ?? 0xffffff);
  }

  const fijas = new Piezas();
  gradas(fijas);
  baseReflector(fijas);
  guiasCuerda(fijas);
  tablero(fijas);
  aro(fijas);
  colchonetas(fijas);
  cerchas(fijas);
  fijas.en({ pos: [1.3, 1.1, 5.9], giro: [0, 180, 0] }, () => extintor(fijas));
  sumarAFija(raiz, 's3-gimnasio', fijas);
}
