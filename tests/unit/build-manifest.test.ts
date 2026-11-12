import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { crearIO } from '../../scripts/modelos/etapa-comun.ts';
import {
  generarManifiesto,
  nombreConHash,
  ponerHashEnNombres,
  separarHash,
  serializar,
} from '../../scripts/manifiesto/construir.ts';

/** GLB con `copias` nodos, cada uno con un triángulo (una draw call por nodo). */
async function glb(copias: number): Promise<Uint8Array> {
  const documento = new Document();
  const bufer = documento.createBuffer();
  const escena = documento.createScene();
  documento.getRoot().setDefaultScene(escena);
  const posicion = documento
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
    .setBuffer(bufer);
  const malla = documento
    .createMesh()
    .addPrimitive(documento.createPrimitive().setAttribute('POSITION', posicion));
  for (let i = 0; i < copias; i++) escena.addChild(documento.createNode().setMesh(malla));
  return (await crearIO()).writeBinary(documento);
}

let raiz: string;

async function escribir(relativo: string, datos: Uint8Array | string): Promise<void> {
  const ruta = path.join(raiz, relativo);
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, datos);
}

const listar = async (relativo: string): Promise<string[]> =>
  (await readdir(path.join(raiz, relativo))).sort();

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), 'lup-manifiesto-'));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('nombres con hash', () => {
  it('separa y arma el hash del nombre', () => {
    expect(separarHash('escena.1a2b3c4d.glb')).toEqual({
      base: 'escena',
      hash: '1a2b3c4d',
      ext: '.glb',
    });
    expect(separarHash('escena.glb')).toEqual({ base: 'escena', hash: null, ext: '.glb' });
    expect(separarHash('mesa.v2.glb')).toEqual({ base: 'mesa.v2', hash: null, ext: '.glb' });
    expect(nombreConHash('escena', 'abcdef0123456789', '.glb')).toBe('escena.abcdef01.glb');
  });
});

describe('build-manifest', () => {
  it('pone el hash en el nombre y cuenta bytes, triángulos y draw calls por sala', async () => {
    await escribir('salas/s1-cooperativa/escena.glb', await glb(3));
    await escribir('salas/s1-cooperativa/props/silla.glb', await glb(1));
    await escribir('salas/porteria/escena.glb', await glb(2));
    await escribir('audio/es-CO/s1-cooperativa/voz-01.m4a', 'audio de prueba');

    const { renombrados, eliminados } = await ponerHashEnNombres(raiz);
    expect(renombrados).toHaveLength(3);
    expect(eliminados).toEqual([]);
    expect(await listar('salas/s1-cooperativa')).toEqual([
      expect.stringMatching(/^escena\.[0-9a-f]{8}\.glb$/),
      'props',
    ]);

    const { manifiesto, problemas } = await generarManifiesto(raiz);
    expect(problemas).toEqual([]);
    expect(Object.keys(manifiesto.salas)).toEqual(['porteria', 's1-cooperativa']);

    const sala = manifiesto.salas['s1-cooperativa'];
    expect(sala?.totales).toMatchObject({ triangulos: 4, drawCalls: 4, bytesAudio: 15 });
    expect(sala?.archivos.map((a) => a.archivo)).toEqual([
      expect.stringMatching(/^salas\/s1-cooperativa\/escena\.[0-9a-f]{8}\.glb$/),
      expect.stringMatching(/^salas\/s1-cooperativa\/props\/silla\.[0-9a-f]{8}\.glb$/),
    ]);
    const bytes = sala?.archivos.reduce((suma, a) => suma + a.bytes, 0);
    expect(sala?.totales.bytes).toBe(bytes);
    expect(sala?.audio).toEqual([
      {
        archivo: 'audio/es-CO/s1-cooperativa/voz-01.m4a',
        idioma: 'es-CO',
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        bytes: 15,
      },
    ]);
    for (const a of sala?.archivos ?? []) {
      expect(a.archivo).toContain(a.sha256.slice(0, 8));
    }
  });

  it('da el mismo manifiesto si nada cambió', async () => {
    await escribir('salas/porteria/escena.glb', await glb(2));
    await ponerHashEnNombres(raiz);
    const primero = serializar((await generarManifiesto(raiz)).manifiesto);

    expect(await ponerHashEnNombres(raiz)).toEqual({ renombrados: [], eliminados: [] });
    expect(serializar((await generarManifiesto(raiz)).manifiesto)).toBe(primero);
  });

  it('reemplaza la versión anterior cuando optimize-models escribe una nueva', async () => {
    await escribir('salas/porteria/escena.glb', await glb(1));
    await ponerHashEnNombres(raiz);
    const [viejo] = await listar('salas/porteria');

    await escribir('salas/porteria/escena.glb', await glb(5));
    const { eliminados } = await ponerHashEnNombres(raiz);
    expect(eliminados).toEqual([`salas/porteria/${viejo}`]);

    const archivos = await listar('salas/porteria');
    expect(archivos).toHaveLength(1);
    expect(archivos[0]).not.toBe(viejo);
    const { manifiesto } = await generarManifiesto(raiz);
    expect(manifiesto.salas['porteria']?.totales.triangulos).toBe(5);
  });

  it('informa archivos sin hash, hash equivocado, dos versiones y audio fuera de lugar', async () => {
    await escribir('salas/porteria/escena.glb', await glb(1));
    await escribir('salas/porteria/mesa.00000000.glb', await glb(1));
    await escribir('salas/porteria/puerta.11111111.glb', await glb(1));
    await escribir('salas/porteria/puerta.22222222.glb', await glb(2));
    await escribir('audio/suelto.m4a', 'x');

    const { problemas } = await generarManifiesto(raiz);
    expect(problemas).toEqual([
      expect.stringContaining('escena.glb: falta el hash'),
      expect.stringContaining('mesa.00000000.glb: el hash del nombre no coincide'),
      expect.stringContaining('puerta.11111111.glb: el hash del nombre no coincide'),
      expect.stringContaining('puerta.22222222.glb: el hash del nombre no coincide'),
      expect.stringContaining('puerta.22222222.glb: hay dos versiones'),
      expect.stringContaining('audio/suelto.m4a: el audio va en audio/<idioma>/<sala>/'),
    ]);

    // Con dos versiones y ninguna nueva no se borra nada; el hash equivocado se corrige.
    await ponerHashEnNombres(raiz);
    const archivos = await listar('salas/porteria');
    expect(archivos.filter((a) => a.startsWith('puerta.'))).toEqual([
      'puerta.11111111.glb',
      'puerta.22222222.glb',
    ]);
    expect(archivos.some((a) => a === 'mesa.00000000.glb')).toBe(false);
  });

  it('sin salas escribe un manifiesto vacío', async () => {
    const { manifiesto, problemas } = await generarManifiesto(raiz);
    expect(problemas).toEqual([]);
    expect(serializar(manifiesto)).toBe('{\n  "version": 1,\n  "salas": {}\n}\n');
  });
});
