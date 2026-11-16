/**
 * Perfil `ambientcg` (T11e): de la imagen de color de un material de ambientCG a una textura
 * KTX2 para el piso, las paredes o el techo.
 *
 * - Solo el canal de color (`<Id>_1K-JPG_Color.jpg`): las salas usan Lambert, sin mapas
 *   normales, de rugosidad ni de oclusión.
 * - Máximo 1024 px y potencia de 2, ETC1S en sRGB con mipmaps, sin alfa.
 * - La repetición (`metros` en `salas.json`) la pone el motor (T19g).
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ImageUtils } from '@gltf-transform/core';
import { argumentosKtx, comprobarKtx, TAMANO_MAXIMO, tamanoDestino } from '../modelos/ktx2.ts';

const ejecutar = promisify(execFile);

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/** `true` si el archivo es el mapa de color de un material de ambientCG. */
export const esMapaDeColor = (nombre: string): boolean => /_Color\.(jpe?g|png)$/i.test(nombre);

export interface InformeTexturaSuelta {
  antes: { ancho: number; alto: number; bytes: number };
  despues: { ancho: number; alto: number; bytes: number };
}

/** Convierte la imagen `entrada` en el KTX2 `salida`. */
export async function texturaAmbientcg(
  entrada: string,
  salida: string,
  opciones: { tamanoMaximo?: number; comando?: string } = {},
): Promise<InformeTexturaSuelta> {
  const { tamanoMaximo = TAMANO_MAXIMO, comando = 'ktx' } = opciones;
  const nombre = path.basename(entrada);
  if (!esMapaDeColor(nombre)) {
    throw new Error(`${nombre}: de ambientCG solo se usa el mapa de color (<Id>_..._Color.jpg)`);
  }
  const extension = path.extname(nombre).toLowerCase();
  const imagen = new Uint8Array(await readFile(entrada));
  const tamano = ImageUtils.getSize(imagen, MIME[extension] ?? '');
  if (!tamano) throw new Error(`No pude leer el tamaño de ${nombre}`);
  const [ancho, alto] = tamano;
  const destino = tamanoDestino(ancho, alto, tamanoMaximo);

  await comprobarKtx(comando);
  const carpeta = await mkdtemp(path.join(tmpdir(), 'lup-ambientcg-'));
  try {
    // ktx decide el formato por la extensión: se copia con un nombre simple.
    const copia = path.join(carpeta, `color${extension}`);
    await writeFile(copia, imagen);
    await mkdir(path.dirname(salida), { recursive: true });
    await ejecutar(
      comando,
      argumentosKtx({ modo: 'etc1s', srgb: true, alfa: false, ...destino, entrada: copia, salida }),
      { maxBuffer: 16 * 1024 * 1024 },
    );
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
  const bytes = (await readFile(salida)).byteLength;
  return { antes: { ancho, alto, bytes: imagen.byteLength }, despues: { ...destino, bytes } };
}
