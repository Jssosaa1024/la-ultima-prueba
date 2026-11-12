import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Document, ImageUtils } from '@gltf-transform/core';
import { aplicarEtapaComun, crearIO } from '../../scripts/modelos/etapa-comun.ts';
import {
  argumentosKtx,
  comprobarKtx,
  leerVersionKtx,
  modoDeTextura,
  pngTieneAlfa,
  tamanoDestino,
  versionSuficiente,
} from '../../scripts/modelos/ktx2.ts';

/** PNG mínimo sin dependencias: RGB (tipo 2) o RGBA (tipo 6), con un degradado. */
function png(ancho: number, alto: number, alfa = false): Uint8Array {
  const tablaCrc = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (datos: Buffer): number => {
    let c = ~0;
    for (const byte of datos) c = (tablaCrc[(c ^ byte) & 255] ?? 0) ^ (c >>> 8);
    return ~c >>> 0;
  };
  const bloque = (tipo: string, datos: Buffer): Buffer => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const canales = alfa ? 4 : 3;
  const filas = Buffer.alloc((ancho * canales + 1) * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const o = y * (ancho * canales + 1) + 1 + x * canales;
      filas[o] = x & 255;
      filas[o + 1] = y & 255;
      filas[o + 2] = 128;
      if (alfa) filas[o + 3] = 200;
    }
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8;
  cabecera[9] = alfa ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloque('IHDR', cabecera),
    bloque('IDAT', deflateSync(filas)),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

describe('versión de KTX-Software', () => {
  it('lee versiones estables y preliminares', () => {
    expect(leerVersionKtx('ktx version: v4.4.0')).toMatchObject({
      mayor: 4,
      menor: 4,
      parche: 0,
      preliminar: null,
    });
    expect(leerVersionKtx('ktx version: v5.0.0-rc2~3')).toMatchObject({
      mayor: 5,
      menor: 0,
      parche: 0,
      preliminar: 'rc2~3',
    });
    expect(leerVersionKtx('comando desconocido')).toBeNull();
  });

  it('exige 4.4.0 o superior', () => {
    const v = (texto: string) => {
      const version = leerVersionKtx(texto);
      if (!version) throw new Error(texto);
      return versionSuficiente(version);
    };
    expect(v('v4.3.2')).toBe(false);
    expect(v('v4.4.0-rc1')).toBe(false);
    expect(v('v4.4.0')).toBe(true);
    expect(v('v4.4.2')).toBe(true);
    expect(v('v5.0.0-rc2~3')).toBe(true);
  });
});

describe('reglas de textura', () => {
  it('limita a 1024 px y lleva cada lado a potencia de 2', () => {
    expect(tamanoDestino(2048, 2048)).toEqual({ ancho: 1024, alto: 1024 });
    expect(tamanoDestino(4096, 2048)).toEqual({ ancho: 1024, alto: 512 });
    expect(tamanoDestino(1000, 600)).toEqual({ ancho: 1024, alto: 512 });
    expect(tamanoDestino(100, 100)).toEqual({ ancho: 128, alto: 128 });
    expect(tamanoDestino(512, 256)).toEqual({ ancho: 512, alto: 256 });
    expect(tamanoDestino(4096, 4096, 2048)).toEqual({ ancho: 2048, alto: 2048 });
    expect(() => tamanoDestino(64, 64, 1000)).toThrow();
  });

  it('UASTC solo para mapas normales', () => {
    expect(modoDeTextura(['normalTexture'])).toBe('uastc');
    expect(modoDeTextura(['baseColorTexture'])).toBe('etc1s');
    expect(modoDeTextura(['occlusionTexture', 'metallicRoughnessTexture'])).toBe('etc1s');
    expect(modoDeTextura([])).toBe('etc1s');
  });

  it('detecta el canal alfa de un PNG', () => {
    expect(pngTieneAlfa(png(4, 4, true))).toBe(true);
    expect(pngTieneAlfa(png(4, 4, false))).toBe(false);
  });

  it('arma los argumentos de ktx create', () => {
    const base = { ancho: 1024, alto: 512, entrada: 'a.png', salida: 'a.ktx2' };
    expect(argumentosKtx({ ...base, modo: 'etc1s', srgb: true, alfa: false })).toEqual([
      'create',
      '--format',
      'R8G8B8_SRGB',
      '--assign-tf',
      'srgb',
      '--width',
      '1024',
      '--height',
      '512',
      '--generate-mipmap',
      '--encode',
      'basis-lz',
      '--clevel',
      '1',
      '--qlevel',
      '128',
      'a.png',
      'a.ktx2',
    ]);
    const uastc = argumentosKtx({ ...base, modo: 'uastc', srgb: false, alfa: false });
    expect(uastc.slice(0, 5)).toEqual([
      'create',
      '--format',
      'R8G8B8_UNORM',
      '--assign-tf',
      'linear',
    ]);
    expect(uastc).toEqual(expect.arrayContaining(['uastc', '--zstd', '18']));
    expect(argumentosKtx({ ...base, modo: 'etc1s', srgb: true, alfa: true })[2]).toBe(
      'R8G8B8A8_SRGB',
    );
  });
});

const hayKtx = await comprobarKtx().then(
  () => true,
  () => false,
);

describe.skipIf(!hayKtx)('KTX2 con KTX-Software instalado', () => {
  it('pasa el color a ETC1S de 1024 px y el normal a UASTC', { timeout: 60_000 }, async () => {
    const documento = new Document();
    const bufer = documento.createBuffer();
    const escena = documento.createScene('sala');
    documento.getRoot().setDefaultScene(escena);
    const color = documento
      .createTexture('color')
      .setImage(png(2048, 1024))
      .setMimeType('image/png');
    const normal = documento
      .createTexture('normal')
      .setImage(png(256, 256))
      .setMimeType('image/png');
    const material = documento
      .createMaterial('pared')
      .setBaseColorTexture(color)
      .setNormalTexture(normal);
    const posicion = documento
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]))
      .setBuffer(bufer);
    const uv = documento
      .createAccessor()
      .setType('VEC2')
      .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
      .setBuffer(bufer);
    const primitiva = documento
      .createPrimitive()
      .setAttribute('POSITION', posicion)
      .setAttribute('TEXCOORD_0', uv)
      .setMaterial(material);
    escena.addChild(
      documento.createNode('pared').setMesh(documento.createMesh('pared').addPrimitive(primitiva)),
    );

    const informe = await aplicarEtapaComun(documento);

    expect(informe.map((t) => [t.nombre, t.modo, t.despues.ancho, t.despues.alto])).toEqual([
      ['color', 'etc1s', 1024, 512],
      ['normal', 'uastc', 256, 256],
    ]);

    // Se escribe y se vuelve a leer: KHR_texture_basisu obligatoria y texturas KTX2.
    const io = await crearIO();
    const releido = await io.readBinary(await io.writeBinary(documento));
    const basisu = releido
      .getRoot()
      .listExtensionsUsed()
      .find((e) => e.extensionName === 'KHR_texture_basisu');
    expect(basisu?.isRequired()).toBe(true);

    const supercompresion = (imagen: Uint8Array): number =>
      new DataView(imagen.buffer, imagen.byteOffset, imagen.byteLength).getUint32(44, true);
    const [t1, t2] = releido.getRoot().listTextures();
    const i1 = t1?.getImage();
    const i2 = t2?.getImage();
    if (!t1 || !t2 || !i1 || !i2) throw new Error('faltan texturas');
    expect(t1.getMimeType()).toBe('image/ktx2');
    expect(ImageUtils.getSize(i1, 'image/ktx2')).toEqual([1024, 512]);
    expect(supercompresion(i1)).toBe(1); // BasisLZ = ETC1S
    expect(ImageUtils.getSize(i2, 'image/ktx2')).toEqual([256, 256]);
    expect(supercompresion(i2)).toBe(2); // Zstandard = UASTC
  });
});
