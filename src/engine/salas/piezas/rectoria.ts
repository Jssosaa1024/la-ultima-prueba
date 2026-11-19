/**
 * Piezas por código de la rectoría (pulir las salas, sesión B): los dispensadores de fichas,
 * el botón «ver parejas» y el parlante de La Voz. Cada una cabe en el `tam` de su objeto de
 * `salas.json` y es una sola malla. Lo que anima la máquina de la urna (la urna, las fichas,
 * la mano mecánica y la caja fuerte) lo pule `src/engine/mecanismos/rectoria-piezas.ts`.
 */
import { CylinderGeometry, LatheGeometry, TorusGeometry, Vector2 } from 'three';
import type { BufferGeometry } from 'three';
import { cajaBiselada, cilindro, parte, unirPartes } from './comunes';
import type { ConstructorPieza, Parte } from './comunes';

/** Paleta: colores planos como los de KayKit y Kenney. */
const PALETA = {
  negro: '#22262b',
  ranura: '#121517',
  metalOscuro: '#3e4a50',
  metal: '#76858c',
  cromo: '#c5ced3',
  azul: '#2e86c1',
  azulOscuro: '#1f5f8b',
  fichaAzul: '#5aa9e6',
  amarillo: '#f4d03f',
  amarilloOscuro: '#c9a227',
  fichaAmarilla: '#f1c40f',
  rojo: '#d63c2f',
  rojoOscuro: '#922b21',
  blanco: '#eef1ee',
  verde: '#58d68d',
  parlante: '#3b4149',
  rejilla: '#6a737d',
} as const;

/** Pieza de torno (alrededor de Y) con un perfil de puntos `[radio, altura]` de abajo arriba. */
function torno(perfil: readonly (readonly [number, number])[], lados = 16): BufferGeometry {
  return new LatheGeometry(
    perfil.map(([r, y]) => new Vector2(r, y)),
    lados,
  );
}

// ---------- Dispensadores ----------

/** Lado del cuerpo de un dispensador y alto de su base. */
const BASE_DISPENSADOR = { ancho: 0.14, alto: 0.085, fondo: 0.12 } as const;
const ALTO_FICHA = 0.012;
const RADIO_FICHA = 0.025;

/**
 * Una ficha de la columna del dispensador, con la base en y = 0: azul redonda o amarilla
 * cuadrada. Simples (sin bisel): son muchas y se ven chicas a través de las varillas.
 */
function ficha(azul: boolean, x: number, y: number, z: number, giro: number): Parte {
  const g = azul
    ? cilindro(RADIO_FICHA, RADIO_FICHA, ALTO_FICHA, 10)
    : cajaBiselada(2 * RADIO_FICHA, ALTO_FICHA, 2 * RADIO_FICHA, 0);
  return parte(
    g,
    azul ? PALETA.fichaAzul : PALETA.fichaAmarilla,
    [x, y + ALTO_FICHA / 2, z],
    [0, giro, 0],
  );
}

/**
 * Un dispensador de monedero: cuerpo de su color con la boca por donde sale la ficha y una
 * tecla encima, una columna de fichas a la vista entre tres varillas y una tapa cromada.
 */
function dispensador(x: number, azul: boolean, alto: number): Parte[] {
  const color = azul ? PALETA.azul : PALETA.amarillo;
  const oscuro = azul ? PALETA.azulOscuro : PALETA.amarilloOscuro;
  const { ancho, fondo } = BASE_DISPENSADOR;
  const base = BASE_DISPENSADOR.alto;
  const partes: Parte[] = [
    parte(cajaBiselada(ancho, base, fondo, 0.015), color, [x, base / 2, 0]),
    parte(cajaBiselada(ancho + 0.006, 0.012, fondo + 0.006, 0), oscuro, [x, 0.006, 0]),
    // Boca de salida, al frente, con su bandejita.
    parte(cajaBiselada(0.07, 0.03, 0.01, 0), PALETA.ranura, [x, 0.035, fondo / 2 - 0.003]),
    parte(cajaBiselada(0.075, 0.008, 0.02, 0), PALETA.cromo, [x, 0.018, fondo / 2 + 0.001]),
    // Tecla para soltar una ficha.
    parte(cajaBiselada(0.04, 0.014, 0.03, 0), PALETA.cromo, [x, base + 0.002, fondo / 2 - 0.025]),
  ];
  // Columna de fichas a la vista.
  const desde = base;
  const tope = alto - 0.03;
  const n = Math.floor((tope - desde - 0.004) / (ALTO_FICHA + 0.001));
  for (let i = 0; i < n; i++) {
    partes.push(ficha(azul, x, desde + i * (ALTO_FICHA + 0.001), -0.005, (i * 17) % 30));
  }
  // Tres varillas alrededor de la columna y la tapa.
  for (const a of [30, 150, 270]) {
    const r = RADIO_FICHA + 0.012;
    const px = x + r * Math.sin((a * Math.PI) / 180);
    const pz = -0.005 + r * Math.cos((a * Math.PI) / 180);
    partes.push(
      parte(cilindro(0.004, 0.004, tope - desde, 6), PALETA.cromo, [px, (desde + tope) / 2, pz]),
    );
  }
  partes.push(
    parte(
      torno(
        [
          [0.012, tope],
          [0.045, tope],
          [0.048, tope + 0.006],
          [0.048, alto - 0.006],
          [0.044, alto],
          [0, alto],
        ],
        12,
      ),
      PALETA.cromo,
      [x, 0, -0.005],
    ),
  );
  return partes;
}

/** Los dos dispensadores, el azul a la izquierda y el amarillo a la derecha. */
const dispensadores: ConstructorPieza = (o) => {
  const [ancho = 0.4, alto = 0.3] = o.tam;
  const x = ancho / 2 - 0.08;
  return {
    geometria: unirPartes([...dispensador(-x, true, alto), ...dispensador(x, false, alto)]),
  };
};

// ---------- Botón «ver parejas» ----------

/** Botón de hongo rojo sobre una base negra con su aro cromado. */
const botonParejas: ConstructorPieza = (o) => {
  const [diametro = 0.12, alto = 0.05] = o.tam;
  const r = diametro / 2;
  const base = alto * 0.4;
  return {
    geometria: unirPartes([
      parte(
        torno(
          [
            [0, 0],
            [r, 0],
            [r, base * 0.7],
            [r - 0.006, base],
            [0, base],
          ],
          14,
        ),
        PALETA.negro,
      ),
      parte(new TorusGeometry(r * 0.72, 0.004, 4, 14).rotateX(Math.PI / 2), PALETA.cromo, [
        0,
        base + 0.001,
        0,
      ]),
      parte(
        torno(
          [
            [r * 0.62, base],
            [r * 0.66, base + 0.006],
            [r * 0.64, alto - 0.012],
            [r * 0.5, alto - 0.004],
            [r * 0.25, alto],
            [0, alto],
          ],
          14,
        ),
        PALETA.rojo,
      ),
      parte(new CylinderGeometry(r * 0.6, r * 0.6, 0.004, 14), PALETA.rojoOscuro, [
        0,
        base + 0.002,
        0,
      ]),
    ]),
  };
};

// ---------- Parlante de La Voz ----------

/**
 * Parlante de pared: caja con cantos biselados, marco de la rejilla con agujeros, tweeter
 * arriba, cono del woofer abajo y un piloto verde. Frente hacia +Z.
 */
const parlante: ConstructorPieza = (o) => {
  const [ancho = 0.32, alto = 0.42, fondo = 0.16] = o.tam;
  // La caja va un poco hacia la pared: el woofer, el tweeter y la rejilla salen al frente sin
  // pasarse del `tam`.
  const frente = fondo / 2 - 0.03;
  const partes: Parte[] = [
    parte(cajaBiselada(ancho, alto, fondo - 0.03, 0.025), PALETA.parlante, [0, alto / 2, -0.015]),
    // Marco de la rejilla: una franja oscura alrededor del frente.
    parte(cajaBiselada(ancho - 0.03, alto - 0.03, 0.004, 0), PALETA.negro, [
      0,
      alto / 2,
      frente + 0.002,
    ]),
  ];
  // Woofer abajo: aro y cono hundido hacia la caja (sus caras miran al frente).
  const yWoofer = alto * 0.38;
  const rw = Math.min(ancho, alto) * 0.3;
  partes.push(
    parte(new TorusGeometry(rw, 0.008, 4, 16), PALETA.rejilla, [0, yWoofer, frente + 0.012]),
    parte(
      // Del borde hacia el centro: el cono se hunde y sus caras miran hacia el frente.
      torno(
        [
          [rw, 0.018],
          [rw * 0.45, 0.008],
          [rw * 0.2, 0.006],
          [0, 0],
        ],
        14,
      ).rotateX(Math.PI / 2),
      PALETA.ranura,
      [0, yWoofer, frente + 0.004],
    ),
  );
  // Tweeter arriba.
  const yTweeter = alto * 0.8;
  partes.push(
    parte(new TorusGeometry(0.03, 0.007, 4, 12), PALETA.rejilla, [0, yTweeter, frente + 0.011]),
    parte(
      torno(
        [
          [0.03, 0],
          [0.014, 0.008],
          [0, 0.012],
        ],
        12,
      ).rotateX(Math.PI / 2),
      PALETA.metal,
      [0, yTweeter, frente + 0.004],
    ),
  );
  // Agujeros de la rejilla a los lados del woofer.
  for (const sx of [-1, 1]) {
    for (let fila = 0; fila < 5; fila++) {
      partes.push(
        parte(cajaBiselada(0.012, 0.012, 0.004, 0), PALETA.ranura, [
          sx * (ancho / 2 - 0.045),
          yWoofer - 0.08 + fila * 0.04,
          frente + 0.005,
        ]),
      );
    }
  }
  // Piloto verde: La Voz está encendida.
  partes.push(
    parte(new CylinderGeometry(0.008, 0.008, 0.006, 8).rotateX(Math.PI / 2), PALETA.verde, [
      ancho / 2 - 0.045,
      alto * 0.8,
      frente + 0.006,
    ]),
  );
  return { geometria: unirPartes(partes) };
};

export const PIEZAS_RECTORIA: Readonly<Record<string, ConstructorPieza>> = {
  dispensadores,
  'boton-parejas': botonParejas,
  parlante,
};
