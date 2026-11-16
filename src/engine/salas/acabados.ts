/**
 * Acabados por código (T19j): lo que hace que una sala deje de verse como una caja, sin
 * descargar nada y casi sin draw calls.
 *
 * - Zócalo pintado: la parte baja de las paredes de otro color, con una franja encima (como en
 *   los pasillos de colegio), rodapié al pie y cornisa junto al techo.
 * - Marcos alrededor de cada puerta y de cada tablero plano de la pared (pizarra, corcho, mural).
 * - Lámparas de techo repartidas a lo largo de la sala: la carcasa va con lo fijo; el difusor que
 *   brilla es una malla sin luz propia, y el halo (en el techo) y el charco de luz (en el piso),
 *   otra malla aditiva con una textura de 64 × 64 hecha por código.
 * - Rincones oscurecidos (oclusión falsa): franjas de sombra junto a las paredes, en el piso y el
 *   techo, y en las esquinas. Van en la malla de las sombras de contacto (`sombras.ts`).
 *
 * Lo de color plano se une a la malla fija de la sala (`construir.ts`). Si la sala no tenía
 * malla fija (todo lo fijo con textura o modelo, como la portería y la sala 1), esa malla es
 * una draw call nueva. Las lámparas suman dos: hasta tres en total. Nada de esto choca, y el
 * rayo del toque atraviesa lo que brilla.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  RGBAFormat,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObjetoSala, Sala } from '../../content/esquema-salas';
import type { Cuadro } from './sombras';

export type Acabados = NonNullable<Sala['acabados']>;
type Medidas = Pick<Sala, 'ancho' | 'fondo' | 'alto'>;
type V3 = [number, number, number];

/** Altura del zócalo pintado hasta el borde de arriba de su franja, en metros. */
export const ALTO_ZOCALO = 1.05;
const GRUESO_ZOCALO = 0.012;
const ALTO_FRANJA = 0.05;
const GRUESO_FRANJA = 0.025;
const ALTO_RODAPIE = 0.1;
const GRUESO_RODAPIE = 0.022;
const ALTO_CORNISA = 0.07;
const GRUESO_CORNISA = 0.045;

/** Ancho de la madera del marco de una puerta. */
const ANCHO_MARCO = 0.08;
/** Fondo del marco de una puerta: sobresale 2 cm del modelo de la puerta (12 cm). */
const FONDO_MARCO_PUERTA = 0.16;
const ANCHO_MARCO_TABLERO = 0.06;
const FONDO_MARCO_TABLERO = 0.05;
/** Un tablero lleva marco si mide al menos esto de ancho y de alto (el reloj no). */
const TABLERO_MINIMO = { ancho: 0.6, alto: 0.5 };

/** Una lámpara por cada tanto de largo de la sala. */
const METROS_POR_LAMPARA = 3.4;
const CARCASA = { ancho: 1.25, alto: 0.06, fondo: 0.4 };
const DIFUSOR = { ancho: 1.1, fondo: 0.28 };
const COLOR_CARCASA = '#dedbd3';
const COLOR_DIFUSOR = 0xfff4de;
const COLOR_BRILLO = 0xffe2b8;
/** Halo en el techo y charco de luz en el piso: medidas en metros y cuánto suma cada uno. */
const HALO = { ancho: 2.6, fondo: 1.5, fuerza: 0.9 };
const CHARCO = { ancho: 3.4, fondo: 3.4, fuerza: 0.42 };
const OPACIDAD_BRILLO = 0.35;
const LADO_TEXTURA_BRILLO = 64;
/** Para que no parpadeen con el piso, el techo o las sombras de contacto (a 4 mm). */
const SOBRE_PISO = 0.006;
const BAJO_TECHO = 0.008;

/**
 * Franjas de oclusión falsa: ancho en metros y oscuridad junto a la pared, como coordenada v de
 * la textura de sombra (0,5 = la sombra de contacto completa; 0 = nada).
 */
const OCLUSION = {
  piso: { ancho: 0.5, v: 0.32, y: 0.003 },
  techo: { ancho: 0.4, v: 0.22 },
  esquina: { ancho: 0.32, v: 0.28 },
};
/** Las franjas de las esquinas van delante del rodapié y de la franja del zócalo. */
const SEPARACION_ESQUINA = 0.03;
const GRADOS = Math.PI / 180;

/** Cara de adentro de una pared: su centro, su largo y el giro que lleva +Z hacia la sala. */
export interface Pared {
  x: number;
  z: number;
  largo: number;
  giro: number;
}

export function paredesDe(sala: Pick<Sala, 'ancho' | 'fondo'>): Pared[] {
  const { ancho: w, fondo: f } = sala;
  return [
    { x: 0, z: -f / 2, largo: w, giro: 0 },
    { x: 0, z: f / 2, largo: w, giro: Math.PI },
    { x: -w / 2, z: 0, largo: f, giro: Math.PI / 2 },
    { x: w / 2, z: 0, largo: f, giro: -Math.PI / 2 },
  ];
}

/** A lo largo de la pared (su +X) y hacia la sala (su +Z), en el mundo. */
function ejes(p: Pared): { largo: V3; normal: V3 } {
  const c = Math.cos(p.giro);
  const s = Math.sin(p.giro);
  return { largo: [c, 0, -s], normal: [s, 0, c] };
}

/** Una tira pegada a la pared, de `y` a `y + alto` y `grueso` hacia la sala. */
function tira(p: Pared, y: number, alto: number, grueso: number): BufferGeometry {
  return new BoxGeometry(p.largo, alto, grueso)
    .translate(0, y + alto / 2, grueso / 2)
    .rotateY(p.giro)
    .translate(p.x, 0, p.z);
}

function unir(partes: BufferGeometry[]): BufferGeometry {
  const unida = mergeGeometries(partes);
  partes.forEach((g) => g.dispose());
  if (!unida) throw new Error('No se pudieron unir los acabados de la sala');
  return unida;
}

/** Puertas: los planos que llevan a otra sala o que se ven como una puerta. */
export const esPuerta = (o: ObjetoSala): boolean =>
  o.forma === 'plano' && (o.puerta !== undefined || (o.modelo?.startsWith('puerta') ?? false));

/** Tableros: los planos grandes sin modelo (pizarra, corcho, mural). */
export const esTablero = (o: ObjetoSala): boolean =>
  o.forma === 'plano' &&
  !o.modelo &&
  !esPuerta(o) &&
  o.tam[0] >= TABLERO_MINIMO.ancho &&
  o.tam[1] >= TABLERO_MINIMO.alto;

/** Piezas del marco en las coordenadas del objeto: el plano centrado en x y z, la base en y = 0. */
function piezasMarco(o: ObjetoSala): BufferGeometry[] {
  const [w, h] = o.tam;
  if (esPuerta(o)) {
    const b = ANCHO_MARCO;
    const d = FONDO_MARCO_PUERTA;
    return [
      new BoxGeometry(b, h + b, d).translate(-(w + b) / 2, (h + b) / 2, 0),
      new BoxGeometry(b, h + b, d).translate((w + b) / 2, (h + b) / 2, 0),
      new BoxGeometry(w + 2 * b, b, d).translate(0, h + b / 2, 0),
    ];
  }
  const b = ANCHO_MARCO_TABLERO;
  const d = FONDO_MARCO_TABLERO;
  return [
    new BoxGeometry(w + 2 * b, b, d).translate(0, h + b / 2, 0),
    new BoxGeometry(w + 2 * b, b, d).translate(0, -b / 2, 0),
    new BoxGeometry(b, h, d).translate(-(w + b) / 2, h / 2, 0),
    new BoxGeometry(b, h, d).translate((w + b) / 2, h / 2, 0),
  ];
}

/** El marco de una puerta o un tablero, ya puesto en el mundo con el giro del objeto. */
function marco(o: ObjetoSala): BufferGeometry {
  const m = new Matrix4()
    .makeRotationY((o.giro ?? 0) * GRADOS)
    .setPosition(o.pos[0], o.pos[1], o.pos[2]);
  return unir(piezasMarco(o)).applyMatrix4(m);
}

/** Dónde va cada lámpara: en fila por el centro, a lo largo del lado largo de la sala. */
export function lamparasDe(
  sala: Pick<Sala, 'ancho' | 'fondo'>,
): { x: number; z: number; giro: number }[] {
  const aLoAncho = sala.ancho > sala.fondo;
  const largo = aLoAncho ? sala.ancho : sala.fondo;
  const n = Math.max(1, Math.round(largo / METROS_POR_LAMPARA));
  const paso = largo / n;
  return Array.from({ length: n }, (_, i) => {
    const t = -largo / 2 + paso * (i + 0.5);
    // El lado largo de la lámpara va de través, de pared a pared.
    return aLoAncho ? { x: t, z: 0, giro: Math.PI / 2 } : { x: 0, z: t, giro: 0 };
  });
}

/** Círculo de luz: blanco, con el alfa que se apaga suave del centro al borde. */
export function texturaBrillo(): DataTexture {
  const n = LADO_TEXTURA_BRILLO;
  const datos = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = ((x + 0.5) / n) * 2 - 1;
      const dy = ((y + 0.5) / n) * 2 - 1;
      const resto = 1 - Math.min(1, dx * dx + dy * dy);
      const i = (y * n + x) * 4;
      datos.fill(255, i, i + 3);
      datos[i + 3] = Math.round(255 * resto * resto);
    }
  }
  const textura = new DataTexture(datos, n, n, RGBAFormat);
  textura.magFilter = LinearFilter;
  textura.minFilter = LinearFilter;
  textura.needsUpdate = true;
  return textura;
}

/** Un plano horizontal ya puesto en el mundo, mirando hacia arriba o hacia abajo. */
function horizontal(
  ancho: number,
  fondo: number,
  y: number,
  lugar: { x: number; z: number; giro: number },
  haciaAbajo: boolean,
): BufferGeometry {
  return new PlaneGeometry(ancho, fondo)
    .rotateX(haciaAbajo ? Math.PI / 2 : -Math.PI / 2)
    .translate(0, y, 0)
    .rotateY(lugar.giro)
    .translate(lugar.x, 0, lugar.z);
}

/** Pinta todos los vértices de una geometría con la misma intensidad. */
function conFuerza(g: BufferGeometry, fuerza: number): BufferGeometry {
  const n = g.getAttribute('position').count;
  g.setAttribute('color', new Float32BufferAttribute(new Array<number>(n * 3).fill(fuerza), 3));
  return g;
}

/** Difusores que brillan y halos de luz: dos mallas que no toman luz ni reciben toques. */
function crearLuces(sala: Medidas): Mesh[] {
  const lugares = lamparasDe(sala);
  const difusores = new Mesh(
    unir(
      lugares.map((l) =>
        horizontal(DIFUSOR.ancho, DIFUSOR.fondo, sala.alto - CARCASA.alto - 0.001, l, true),
      ),
    ),
    // Sin tono: el difusor se ve blanco pleno, más claro que todo lo que la luz ilumina.
    new MeshBasicMaterial({ color: COLOR_DIFUSOR, toneMapped: false }),
  );
  difusores.name = 'difusores';

  const brillos = new Mesh(
    unir(
      lugares.flatMap((l) => [
        conFuerza(horizontal(HALO.ancho, HALO.fondo, sala.alto - BAJO_TECHO, l, true), HALO.fuerza),
        conFuerza(horizontal(CHARCO.ancho, CHARCO.fondo, SOBRE_PISO, l, false), CHARCO.fuerza),
      ]),
    ),
    new MeshBasicMaterial({
      color: COLOR_BRILLO,
      map: texturaBrillo(),
      vertexColors: true,
      transparent: true,
      opacity: OPACIDAD_BRILLO,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  brillos.name = 'brillos';

  for (const m of [difusores, brillos]) m.raycast = () => undefined;
  return [difusores, brillos];
}

/** Un cuadro de sombra que se ve desde el lado de `normal`; junto a la pared, oscuridad `v`. */
function cuadro(origen: V3, u: V3, v: V3, normal: V3, oscuridad: number): Cuadro {
  const punto = (a: number, b: number): [number, number, number] => [
    origen[0] + u[0] * a + v[0] * b,
    origen[1] + u[1] * a + v[1] * b,
    origen[2] + u[2] * a + v[2] * b,
  ];
  const esquinas = [punto(0, 0), punto(1, 0), punto(1, 1), punto(0, 1)];
  const uvs: [number, number][] = [
    [0.5, oscuridad],
    [0.5, oscuridad],
    [0.5, 0],
    [0.5, 0],
  ];
  // Los triángulos (0, 1, 2) y (0, 2, 3) miran hacia u × v: si no es `normal`, al revés.
  const cruz: V3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const deFrente = cruz[0] * normal[0] + cruz[1] * normal[1] + cruz[2] * normal[2] > 0;
  if (deFrente) return { esquinas, uvs };
  // Del 0 al 3 en sentido contrario: 0, 3, 2, 1.
  const alReves = <T>(lista: T[]): T[] => [...lista.slice(0, 1), ...lista.slice(1).reverse()];
  return { esquinas: alReves(esquinas), uvs: alReves(uvs) };
}

/** Franjas de oclusión falsa junto a cada pared (piso y techo) y en cada esquina. */
export function oclusionDe(sala: Medidas): Cuadro[] {
  const cuadros: Cuadro[] = [];
  const escalar = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
  for (const p of paredesDe(sala)) {
    const { largo, normal } = ejes(p);
    const inicio = (y: number): V3 => [
      p.x - (largo[0] * p.largo) / 2,
      y,
      p.z - (largo[2] * p.largo) / 2,
    ];
    const aLoLargo = escalar(largo, p.largo);
    const { piso, techo, esquina } = OCLUSION;
    cuadros.push(
      cuadro(inicio(piso.y), aLoLargo, escalar(normal, piso.ancho), [0, 1, 0], piso.v),
      cuadro(
        inicio(sala.alto - piso.y),
        aLoLargo,
        escalar(normal, techo.ancho),
        [0, -1, 0],
        techo.v,
      ),
    );
    // Las dos esquinas de esta pared, de piso a techo, un poco delante de ella.
    const arriba: V3 = [0, sala.alto, 0];
    for (const lado of [-1, 1]) {
      const borde: V3 = [
        p.x + (largo[0] * lado * p.largo) / 2 + normal[0] * SEPARACION_ESQUINA,
        0,
        p.z + (largo[2] * lado * p.largo) / 2 + normal[2] * SEPARACION_ESQUINA,
      ];
      cuadros.push(cuadro(borde, arriba, escalar(largo, -lado * esquina.ancho), normal, esquina.v));
    }
  }
  return cuadros;
}

export interface SalaAcabada {
  /** Mallas de color plano que se unen con lo fijo de la sala. */
  fijas: Mesh[];
  /** Difusores y brillos de las lámparas: dos draw calls. */
  luces: Mesh[];
  /** Cuadros para la malla de sombras de contacto. */
  oclusion: Cuadro[];
}

export function crearAcabados(sala: Sala, acabados: Acabados): SalaAcabada {
  const paredes = paredesDe(sala);
  const zocalo = ALTO_ZOCALO - ALTO_FRANJA;
  const marcos = sala.objetos.filter((o) => esPuerta(o) || esTablero(o)).map(marco);
  const carcasas = lamparasDe(sala).map((l) =>
    new BoxGeometry(CARCASA.ancho, CARCASA.alto, CARCASA.fondo)
      .translate(0, sala.alto - CARCASA.alto / 2, 0)
      .rotateY(l.giro)
      .translate(l.x, 0, l.z),
  );
  const malla = (nombre: string, partes: BufferGeometry[], color: string): Mesh => {
    const m = new Mesh(unir(partes), new MeshLambertMaterial({ color }));
    m.name = nombre;
    return m;
  };
  return {
    fijas: [
      malla(
        'zocalo',
        paredes.map((p) => tira(p, 0, zocalo, GRUESO_ZOCALO)),
        acabados.zocalo,
      ),
      malla(
        'franja',
        paredes.map((p) => tira(p, zocalo, ALTO_FRANJA, GRUESO_FRANJA)),
        acabados.franja,
      ),
      malla(
        'marcos',
        [...paredes.map((p) => tira(p, 0, ALTO_RODAPIE, GRUESO_RODAPIE)), ...marcos],
        acabados.marcos,
      ),
      malla(
        'cornisa',
        paredes.map((p) => tira(p, sala.alto - ALTO_CORNISA, ALTO_CORNISA, GRUESO_CORNISA)),
        sala.colores.techo,
      ),
      malla('carcasas', carcasas, COLOR_CARCASA),
    ],
    luces: crearLuces(sala),
    oclusion: oclusionDe(sala),
  };
}
