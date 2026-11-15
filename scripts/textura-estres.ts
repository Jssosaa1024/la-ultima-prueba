/**
 * textura-estres (T11q): genera public/assets/pruebas/estres-1024.ktx2 para el eje de texturas
 * de la prueba de estrés (`?debug=1`).
 *
 *   npm run textura-estres
 *
 * Una textura propia de 1024 × 1024 (sin licencia de terceros) en KTX2 ETC1S con mipmaps, como
 * las de las salas. Cada escalón del eje la carga 4 veces: cada carga es una textura distinta
 * en la GPU. Necesita KTX-Software, igual que optimize-models.
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { argumentosKtx, comprobarKtx } from './modelos/ktx2.ts';
import { crearPng } from './modelos/png.ts';

const ejecutar = promisify(execFile);
export const DESTINO = path.join('public', 'assets', 'pruebas', 'estres-1024.ktx2');
const LADO = 1024;

async function principal(): Promise<number> {
  await comprobarKtx();
  // Franjas de colores con un poco de ruido: que ETC1S tenga algo que comprimir.
  const png = crearPng(LADO, LADO, (x, y) => {
    const r = (x * 7 + y * 3) & 255;
    const g = ((x ^ y) * 5) & 255;
    const b = (y >> 2) & 255;
    return [r, g, b];
  });
  const carpeta = await mkdtemp(path.join(tmpdir(), 'textura-estres-'));
  try {
    const entrada = path.join(carpeta, 'estres.png');
    await writeFile(entrada, png);
    await mkdir(path.dirname(DESTINO), { recursive: true });
    await ejecutar(
      'ktx',
      argumentosKtx({
        modo: 'etc1s',
        srgb: true,
        alfa: false,
        ancho: LADO,
        alto: LADO,
        entrada,
        salida: DESTINO,
      }),
    );
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
  console.log(`Escrito ${DESTINO}`);
  return 0;
}

process.exitCode = await principal();
