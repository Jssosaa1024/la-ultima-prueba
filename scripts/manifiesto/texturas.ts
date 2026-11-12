/**
 * Medida de texturas para el manifiesto (T09): tamaño, formato y memoria en GPU.
 *
 * La memoria sigue la fórmula del panel de métricas de la especificación:
 * ancho × alto × bytes por píxel × 1,33 (mipmaps).
 * - ETC1S se transcodifica a ETC2: 0,5 B sin alfa (RGB) y 1 B con alfa (RGBA).
 * - UASTC se transcodifica a ASTC 4×4: 1 B.
 * - Una imagen sin comprimir (PNG, JPEG, WebP) ocupa 4 B por píxel.
 */
import { ImageUtils } from '@gltf-transform/core';
import type { Document } from '@gltf-transform/core';

export type FormatoTextura = 'etc1s' | 'uastc' | 'sin-comprimir';

export interface TexturaMedida {
  nombre: string;
  ancho: number;
  alto: number;
  formato: FormatoTextura;
  alfa: boolean;
  bytesGpu: number;
}

const MODELO_ETC1S = 163; // KHR_DF_MODEL_ETC1S
const MODELO_UASTC = 166; // KHR_DF_MODEL_UASTC
const CANAL_UASTC_RGB = 0;
const CANAL_UASTC_RRR = 4;
const FACTOR_MIPMAPS = 1.33;

const IDENTIFICADOR_KTX2 = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

/** Lee tamaño, formato y alfa de la cabecera de un KTX2. `null` si no es KTX2. */
export function leerKtx2(
  datos: Uint8Array,
): { ancho: number; alto: number; formato: FormatoTextura; alfa: boolean } | null {
  if (datos.byteLength < 80 || IDENTIFICADOR_KTX2.some((b, i) => datos[i] !== b)) return null;
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const vkFormat = vista.getUint32(12, true);
  const ancho = vista.getUint32(20, true);
  const alto = Math.max(1, vista.getUint32(24, true));
  const inicioDfd = vista.getUint32(48, true);

  // Bloque básico del DFD: después del tamaño total (4 B) y de 8 B de cabecera viene el modelo.
  // Cada muestra ocupa 16 B desde el byte 24 del bloque; su canal está en el 4.º byte.
  if (vkFormat !== 0 || inicioDfd + 28 > datos.byteLength) {
    return { ancho, alto, formato: 'sin-comprimir', alfa: true };
  }
  const bloque = inicioDfd + 4;
  const modelo = datos[bloque + 8];
  const muestras = Math.max(0, (vista.getUint16(bloque + 6, true) - 24) / 16);
  const canal = (i: number): number => (datos[bloque + 24 + 16 * i + 3] ?? 0) & 0x0f;

  if (modelo === MODELO_ETC1S) {
    // ETC1S con alfa trae dos muestras: RGB y AAA.
    return { ancho, alto, formato: 'etc1s', alfa: muestras > 1 };
  }
  if (modelo === MODELO_UASTC) {
    const c = canal(0);
    return { ancho, alto, formato: 'uastc', alfa: c !== CANAL_UASTC_RGB && c !== CANAL_UASTC_RRR };
  }
  return { ancho, alto, formato: 'sin-comprimir', alfa: true };
}

/** Bytes de una textura en GPU, con mipmaps. */
export function bytesGpu(
  ancho: number,
  alto: number,
  formato: FormatoTextura,
  alfa: boolean,
): number {
  const porPixel = formato === 'sin-comprimir' ? 4 : formato === 'uastc' || alfa ? 1 : 0.5;
  return Math.round(ancho * alto * porPixel * FACTOR_MIPMAPS);
}

/** Mide una imagen suelta (por ejemplo, un .ktx2 de la rectoría). */
export function medirImagen(nombre: string, datos: Uint8Array, mime: string): TexturaMedida | null {
  const ktx2 = leerKtx2(datos);
  if (ktx2) {
    return { nombre, ...ktx2, bytesGpu: bytesGpu(ktx2.ancho, ktx2.alto, ktx2.formato, ktx2.alfa) };
  }
  const tamano = ImageUtils.getSize(datos, mime);
  if (!tamano) return null;
  const [ancho, alto] = tamano;
  return {
    nombre,
    ancho,
    alto,
    formato: 'sin-comprimir',
    alfa: true,
    bytesGpu: bytesGpu(ancho, alto, 'sin-comprimir', true),
  };
}

/** Mide todas las texturas de un modelo. */
export function medirTexturas(documento: Document): TexturaMedida[] {
  const medidas: TexturaMedida[] = [];
  for (const [i, textura] of documento.getRoot().listTextures().entries()) {
    const imagen = textura.getImage();
    if (!imagen) continue;
    const nombre = textura.getName() || textura.getURI() || `textura-${i}`;
    const medida = medirImagen(nombre, imagen, textura.getMimeType());
    if (medida) medidas.push(medida);
  }
  return medidas;
}
