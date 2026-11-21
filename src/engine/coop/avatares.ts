/**
 * Colores, alias y etiquetas de los demás jugadores (T83). Desde T83c el cuerpo es un
 * personaje animado (`personajes.ts`); aquí queda el alias encima de la cabeza. Las tres
 * etiquetas son una sola malla mirando a la cámara: 1 draw call en total.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import type { Alias, Color as ColorJugador } from '../../signals/coop';

/** Hasta 4 jugadores: los otros 3 se dibujan. */
export const MAX_COMPANEROS = 3;

/** Colores de los avatares: los mismos de la interfaz (`ui/coop/nombres.ts`). */
export const HEX_COLOR: Readonly<Record<ColorJugador, number>> = {
  ambar: 0xe8a33d,
  turquesa: 0x3ec1c9,
  violeta: 0xa98bf0,
  coral: 0xf2836b,
};

/**
 * Cómo se escribe cada alias: lo mismo que `NOMBRE_ALIAS` de `ui/coop/nombres.ts` (el motor no
 * importa de la interfaz; un test comprueba que no se separen).
 */
export const NOMBRE_ALIAS: Readonly<Record<Alias, string>> = {
  zorro: 'Zorro',
  buho: 'Búho',
  colibri: 'Colibrí',
  tortuga: 'Tortuga',
  jaguar: 'Jaguar',
  condor: 'Cóndor',
  delfin: 'Delfín',
  oso: 'Oso',
  rana: 'Rana',
  tucan: 'Tucán',
  ardilla: 'Ardilla',
  mono: 'Mono',
};

/**
 * Altura de la etiqueta sobre el piso, en metros (encima de la cabeza) con el personaje de
 * prueba. Cada modelo da la suya (`ModeloPersonajes.alturaEtiqueta`).
 */
export const ALTURA_ETIQUETA = 1.92;
/** Medidas de cada etiqueta en la escena, en metros (las del `Sprite` de T83). */
export const ANCHO_ETIQUETA = 0.64;
export const ALTO_ETIQUETA = 0.16;
const ANCHO_LIENZO = 256;
/** Alto de cada fila del lienzo: una por compañero. */
const ALTO_FILA = 64;

/** Lo mínimo de un `<canvas>` para dibujar la etiqueta (en las pruebas, uno falso). */
export interface Lienzo {
  width: number;
  height: number;
  getContext(tipo: '2d'): CanvasRenderingContext2D | null;
}

const lienzoDelNavegador = (): Lienzo => document.createElement('canvas');

/**
 * Dibuja el alias en la fila `fila` del lienzo: fondo oscuro, borde del color del jugador y
 * texto claro.
 */
function dibujarEtiqueta(lienzo: Lienzo, fila: number, texto: string, color: ColorJugador): void {
  const c = lienzo.getContext('2d');
  if (!c) return;
  const y = fila * ALTO_FILA;
  c.clearRect(0, y, ANCHO_LIENZO, ALTO_FILA);
  c.fillStyle = 'rgba(0, 0, 0, 0.62)';
  c.strokeStyle = `#${HEX_COLOR[color].toString(16).padStart(6, '0')}`;
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(4, y + 4, ANCHO_LIENZO - 8, ALTO_FILA - 8, 24);
  c.fill();
  c.stroke();
  c.fillStyle = '#f2f2f2';
  c.font = 'bold 34px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  // Solo texto de una lista cerrada (`NOMBRE_ALIAS`), dibujado en un canvas: nada de HTML.
  c.fillText(texto, ANCHO_LIENZO / 2, y + ALTO_FILA / 2 + 2);
}

export interface Etiquetas {
  /**
   * Las tres etiquetas en una sola malla (T83c): una draw call en lugar de un `Sprite` por
   * compañero. Va a la escena.
   */
  readonly malla: Mesh;
  /**
   * Pone la etiqueta `i` a `altura` metros sobre (x, y, z), con el color y el alias del
   * jugador.
   */
  poner(
    i: number,
    x: number,
    y: number,
    z: number,
    color: ColorJugador,
    alias: Alias,
    altura?: number,
  ): void;
  /** Cuántas se ven (las primeras `n`). */
  mostrar(n: number): void;
  /** Gira las etiquetas hacia la cámara (como un `Sprite`). Cada cuadro, antes de dibujar. */
  orientar(camara: Camera): void;
  /** Centro de la etiqueta `i`, o `null` si no se ve. */
  centro(i: number): Vector3 | null;
  liberar(): void;
}

export function crearEtiquetas(crearLienzo: () => Lienzo = lienzoDelNavegador): Etiquetas {
  const lienzo = crearLienzo();
  lienzo.width = ANCHO_LIENZO;
  lienzo.height = ALTO_FILA * MAX_COMPANEROS;
  const textura = new CanvasTexture(lienzo as HTMLCanvasElement);
  textura.colorSpace = SRGBColorSpace;
  // Un rectángulo por etiqueta; cada uno toma su fila del lienzo (la fila 0 arriba).
  const posiciones = new Float32Array(MAX_COMPANEROS * 4 * 3);
  const uv = new Float32Array(MAX_COMPANEROS * 4 * 2);
  const indices: number[] = [];
  for (let i = 0; i < MAX_COMPANEROS; i++) {
    const arriba = 1 - i / MAX_COMPANEROS;
    const abajo = 1 - (i + 1) / MAX_COMPANEROS;
    uv.set([0, abajo, 1, abajo, 1, arriba, 0, arriba], i * 8);
    const v = i * 4;
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  const geometria = new BufferGeometry();
  const atributo = new BufferAttribute(posiciones, 3);
  atributo.setUsage(DynamicDrawUsage);
  geometria.setAttribute('position', atributo);
  geometria.setAttribute('uv', new BufferAttribute(uv, 2));
  geometria.setIndex(indices);
  const material = new MeshBasicMaterial({
    map: textura,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const malla = new Mesh(geometria, material);
  malla.name = 'alias';
  // Se mueven por toda la sala y cambian cada cuadro: no vale una esfera fija.
  malla.frustumCulled = false;
  malla.visible = false;

  const centros = Array.from({ length: MAX_COMPANEROS }, () => new Vector3());
  const dibujado: string[] = Array.from({ length: MAX_COMPANEROS }, () => '');
  let visibles = 0;
  const derecha = new Vector3();
  const arriba = new Vector3();

  return {
    malla,
    poner(i, x, y, z, c, alias, altura = ALTURA_ETIQUETA) {
      const centro = centros[i];
      if (!centro) return;
      centro.set(x, y + altura, z);
      const clave = `${alias}:${c}`;
      if (dibujado[i] !== clave) {
        dibujado[i] = clave;
        dibujarEtiqueta(lienzo, i, NOMBRE_ALIAS[alias], c);
        textura.needsUpdate = true;
      }
    },
    mostrar(n) {
      visibles = Math.max(0, Math.min(MAX_COMPANEROS, n));
      malla.visible = visibles > 0;
    },
    orientar(camara) {
      if (visibles === 0) return;
      // Los ejes de la cámara: así la etiqueta queda de frente, como un `Sprite`.
      derecha.setFromMatrixColumn(camara.matrixWorld, 0).multiplyScalar(ANCHO_ETIQUETA / 2);
      arriba.setFromMatrixColumn(camara.matrixWorld, 1).multiplyScalar(ALTO_ETIQUETA / 2);
      for (let i = 0; i < MAX_COMPANEROS; i++) {
        const c = centros[i];
        if (!c) continue;
        // Las que no se ven quedan en un punto: no dibujan nada.
        const k = i < visibles ? 1 : 0;
        for (let v = 0; v < 4; v++) {
          const sx = (v === 1 || v === 2 ? 1 : -1) * k;
          const sy = (v >= 2 ? 1 : -1) * k;
          const j = (i * 4 + v) * 3;
          posiciones[j] = c.x + derecha.x * sx + arriba.x * sy;
          posiciones[j + 1] = c.y + derecha.y * sx + arriba.y * sy;
          posiciones[j + 2] = c.z + derecha.z * sx + arriba.z * sy;
        }
      }
      atributo.needsUpdate = true;
    },
    centro(i) {
      return i < visibles ? (centros[i] ?? null) : null;
    },
    liberar() {
      malla.removeFromParent();
      geometria.dispose();
      material.dispose();
      textura.dispose();
    },
  };
}
