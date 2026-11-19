/**
 * Sala 5 · La rectoría, pulida por código (pulir salas, sesión B).
 *
 * Lo que anima la máquina de la urna se rehace con más detalle sin cambiar su id, su caja de
 * choque ni su animación:
 * - **Urna:** vidrio de doble pared, abierto arriba para que entre la mano. Sigue siendo la
 *   malla que se toca; `urna.ts` vuelve translúcido solo el vidrio. La base, el aro de latón,
 *   las varillas, la placa y el soporte de la manija son una malla hija de la urna (`URNA_BASE`):
 *   tocarlos es tocar la urna, y se resaltan con ella.
 * - **Manija:** palanca roja al costado de la urna, también hija de la urna, que se jala cuando
 *   la mano baja.
 * - **Mano mecánica:** brazo telescópico que sale de una carcasa en el techo (unida a lo fijo)
 *   y pinza de dos mandíbulas que sostiene las dos fichas entre ellas.
 * - **Fichas:** azules redondas con el canto biselado y el centro hundido; amarillas cuadradas
 *   con bisel y un cuadro en relieve.
 * - **Caja fuerte:** cuerpo hueco con forro oscuro y una repisa donde espera la llave; puerta
 *   con panel, bisagras, dial con sus marcas, manija de tres rayos y placa de latón.
 *
 * Los dispensadores, el botón «ver parejas» y el parlante son piezas del registro de la sesión C
 * (`src/engine/salas/piezas/rectoria.ts`); la carta es una lámina de papel.
 */
import { Mesh, MeshLambertMaterial } from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { PALETA } from './piezas-comunes';
import { Piezas, sumarAFija, vestirMalla } from './piezas-por-codigo';
import type { PuntoPerfil, V3 } from './piezas-por-codigo';

const C = PALETA;

/** Radio de afuera del vidrio de la urna (la caja de `salas.json` mide 0,35 m de diámetro). */
const RADIO_VIDRIO = 0.165;
const GROSOR_VIDRIO = 0.006;
/** Alto de la urna de `salas.json`. */
const ALTO_URNA = 0.45;
/** Dónde está el fondo de vidrio, sobre la base de la urna: ahí se apoyan las fichas. */
export const FONDO_URNA = 0.036;
/** Altura del cielo raso de la rectoría (`alto` en `salas.json`). */
const TECHO = 3;
/** Donde termina por abajo la carcasa de la mano, en el mundo. */
const BOCA_CARCASA = 2.3;

/** Eje de la manija respecto a la base de la urna (gira alrededor de X, hacia +Z al jalarla). */
export const EJE_MANIJA: V3 = [0.212, 0.05, 0];

/** El vidrio de la urna, con la base en y = 0: pared de afuera, borde y pared de adentro. */
function vidrioUrna(p: Piezas): void {
  const r = RADIO_VIDRIO;
  const ri = r - GROSOR_VIDRIO;
  p.torno(
    [
      [0, FONDO_URNA - GROSOR_VIDRIO],
      [r, FONDO_URNA - GROSOR_VIDRIO],
      [r, ALTO_URNA - 0.01],
      [ri, ALTO_URNA - 0.01],
      [ri, FONDO_URNA],
      [0, FONDO_URNA],
    ],
    '#ffffff',
    { lados: 28 },
  );
}

/** Nombre de la malla con la base, el aro y las varillas de la urna (hija de `s5-urna`). */
export const URNA_BASE = 'urna-base';

/** Lo opaco de la urna, en el espacio de su base: base, aro de latón, varillas y placa. */
function baseUrna(p: Piezas): void {
  const r = RADIO_VIDRIO;
  p.torno(
    [
      [0, 0],
      [0.183, 0],
      [0.19, 0.007],
      [0.19, 0.04],
      [0.182, 0.048],
      [r, 0.048],
    ],
    C.metalOscuro,
    { lados: 28 },
  );
  p.torno(
    [
      [r, ALTO_URNA - 0.03],
      [0.174, ALTO_URNA - 0.03],
      [0.178, ALTO_URNA - 0.022],
      [0.178, ALTO_URNA - 0.006],
      [0.171, ALTO_URNA],
      [r - GROSOR_VIDRIO, ALTO_URNA],
      // Por dentro baja hasta el vidrio: el aro queda cerrado y no se ve a través de él.
      [r - GROSOR_VIDRIO, ALTO_URNA - 0.03],
    ],
    C.laton,
    { lados: 28 },
  );
  for (const grados of [45, 135, 225, 315]) {
    const a = (grados * Math.PI) / 180;
    const px = (r + 0.004) * Math.sin(a);
    const pz = (r + 0.004) * Math.cos(a);
    p.barra([px, 0.048, pz], [px, ALTO_URNA - 0.03, pz], 0.005, C.laton, 6);
  }
  // Placa de latón en el frente de la base.
  p.caja([0.11, 0.024, 0.006], C.laton, { pos: [0, 0.024, 0.19], bisel: 0.003 });
  p.caja([0.08, 0.004, 0.002], C.latonOscuro, { pos: [0, 0.027, 0.1935] });
  // Soporte de la manija al costado.
  p.caja([0.03, 0.06, 0.05], C.metalOscuro, { pos: [0.198, 0.04, 0], bisel: 0.008 });
  p.cilindro(0.016, 0.016, C.cromo, {
    pos: [EJE_MANIJA[0] - 0.003, EJE_MANIJA[1], 0],
    giro: [0, 0, -90],
    lados: 10,
  });
}

/** La carcasa de la mano en el techo, sobre la urna (en el mundo, centrada en x y z). */
function carcasaMano(p: Piezas): void {
  p.cilindro(0.09, 0.02, C.metalOscuro, { pos: [0, TECHO - 0.02, 0], bisel: 0.006, lados: 16 });
  p.caja([0.15, 0.12, 0.15], C.metal, { pos: [0, TECHO - 0.08, 0], bisel: 0.02 });
  p.caja([0.152, 0.02, 0.152], C.amarillo, { pos: [0, TECHO - 0.1, 0], bisel: 0.006 });
  p.cilindro(0.045, TECHO - 0.14 - BOCA_CARCASA - 0.01, C.metalOscuro, {
    pos: [0, BOCA_CARCASA + 0.01, 0],
    lados: 14,
  });
  // El collar baja un poco más que el tubo: sus tapas no quedan en el mismo plano.
  p.cilindro(0.054, 0.03, C.cromo, { pos: [0, BOCA_CARCASA - 0.005, 0], bisel: 0.006, lados: 14 });
}

/** La manija, con su eje en el origen: brazo que sube y pomo rojo. */
export function geometriaManija(): BufferGeometry {
  const p = new Piezas();
  p.cilindro(0.012, 0.024, C.metal, { pos: [0.012, 0, 0], giro: [0, 0, 90], lados: 8 });
  p.barra([0.016, 0, 0], [0.016, 0.16, 0], 0.008, C.cromo, 8);
  p.esfera(0.022, C.rojo, { pos: [0.016, 0.175, 0], lados: 12, anillos: 6 });
  return p.geometria();
}

/** Ángulo de la manija (radianes, alrededor de X) en reposo y jalada. */
export const MANIJA_REPOSO = -0.35;
export const MANIJA_JALADA = 0.55;

/** Largo del brazo: en reposo su punta sube por encima del cielo raso (no se ve). */
export const LARGO_BRAZO = 1.6;

/**
 * El brazo de la mano: dos tramos telescópicos con su collar, de y = 0 a `LARGO_BRAZO`. Con la
 * mano abajo, en las fichas, la punta sigue dentro de la carcasa del techo.
 */
export function geometriaBrazo(): BufferGeometry {
  const p = new Piezas();
  const mitad = LARGO_BRAZO / 2;
  p.cilindro(0.02, mitad + 0.02, C.cromo, { pos: [0, 0.03, 0], lados: 12 });
  p.cilindro(0.03, mitad, C.metal, { pos: [0, mitad, 0], lados: 12 });
  p.cilindro(0.034, 0.03, C.metalOscuro, { pos: [0, mitad - 0.01, 0], bisel: 0.006, lados: 12 });
  return p.geometria();
}

/**
 * La pinza: motor, travesaño y dos mandíbulas a lo largo de Z, con su labio. Las fichas que
 * saca (en x = ±0,045, y = −0,03) quedan entre las mandíbulas.
 */
export function geometriaPinza(): BufferGeometry {
  const p = new Piezas();
  p.cilindro(0.046, 0.05, C.metalOscuro, { pos: [0, 0.005, 0], bisel: 0.01, lados: 16 });
  p.cilindro(0.048, 0.012, C.amarillo, { pos: [0, 0.03, 0], lados: 16 });
  p.caja([0.06, 0.02, 0.15], C.metal, { pos: [0, -0.004, 0], bisel: 0.006 });
  for (const s of [-1, 1]) {
    p.caja([0.13, 0.07, 0.01], '#8a96a3', { pos: [0, -0.045, s * 0.056], bisel: 0.004 });
    p.caja([0.13, 0.012, 0.022], C.metalOscuro, { pos: [0, -0.076, s * 0.047], bisel: 0.004 });
    p.barra([0, 0.01, s * 0.04], [0, -0.01, s * 0.056], 0.006, C.cromo, 6);
  }
  return p.geometria();
}

/** Ficha azul: redonda, con el canto biselado y el centro hundido. Centrada en su alto. */
export function geometriaFichaAzul(lado: number, alto: number): BufferGeometry {
  const r = lado / 2;
  const b = alto * 0.25;
  const perfil: PuntoPerfil[] = [
    [0, -alto / 2],
    [r - b, -alto / 2],
    [r, -alto / 2 + b],
    [r, alto / 2 - b],
    [r - b, alto / 2],
    [r * 0.72, alto / 2],
    [r * 0.66, alto / 2 - b * 0.8],
    [0, alto / 2 - b * 0.8],
  ];
  return new Piezas().torno(perfil, '#ffffff', { lados: 16 }).geometria();
}

/** Ficha amarilla: cuadrada, con bisel y un cuadro en relieve. Centrada en su alto. */
export function geometriaFichaAmarilla(lado: number, alto: number): BufferGeometry {
  const p = new Piezas();
  p.caja([lado, alto * 0.84, lado], '#ffffff', { pos: [0, -alto * 0.08, 0], bisel: alto * 0.25 });
  p.caja([lado * 0.6, alto * 0.16, lado * 0.6], '#ffffff', {
    pos: [0, alto * 0.42, 0],
    bisel: alto * 0.06,
  });
  return p.geometria();
}

/** Medidas de la caja fuerte de `salas.json` (0,7 × 0,9 × 0,6 m; base en y = 0, frente hacia +Z). */
export const CAJA = { ancho: 0.7, alto: 0.9, fondo: 0.6, marco: 0.05 } as const;
/** Altura de la repisa de adentro, donde está la llave. */
export const REPISA_CAJA = 0.41;
/** Dónde está la llave sobre la repisa: hacia la boca y al lado contrario de la bisagra. */
export const LLAVE_CAJA = { x: 0.08, z: 0.17 } as const;

const CUERPO = '#2c3e50';
const FORRO = '#111418';

/** El cuerpo hueco de la caja fuerte, con su forro oscuro y la repisa de adentro. */
function cuerpoCaja(p: Piezas): void {
  const { ancho, alto, fondo, marco } = CAJA;
  const hueco = ancho - 2 * marco;
  const altoLado = alto - 2 * marco - 0.01;
  p.caja([ancho, marco, fondo], CUERPO, { pos: [0, alto - marco / 2, 0], bisel: 0.014 });
  p.caja([ancho, marco + 0.01, fondo], CUERPO, { pos: [0, (marco + 0.01) / 2, 0], bisel: 0.014 });
  for (const s of [-1, 1]) {
    p.caja([marco, altoLado, fondo], CUERPO, {
      pos: [(s * (ancho - marco)) / 2, marco + 0.01 + altoLado / 2, 0],
      bisel: 0.01,
    });
  }
  p.caja([hueco, altoLado, 0.04], CUERPO, {
    pos: [0, marco + 0.01 + altoLado / 2, -fondo / 2 + 0.02],
  });
  // Forro de adentro (las caras que se ven con la puerta abierta).
  const y0 = marco + 0.01;
  const y1 = alto - marco;
  const z0 = -fondo / 2 + 0.04;
  const z1 = fondo / 2;
  p.caja([hueco, y1 - y0, 0.004], FORRO, { pos: [0, (y0 + y1) / 2, z0 + 0.002] });
  for (const s of [-1, 1]) {
    p.caja([0.004, y1 - y0, z1 - z0], FORRO, {
      pos: [s * (hueco / 2 - 0.002), (y0 + y1) / 2, (z0 + z1) / 2],
    });
  }
  p.caja([hueco, 0.004, z1 - z0], FORRO, { pos: [0, y0 + 0.002, (z0 + z1) / 2] });
  p.caja([hueco, 0.004, z1 - z0], FORRO, { pos: [0, y1 - 0.002, (z0 + z1) / 2] });
  // Repisa de metal en la mitad, casi hasta la boca: la llave queda a la vista al abrir.
  p.caja([hueco - 0.01, 0.016, 0.48], C.metalOscuro, {
    pos: [0, REPISA_CAJA - 0.008, z0 + 0.24],
    bisel: 0.004,
  });
  // Zócalo un poco más oscuro.
  p.caja([ancho - 0.02, 0.03, fondo - 0.02], C.negro, { pos: [0, 0.015, 0] });
}

/**
 * La puerta de la caja fuerte, colgada de su bisagra: el borde izquierdo en x = 0, la base en
 * y = 0 y centrada en su grueso. Incluye las bisagras, el dial, la manija y la placa.
 */
export function geometriaPuerta(ancho: number, alto: number): BufferGeometry {
  const p = new Piezas();
  const f = 0.015;
  p.caja([ancho, alto, 0.03], '#3d566e', { pos: [ancho / 2, alto / 2, 0], bisel: 0.01 });
  p.caja([ancho - 0.1, alto - 0.12, 0.01], CUERPO, {
    pos: [ancho / 2, alto / 2, f + 0.002],
    bisel: 0.004,
  });
  // Bisagras: dos cilindros en el borde.
  for (const y of [0.1, alto - 0.24]) {
    p.cilindro(0.014, 0.14, C.cromo, { pos: [-0.004, y, 0], bisel: 0.004, lados: 10 });
  }
  // Dial: aro cromado, cara negra con 12 marcas, perilla y la flecha roja arriba.
  const dial: V3 = [ancho * 0.6, alto * 0.62, f + 0.007];
  p.en({ pos: dial, giro: [90, 0, 0] }, () => {
    p.cilindro(0.075, 0.01, C.cromo, { bisel: 0.004, lados: 24 });
    p.cilindro(0.062, 0.014, C.negro, { lados: 24 });
    p.cilindro(0.024, 0.032, C.metal, { bisel: 0.006, lados: 12 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const largo = i % 3 === 0 ? 0.016 : 0.009;
      p.caja([0.004, 0.003, largo], C.blanco, {
        pos: [0.052 * Math.sin(a), 0.0145, -0.052 * Math.cos(a)],
        giro: [0, (-a * 180) / Math.PI, 0],
      });
    }
  });
  p.caja([0.008, 0.016, 0.004], C.rojo, { pos: [dial[0], dial[1] + 0.083, f + 0.014] });
  // Manija de tres rayos con pomos.
  const centro: V3 = [ancho * 0.6, alto * 0.3, f];
  p.cilindro(0.022, 0.03, C.cromo, { pos: centro, giro: [90, 0, 0], bisel: 0.006, lados: 12 });
  for (const grados of [90, 210, 330]) {
    const a = (grados * Math.PI) / 180;
    const fin: V3 = [centro[0] + 0.085 * Math.cos(a), centro[1] + 0.085 * Math.sin(a), f + 0.03];
    p.barra([centro[0], centro[1], f + 0.03], fin, 0.008, C.cromo, 8);
    p.esfera(0.015, C.cromo, { pos: fin, lados: 10, anillos: 5 });
  }
  // Cerradura y placa de latón.
  // Cerradura y placa de latón, delante del panel (que llega a z = f + 0,012).
  p.cilindro(0.02, 0.006, C.laton, {
    pos: [ancho * 0.86, alto * 0.62, f + 0.01],
    giro: [90, 0, 0],
    lados: 12,
  });
  p.caja([0.006, 0.02, 0.003], C.negro, { pos: [ancho * 0.86, alto * 0.62, f + 0.017] });
  p.caja([0.2, 0.05, 0.006], C.laton, { pos: [ancho * 0.5, alto * 0.88, f + 0.015], bisel: 0.003 });
  p.caja([0.16, 0.006, 0.002], C.latonOscuro, { pos: [ancho * 0.5, alto * 0.89, f + 0.019] });
  p.caja([0.12, 0.006, 0.002], C.latonOscuro, { pos: [ancho * 0.5, alto * 0.87, f + 0.019] });
  return p.geometria();
}

/** La llave del sello: argolla, caña y paletón, de pie, con la base en y = 0 y mirando hacia +Z. */
export function geometriaLlave(): BufferGeometry {
  const p = new Piezas();
  p.toro(0.04, 0.011, '#ffffff', { pos: [0, 0.17, 0], giro: [90, 0, 0], lados: 16, tubo: 6 });
  p.barra([0, 0.004, 0], [0, 0.13, 0], 0.011, '#ffffff', 8);
  // Paletón apoyado en la repisa y su segundo diente encima, pegado a él.
  p.caja([0.05, 0.022, 0.012], '#ffffff', { pos: [0.024, 0.011, 0], bisel: 0.003 });
  p.caja([0.02, 0.018, 0.012], '#ffffff', { pos: [0.039, 0.031, 0], bisel: 0.003 });
  p.cilindro(0.016, 0.012, '#ffffff', { pos: [0, 0.122, 0], bisel: 0.003, lados: 10 });
  return p.geometria();
}

/**
 * Viste la urna y la caja fuerte, cuelga de la urna su base y une a lo fijo la carcasa de la
 * mano. Se puede llamar varias veces con la misma sala: lo hecho no se repite.
 */
export function pulirRectoria(raiz: Object3D): void {
  const urna = raiz.getObjectByName('s5-urna');
  if (urna) {
    const vidrio = new Piezas();
    vidrioUrna(vidrio);
    vestirMalla(urna, vidrio, '#d6eaf8');
    if (!urna.getObjectByName(URNA_BASE)) {
      const p = new Piezas();
      baseUrna(p);
      const base = new Mesh(p.geometria(), new MeshLambertMaterial({ vertexColors: true }));
      base.name = URNA_BASE;
      urna.add(base);
    }
    // La carcasa del techo queda lejos de todo lo que se toca: va con lo fijo.
    const fija = new Piezas();
    fija.en({ pos: [urna.position.x, 0, urna.position.z] }, () => carcasaMano(fija));
    sumarAFija(raiz, 'rectoria-mano', fija);
  }
  const caja = raiz.getObjectByName('s5-caja-fuerte');
  if (caja) {
    const p = new Piezas();
    cuerpoCaja(p);
    vestirMalla(caja, p);
  }
}
