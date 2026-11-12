/** Codificador PNG mínimo (RGB, 8 bits) para generar texturas de prueba sin dependencias. */
import { deflateSync } from 'node:zlib';

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc(datos: Buffer): number {
  let c = ~0;
  for (const byte of datos) c = (TABLA_CRC[(c ^ byte) & 255] ?? 0) ^ (c >>> 8);
  return ~c >>> 0;
}

function bloque(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
}

/** Crea un PNG RGB a partir de una función que da el color de cada píxel. */
export function crearPng(
  ancho: number,
  alto: number,
  color: (x: number, y: number) => readonly [number, number, number],
): Uint8Array {
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = color(x, y);
      const o = y * (ancho * 3 + 1) + 1 + x * 3;
      filas[o] = r;
      filas[o + 1] = g;
      filas[o + 2] = b;
    }
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(filas)),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}
