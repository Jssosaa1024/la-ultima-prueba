/**
 * iconos-pwa (T95): dibuja los iconos de la app instalada y los escribe en `public/iconos/`.
 *
 *   npm run iconos-pwa
 *
 * Los PNG se suben al repositorio; un test falla si no coinciden con lo que dibuja
 * `scripts/pwa/iconos.ts`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { archivoIcono, icono, TAMANOS } from './pwa/iconos.ts';

const CARPETA = path.join('public', 'iconos');

await mkdir(CARPETA, { recursive: true });
for (const lado of TAMANOS) {
  const destino = path.join(CARPETA, archivoIcono(lado));
  const datos = icono(lado);
  await writeFile(destino, datos);
  console.log(`${destino}: ${datos.length} bytes`);
}
