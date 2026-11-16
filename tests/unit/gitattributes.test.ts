import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Ola 6 · Git LFS para art/: los paquetes, modelos, imágenes y audio originales van por LFS;
// lo publicado (public/) y los textos de art/ no.

const raiz = path.join(import.meta.dirname, '..', '..');

/** Valor del atributo `filter` de cada ruta según `.gitattributes` (no hace falta que exista). */
function filtros(rutas: string[]): Record<string, string> {
  const salida = execFileSync('git', ['check-attr', 'filter', '--', ...rutas], {
    cwd: raiz,
    encoding: 'utf8',
  });
  return Object.fromEntries(
    salida
      .trim()
      .split('\n')
      .map((linea) => {
        const [ruta = '', , valor = ''] = linea.split(': ');
        return [ruta, valor.trim()];
      }),
  );
}

describe('.gitattributes (Git LFS para art/)', () => {
  it('manda por LFS los zips, modelos, imágenes y audio de art/, en mayúsculas o minúsculas', () => {
    const rutas = [
      'art/s1-cooperativa/originales/kenney_furniture-kit.zip',
      'art/s4-biblioteca/originales/Paquete.ZIP',
      'art/s2-laboratorio/originales/Models/GLB format/desk.glb',
      'art/s3-gimnasio/originales/modelo.gltf',
      'art/s3-gimnasio/originales/modelo.bin',
      'art/porteria/originales/silla.FBX',
      'art/porteria/originales/silla.obj',
      'art/evidencia/kenney-furniture-kit.png',
      'art/s4-biblioteca/originales/WoodFloor071_1K-JPG_Color.jpg',
      'art/s5-rectoria/originales/cartel.webp',
      'art/audio/voz.wav',
    ];
    for (const [ruta, filtro] of Object.entries(filtros(rutas))) expect(filtro, ruta).toBe('lfs');
  });

  it('deja fuera de LFS los textos de art/ y todo lo que se publica', () => {
    const rutas = [
      'art/credits.json',
      'art/evidencia/LEEME.md',
      'public/assets/pruebas/cubo.glb',
      'public/assets/pruebas/estres-1024.ktx2',
      'public/iconos/icono-192.png',
    ];
    for (const [ruta, filtro] of Object.entries(filtros(rutas))) {
      expect(filtro, ruta).toBe('unspecified');
    }
  });
});
