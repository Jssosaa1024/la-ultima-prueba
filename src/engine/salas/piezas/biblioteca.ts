/**
 * Piezas por código de la biblioteca (pulir las salas, sesión B): la ficha rota del mostrador
 * y la alfombra del rincón de lectura. Cada una cabe en el `tam` de su objeto de `salas.json`
 * y es una sola malla. Lo que anima la máquina (carritos, montones, pila y focos) lo pule
 * `src/engine/mecanismos/biblioteca-piezas.ts`.
 */
import { ExtrudeGeometry, Shape } from 'three';
import type { BufferGeometry } from 'three';
import { cajaBiselada, parte, unirPartes } from './comunes';
import type { ConstructorPieza, Parte } from './comunes';

/** Paleta: colores planos como los de KayKit y Kenney. */
const PALETA = {
  carton: '#f7f3e8',
  rojo: '#d9534f',
  azul: '#8fb3d9',
  tinta: '#4a4f57',
  vino: '#7a2e3a',
  vinoClaro: '#9c4b55',
  oro: '#d4a24c',
  oroClaro: '#e2c27a',
  crema: '#efe3c8',
} as const;

/** Un número entre 0 y 1 que siempre es el mismo para la misma semilla (sin azar). */
function fijo(n: number): number {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
}

// ---------- Ficha rota ----------

/** Medidas de la ficha entera (una ficha bibliográfica de 12,5 × 7,5 cm) y su grosor. */
const FICHA = { ancho: 0.125, fondo: 0.075, grosor: 0.0015 } as const;
/** Renglones de la ficha (de arriba hacia abajo, en la coordenada `v` de la ficha). */
const RENGLONES = [0.013, 0.002, -0.009, -0.02, -0.031] as const;
const ENCABEZADO = 0.024;
/** Puntos del borde roto, de abajo hacia arriba: x según la altura `v` de la ficha. */
const ROTURA: readonly (readonly [number, number])[] = [
  [0.006, -0.0375],
  [0.001, -0.029],
  [0.007, -0.021],
  [0.0, -0.012],
  [0.006, -0.004],
  [-0.002, 0.005],
  [0.004, 0.013],
  [-0.003, 0.022],
  [0.003, 0.03],
  [-0.002, 0.0375],
];

/** x del borde roto a la altura `v` (interpolado entre los puntos de la rotura). */
function xRotura(v: number): number {
  for (let i = 1; i < ROTURA.length; i++) {
    const [x1, v1] = ROTURA[i] ?? [0, 0];
    const [x0, v0] = ROTURA[i - 1] ?? [0, 0];
    if (v <= v1) return x0 + ((x1 - x0) * (v - v0)) / (v1 - v0 || 1);
  }
  return ROTURA[ROTURA.length - 1]?.[0] ?? 0;
}

/**
 * Un pedazo de cartón de la ficha, acostado (el grosor hacia +Y). `v` de la ficha va hacia −Z,
 * como si se leyera desde el frente del mostrador.
 */
function pedazo(lado: 'izquierdo' | 'derecho'): BufferGeometry {
  const s = new Shape();
  const borde = lado === 'izquierdo' ? -FICHA.ancho / 2 : FICHA.ancho / 2;
  const h = FICHA.fondo / 2;
  s.moveTo(borde, -h);
  for (const [x, v] of ROTURA) s.lineTo(x, v);
  s.lineTo(borde, h);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: FICHA.grosor, bevelEnabled: false });
  return g.rotateX(-Math.PI / 2);
}

/** Renglones, encabezado y trazos de letra de un pedazo, sobre el cartón. */
function rayasDe(lado: 'izquierdo' | 'derecho'): Parte[] {
  const y = FICHA.grosor + 0.0002;
  const partes: Parte[] = [];
  const tramo = (v: number, color: string, grueso: number, alto = 0.0004): void => {
    const roto = xRotura(v);
    const [x0, x1] =
      lado === 'izquierdo'
        ? [-FICHA.ancho / 2 + 0.005, roto - 0.0018]
        : [roto + 0.0018, FICHA.ancho / 2 - 0.005];
    if (x1 - x0 < 0.004) return;
    partes.push(parte(cajaBiselada(x1 - x0, alto, grueso, 0), color, [(x0 + x1) / 2, y, -v]));
  };
  tramo(ENCABEZADO, PALETA.rojo, 0.0011);
  for (const v of RENGLONES) tramo(v, PALETA.azul, 0.0006);
  // Letra a mano: trazos cortos sobre los renglones de arriba, sin decir nada (se lee en 2D).
  RENGLONES.slice(0, 4).forEach((v, fila) => {
    let x = lado === 'izquierdo' ? -FICHA.ancho / 2 + 0.008 : xRotura(v + 0.004) + 0.005;
    const fin = lado === 'izquierdo' ? xRotura(v + 0.004) - 0.005 : FICHA.ancho / 2 - 0.012;
    for (let n = 0; x < fin; n++) {
      const largo = Math.min(
        fin - x,
        0.006 + fijo(fila * 13 + n + (lado === 'derecho' ? 50 : 0)) * 0.012,
      );
      if (largo > 0.003) {
        partes.push(
          parte(cajaBiselada(largo, 0.0004, 0.0013, 0), PALETA.tinta, [
            x + largo / 2,
            y + 0.0002,
            -(v + 0.0042),
          ]),
        );
      }
      x += largo + 0.003;
    }
  });
  return partes;
}

/** Un pedazo con sus rayas, girado `grados` sobre su centro y corrido `dx`, `dz`. */
function pedazoColocado(
  lado: 'izquierdo' | 'derecho',
  grados: number,
  dx: number,
  dz: number,
): Parte[] {
  const cx = lado === 'izquierdo' ? -FICHA.ancho / 4 : FICHA.ancho / 4;
  const partes = [{ g: pedazo(lado), color: PALETA.carton }, ...rayasDe(lado)];
  for (const p of partes) {
    p.g
      .translate(-cx, 0, 0)
      .rotateY((grados * Math.PI) / 180)
      .translate(cx + dx, 0, dz);
  }
  return partes;
}

/** La ficha rota en dos, con los pedazos un poco separados y torcidos. */
const fichaRota: ConstructorPieza = () => ({
  geometria: unirPartes([
    ...pedazoColocado('izquierdo', 3, -0.004, -0.002),
    ...pedazoColocado('derecho', -9, 0.006, 0.006),
  ]),
});

// ---------- Alfombra ----------

/** Rombo acostado (un cuadrado girado 45°) de `lado` metros, de `alto` de grueso. */
function rombo(lado: number, alto: number, color: string, y: number, z = 0, x = 0): Parte {
  return parte(cajaBiselada(lado, alto, lado, 0), color, [x, y + alto / 2, z], [0, 45, 0]);
}

/** Alfombra de lana: borde vinotinto, campo, filete dorado, medallón, esquineros y flecos. */
const alfombra: ConstructorPieza = (o) => {
  const [ancho = 1.2, , fondo = 1.7] = o.tam;
  const largo = fondo - 0.08;
  const partes: Parte[] = [
    parte(cajaBiselada(ancho, 0.012, largo, 0.004), PALETA.vino, [0, 0.006, 0]),
    parte(cajaBiselada(ancho - 0.16, 0.0025, largo - 0.16, 0), PALETA.vinoClaro, [0, 0.01325, 0]),
  ];
  // Filete dorado alrededor del campo.
  const fw = ancho - 0.26;
  const fl = largo - 0.26;
  const yFilete = 0.0145 + 0.00075;
  for (const s of [-1, 1]) {
    partes.push(parte(cajaBiselada(fw, 0.0015, 0.018, 0), PALETA.oro, [0, yFilete, (s * fl) / 2]));
    partes.push(parte(cajaBiselada(0.018, 0.0015, fl, 0), PALETA.oro, [(s * fw) / 2, yFilete, 0]));
  }
  // Medallón del centro y esquineros.
  partes.push(rombo(0.42, 0.0015, PALETA.oroClaro, 0.0145));
  partes.push(rombo(0.3, 0.0015, PALETA.vino, 0.016));
  partes.push(rombo(0.12, 0.0015, PALETA.crema, 0.0175));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      partes.push(
        rombo(0.11, 0.0015, PALETA.oro, 0.0145, (sz * (fl - 0.12)) / 2, (sx * (fw - 0.12)) / 2),
      );
    }
    // Rombos menores sobre el eje largo.
    partes.push(rombo(0.08, 0.0015, PALETA.oroClaro, 0.0145, (sx * fl) / 4, 0));
  }
  // Flecos en los dos extremos cortos.
  const flecos = 16;
  for (const s of [-1, 1]) {
    for (let i = 0; i < flecos; i++) {
      const x = -ancho / 2 + 0.05 + (i * (ancho - 0.1)) / (flecos - 1);
      const l = 0.032 + fijo(i + (s > 0 ? 40 : 0)) * 0.008;
      partes.push(
        parte(cajaBiselada(0.014, 0.004, l, 0), PALETA.crema, [x, 0.002, s * (largo / 2 + l / 2)]),
      );
    }
  }
  return { geometria: unirPartes(partes) };
};

export const PIEZAS_BIBLIOTECA: Readonly<Record<string, ConstructorPieza>> = {
  'ficha-rota': fichaRota,
  alfombra,
};
