import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { crearIO } from '../../scripts/modelos/etapa-comun.ts';
import { generarManifiesto, ponerHashEnNombres } from '../../scripts/manifiesto/construir.ts';
import type { Manifiesto, Sala } from '../../scripts/manifiesto/construir.ts';
import { bytesGpu, leerKtx2 } from '../../scripts/manifiesto/texturas.ts';
import { LIMITES, evaluarPresupuesto } from '../../scripts/presupuesto/evaluar.ts';

/** KTX2 reales de 64×64 creados con `ktx create` (KTX-Software). */
const fixture = async (nombre: string): Promise<Uint8Array> =>
  new Uint8Array(await readFile(path.join(import.meta.dirname, 'fixtures', nombre)));

describe('texturas KTX2', () => {
  it('lee tamaño, formato y alfa de la cabecera', async () => {
    expect(leerKtx2(await fixture('etc1s-rgb-64.ktx2'))).toEqual({
      ancho: 64,
      alto: 64,
      formato: 'etc1s',
      alfa: false,
    });
    expect(leerKtx2(await fixture('etc1s-rgba-64.ktx2'))).toMatchObject({
      formato: 'etc1s',
      alfa: true,
    });
    expect(leerKtx2(await fixture('uastc-rgb-64.ktx2'))).toMatchObject({
      formato: 'uastc',
      alfa: false,
    });
    expect(leerKtx2(new Uint8Array(100))).toBeNull();
  });

  it('calcula la memoria en GPU con mipmaps', () => {
    // 1024² × 0,5 B × 1,33 en ETC2 RGB; × 1 B en ETC2 RGBA y ASTC 4×4; × 4 B sin comprimir.
    expect(bytesGpu(1024, 1024, 'etc1s', false)).toBe(697_303);
    expect(bytesGpu(1024, 1024, 'etc1s', true)).toBe(1_394_606);
    expect(bytesGpu(1024, 1024, 'uastc', false)).toBe(1_394_606);
    expect(bytesGpu(1024, 1024, 'sin-comprimir', true)).toBe(5_578_424);
  });
});

/** Sala de prueba con totales dados. */
function sala(totales: Partial<Sala['totales']>, archivos: Sala['archivos'] = []): Sala {
  return {
    archivos,
    audio: [],
    totales: { bytes: 0, bytesAudio: 0, triangulos: 0, drawCalls: 0, bytesGpu: 0, ...totales },
  };
}

describe('evaluarPresupuesto', () => {
  it('acepta una sala justo en el límite', () => {
    const manifiesto: Manifiesto = {
      version: 1,
      salas: {
        porteria: sala({
          triangulos: 90_000,
          drawCalls: 40,
          bytes: 2_000_000,
          bytesAudio: 600_000,
          bytesGpu: 16_000_000,
        }),
      },
    };
    const { filas, excesos } = evaluarPresupuesto(manifiesto);
    expect(excesos).toEqual([]);
    expect(filas).toHaveLength(5);
    expect(filas.every((f) => f.ok)).toBe(true);
  });

  it('rechaza cada métrica que se pasa, por sala', () => {
    const manifiesto: Manifiesto = {
      version: 1,
      salas: {
        porteria: sala({ triangulos: 1000 }),
        's3-gimnasio': sala({
          triangulos: 90_001,
          drawCalls: 41,
          bytes: 2_500_000,
          bytesAudio: 600_001,
          bytesGpu: 16_000_001,
        }),
      },
    };
    const { excesos } = evaluarPresupuesto(manifiesto);
    expect(excesos).toEqual([
      's3-gimnasio: triángulos 90.001 > 90.000 (sobran 1)',
      's3-gimnasio: draw calls 41 > 40 (sobran 1)',
      's3-gimnasio: descarga 2,50 MB > 2,00 MB (sobran 0,50 MB)',
      's3-gimnasio: audio 0,60 MB > 0,60 MB (sobran 1 B)',
      's3-gimnasio: texturas en GPU 16,00 MB > 16,00 MB (sobran 1 B)',
    ]);
  });

  it('rechaza texturas de más de 1024 px', () => {
    const textura = (ancho: number, alto: number) => ({
      nombre: 'lightmap',
      ancho,
      alto,
      formato: 'etc1s' as const,
      alfa: false,
      bytesGpu: bytesGpu(ancho, alto, 'etc1s', false),
    });
    const manifiesto: Manifiesto = {
      version: 1,
      salas: {
        porteria: sala({}, [
          {
            archivo: 'salas/porteria/escena.12345678.glb',
            sha256: '12345678',
            bytes: 1,
            texturas: [textura(1024, 1024), textura(2048, 1024)],
          },
        ]),
      },
    };
    expect(evaluarPresupuesto(manifiesto).excesos).toEqual([
      'porteria: la textura "lightmap" de salas/porteria/escena.12345678.glb mide 2048×1024; el máximo es 1024×1024',
    ]);
    expect(LIMITES.ladoTextura).toBe(1024);
  });
});

describe('manifiesto con texturas', () => {
  let raiz: string;
  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'lup-presupuesto-'));
  });
  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('mide las texturas de cada modelo y suma la memoria en GPU de la sala', async () => {
    const documento = new Document();
    documento.createBuffer();
    const color = documento
      .createTexture('color')
      .setImage(await fixture('etc1s-rgb-64.ktx2'))
      .setMimeType('image/ktx2');
    const normal = documento
      .createTexture('normal')
      .setImage(await fixture('uastc-rgb-64.ktx2'))
      .setMimeType('image/ktx2');
    documento.createMaterial('pared').setBaseColorTexture(color).setNormalTexture(normal);
    const glb = await (await crearIO()).writeBinary(documento);

    await mkdir(path.join(raiz, 'salas', 'porteria'), { recursive: true });
    await writeFile(path.join(raiz, 'salas', 'porteria', 'escena.glb'), glb);
    await writeFile(
      path.join(raiz, 'salas', 'porteria', 'cartel.ktx2'),
      await fixture('etc1s-rgba-64.ktx2'),
    );
    await ponerHashEnNombres(raiz);

    const { manifiesto, problemas } = await generarManifiesto(raiz);
    expect(problemas).toEqual([]);
    const porteria = manifiesto.salas['porteria'];
    const texturas = porteria?.archivos.flatMap((a) => a.texturas ?? []);
    expect(texturas?.map((t) => [t.nombre, t.formato, t.alfa])).toEqual([
      ['cartel', 'etc1s', true],
      ['color', 'etc1s', false],
      ['normal', 'uastc', false],
    ]);
    const esperado =
      bytesGpu(64, 64, 'etc1s', true) +
      bytesGpu(64, 64, 'etc1s', false) +
      bytesGpu(64, 64, 'uastc', false);
    expect(porteria?.totales.bytesGpu).toBe(esperado);
    expect(evaluarPresupuesto(manifiesto).excesos).toEqual([]);
  });
});
