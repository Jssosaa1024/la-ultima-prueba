import { deflateSync } from 'node:zlib';

/**
 * Iconos de la app instalada (T95), dibujados por código: sin imágenes ni logos de nadie.
 *
 * Un cuadrado oscuro con la esfera del reloj de la portería en ámbar y una cerradura en el
 * centro. Todo cabe en el círculo central del 80 %, así que el mismo dibujo sirve como icono
 * «maskable» (Android lo recorta en círculo o en gota sin cortar nada).
 */

/** Colores del juego: fondo de la página y ámbar del título. */
export const FONDO = [0x11, 0x14, 0x18] as const;
export const AMBAR = [0xe8, 0xa3, 0x3d] as const;

/** Tamaños que se publican: iPhone (180), Android (192 y 512). */
export const TAMANOS = [180, 192, 512] as const;

/** Muestras por lado de cada píxel (4 × 4) para suavizar los bordes. */
const MUESTRAS = 4;

/** ¿El punto (x, y), en [0, 1], cae en el dibujo ámbar? */
export function enDibujo(x: number, y: number): boolean {
  const d = Math.hypot(x - 0.5, y - 0.5);
  // Esfera del reloj.
  if (d >= 0.3 && d <= 0.355) return true;
  // Cerradura: un círculo y, debajo, un trapecio que se abre hacia abajo.
  if (Math.hypot(x - 0.5, y - 0.44) <= 0.085) return true;
  if (y >= 0.44 && y <= 0.66) {
    const media = 0.03 + ((y - 0.44) / 0.22) * 0.03;
    if (Math.abs(x - 0.5) <= media) return true;
  }
  return false;
}

/** Píxeles RGB del icono de `lado` × `lado`. */
export function pixeles(lado: number): Uint8Array {
  const rgb = new Uint8Array(lado * lado * 3);
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      let dentro = 0;
      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const x = (px + (sx + 0.5) / MUESTRAS) / lado;
          const y = (py + (sy + 0.5) / MUESTRAS) / lado;
          if (enDibujo(x, y)) dentro++;
        }
      }
      const a = dentro / (MUESTRAS * MUESTRAS);
      const k = (py * lado + px) * 3;
      for (let c = 0; c < 3; c++) {
        rgb[k + c] = Math.round(FONDO[c]! * (1 - a) + AMBAR[c]! * a);
      }
    }
  }
  return rgb;
}

// ——— PNG mínimo (RGB de 8 bits, sin filtros) ———

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo: string, datos: Uint8Array): Buffer {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** Codifica píxeles RGB como PNG. El resultado es siempre el mismo para la misma entrada. */
export function png(lado: number, rgb: Uint8Array): Buffer {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  // compresión, filtro y entrelazado: 0
  const filas = Buffer.alloc(lado * (lado * 3 + 1));
  for (let y = 0; y < lado; y++) {
    filas[y * (lado * 3 + 1)] = 0;
    filas.set(rgb.subarray(y * lado * 3, (y + 1) * lado * 3), y * (lado * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(filas, { level: 9 })),
    bloque('IEND', new Uint8Array(0)),
  ]);
}

/** Nombre del archivo publicado de cada tamaño. */
export const archivoIcono = (lado: number): string => `icono-${lado}.png`;

/** El PNG de un tamaño. */
export const icono = (lado: number): Buffer => png(lado, pixeles(lado));
