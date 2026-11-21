/**
 * Codificador PNG mínimo (RGB, 8 bits) para generar texturas de prueba sin dependencias, y un
 * lector igual de mínimo (T83c) para mirar los colores de una paleta.
 */
import { deflateSync, inflateSync } from 'node:zlib';

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

/** Una imagen RGBA de 8 bits por canal. */
export interface ImagenRgba {
  ancho: number;
  alto: number;
  /** ancho × alto × 4 bytes, fila por fila desde arriba. */
  datos: Uint8Array;
}

/** Bytes por píxel de cada tipo de color PNG de 8 bits (gris, RGB, gris+alfa, RGBA). */
const CANALES: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * Lee un PNG de 8 bits por canal, sin entrelazar (gris, RGB o RGBA, con o sin alfa), y lo
 * devuelve en RGBA. Basta para las paletas de los paquetes; con otro PNG falla con un mensaje.
 */
export function leerPng(archivo: Uint8Array): ImagenRgba {
  const b = Buffer.from(archivo);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('No es un PNG');
  let o = 8;
  let ancho = 0;
  let alto = 0;
  let canales = 0;
  const idat: Buffer[] = [];
  while (o < b.length) {
    const largo = b.readUInt32BE(o);
    const tipo = b.toString('latin1', o + 4, o + 8);
    const datos = b.subarray(o + 8, o + 8 + largo);
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      const bits = datos[8];
      canales = CANALES[datos[9] ?? -1] ?? 0;
      if (bits !== 8 || canales === 0 || datos[12] !== 0) {
        throw new Error('Solo PNG de 8 bits por canal, sin paleta ni entrelazado');
      }
    } else if (tipo === 'IDAT') idat.push(datos);
    else if (tipo === 'IEND') break;
    o += 12 + largo;
  }
  const crudo = inflateSync(Buffer.concat(idat));
  const fila = ancho * canales;
  const plano = new Uint8Array(fila * alto);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (fila + 1)] ?? 0;
    for (let x = 0; x < fila; x++) {
      const valor = crudo[y * (fila + 1) + 1 + x] ?? 0;
      const a = x >= canales ? (plano[y * fila + x - canales] ?? 0) : 0;
      const c = y > 0 ? (plano[(y - 1) * fila + x] ?? 0) : 0;
      const d = x >= canales && y > 0 ? (plano[(y - 1) * fila + x - canales] ?? 0) : 0;
      let prediccion = 0;
      if (filtro === 1) prediccion = a;
      else if (filtro === 2) prediccion = c;
      else if (filtro === 3) prediccion = (a + c) >> 1;
      else if (filtro === 4) {
        const p = a + c - d;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - c);
        const pc = Math.abs(p - d);
        prediccion = pa <= pb && pa <= pc ? a : pb <= pc ? c : d;
      }
      plano[y * fila + x] = (valor + prediccion) & 255;
    }
  }
  const datos = new Uint8Array(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    const p = plano.subarray(i * canales, (i + 1) * canales);
    const gris = canales <= 2;
    datos[i * 4] = p[0] ?? 0;
    datos[i * 4 + 1] = (gris ? p[0] : p[1]) ?? 0;
    datos[i * 4 + 2] = (gris ? p[0] : p[2]) ?? 0;
    datos[i * 4 + 3] = canales === 4 ? (p[3] ?? 255) : canales === 2 ? (p[1] ?? 255) : 255;
  }
  return { ancho, alto, datos };
}
