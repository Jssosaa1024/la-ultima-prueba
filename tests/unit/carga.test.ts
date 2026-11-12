import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { liberarObjeto } from '../../src/engine/carga/liberar';
import { crearIO, medir } from '../../scripts/modelos/etapa-comun.ts';

describe('liberarObjeto', () => {
  it('libera geometrías, materiales y texturas una sola vez y saca el objeto de la escena', () => {
    const escena = new Group();
    const raiz = new Group();
    escena.add(raiz);

    const geometria = new BoxGeometry();
    const mapa = new Texture();
    const normal = new Texture();
    const material = new MeshStandardMaterial({ map: mapa, normalMap: normal });
    // Dos mallas que comparten geometría y material, como hace GLTFLoader con las instancias.
    raiz.add(new Mesh(geometria, material), new Mesh(geometria, material));
    raiz.add(new Mesh(new BoxGeometry(), [new MeshStandardMaterial(), material]));

    const liberados: string[] = [];
    geometria.addEventListener('dispose', () => liberados.push('geometria'));
    material.addEventListener('dispose', () => liberados.push('material'));
    mapa.addEventListener('dispose', () => liberados.push('mapa'));
    normal.addEventListener('dispose', () => liberados.push('normal'));

    expect(liberarObjeto(raiz)).toEqual({ geometrias: 2, materiales: 2, texturas: 2 });
    expect(liberados.sort()).toEqual(['geometria', 'mapa', 'material', 'normal']);
    expect(raiz.parent).toBeNull();
    expect(escena.children).toHaveLength(0);
  });
});

describe('modelo de prueba', () => {
  it('usa meshopt y KTX2 y es pequeño', async () => {
    const archivo = path.join('public', 'assets', 'pruebas', 'cubo.glb');
    const datos = new Uint8Array(await readFile(archivo));
    expect(datos.byteLength).toBeLessThan(20_000);

    const documento = await (await crearIO()).readBinary(datos);
    const requeridas = documento
      .getRoot()
      .listExtensionsUsed()
      .filter((e) => e.isRequired())
      .map((e) => e.extensionName);
    expect(requeridas).toEqual(
      expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']),
    );
    expect(
      documento
        .getRoot()
        .listTextures()
        .map((t) => t.getMimeType()),
    ).toEqual(['image/ktx2', 'image/ktx2']);
    expect(medir(documento)).toMatchObject({ triangulos: 12, drawCalls: 1 });
  });
});
