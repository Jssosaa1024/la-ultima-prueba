import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Document, getBounds } from '@gltf-transform/core';
import type { Node } from '@gltf-transform/core';
import { zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import type { Credito } from '../../scripts/creditos/esquema.ts';
import { planear } from '../../scripts/modelos/armar.ts';
import {
  carpetaDe,
  esModelo,
  esquemaLista,
  leerLista,
  partirOriginal,
} from '../../scripts/modelos/lista.ts';
import type { EntradaLista } from '../../scripts/modelos/lista.ts';
import { ExtractorOriginales } from '../../scripts/modelos/zip.ts';
import { esMapaDeColor, texturaAmbientcg } from '../../scripts/perfiles/ambientcg.ts';
import { perfilDe } from '../../scripts/perfiles/index.ts';
import {
  aplicarPerfilKenney,
  escalaDe,
  ESCALA_PAQUETE,
  paqueteDe,
} from '../../scripts/perfiles/kenney.ts';

const FURNITURE = 'art/compartido/originales/kenney-furniture-kit/kenney_furniture-kit.zip';
const MINI_SHOP = 'art/compartido/originales/kenney-mini-shop/kenney_mini-shop_2.1.zip';

describe('art/modelos.json (T11a)', () => {
  const escritorio = {
    archivo: 'public/assets/salas/porteria/escritorio.glb',
    piezas: [{ original: `${FURNITURE}#Models/GLTF format/desk.glb` }],
  };
  const piso = {
    archivo: 'public/assets/salas/compartido/piso-baldosa.ktx2',
    original: 'art/compartido/originales/ambientcg/Tiles040_1K-JPG.zip#Tiles040_1K-JPG_Color.jpg',
  };

  it('acepta modelos con piezas, giro y estirar, y texturas', () => {
    const lista = [
      escritorio,
      {
        archivo: 'public/assets/salas/s1-cooperativa/mostrador.glb',
        piezas: [
          { original: `${FURNITURE}#Models/GLTF format/kitchenBar.glb` },
          { original: `${FURNITURE}#Models/GLTF format/kitchenBar.glb`, pos: [0.43, 0, 0] },
          { original: `${FURNITURE}#Models/GLTF format/kitchenBarEnd.glb`, giro: 180 },
        ],
        giro: 90,
        estirar: [1, 1.2, 1.5],
        nota: 'dos tramos y un remate',
      },
      piso,
    ];
    const r = esquemaLista.safeParse(lista);
    expect(r.success).toBe(true);
    expect(r.data?.map(esModelo)).toEqual([true, true, false]);
  });

  it('rechaza destinos fuera de public/assets/salas, con hash o en mayúsculas', () => {
    for (const archivo of [
      'public/assets/salas/porteria/Escritorio.glb',
      'public/assets/salas/porteria/escritorio.1a2b3c4d.glb',
      'public/assets/pruebas/escritorio.glb',
      'public/assets/salas/s9-sotano/escritorio.glb',
      'public/assets/salas/porteria/escritorio.gltf',
      'public/assets/salas/porteria/../escritorio.glb',
    ]) {
      expect(esquemaLista.safeParse([{ ...escritorio, archivo }]).success, archivo).toBe(false);
    }
    // Un .glb no puede ser una textura ni un .ktx2 un modelo.
    expect(esquemaLista.safeParse([{ ...piso, archivo: escritorio.archivo }]).success).toBe(false);
  });

  it('rechaza originales fuera de art/ o con «..»', () => {
    for (const original of [
      'public/x.glb',
      '/art/x.glb',
      'art/../secreto.zip#a.glb',
      'art/x.zip#../../fuera.glb',
      'art\\x.glb',
      'art/x.zip#a.glb#b.glb',
    ]) {
      const r = esquemaLista.safeParse([{ ...escritorio, piezas: [{ original }] }]);
      expect(r.success, original).toBe(false);
    }
  });

  it('rechaza un archivo repetido y una lista de piezas vacía', () => {
    expect(esquemaLista.safeParse([escritorio, escritorio]).success).toBe(false);
    expect(esquemaLista.safeParse([{ ...escritorio, piezas: [] }]).success).toBe(false);
    expect(esquemaLista.safeParse([{ ...escritorio, estirar: [1, 0, 1] }]).success).toBe(false);
    expect(esquemaLista.safeParse([{ ...escritorio, caja: [1.2, 0.75, null] }]).success).toBe(true);
    expect(
      esquemaLista.safeParse([{ ...escritorio, caja: [1, 1, 1], estirar: [1, 1, 1] }]).success,
    ).toBe(false);
  });

  it('parte el original en zip y ruta interna, y saca la carpeta del destino', () => {
    expect(partirOriginal(`${FURNITURE}#Models/GLTF format/desk.glb`)).toEqual({
      archivo: FURNITURE,
      interna: 'Models/GLTF format/desk.glb',
    });
    expect(partirOriginal('art/s1/limpio.glb')).toEqual({
      archivo: 'art/s1/limpio.glb',
      interna: null,
    });
    expect(carpetaDe(escritorio.archivo)).toBe('porteria');
    expect(carpetaDe(piso.archivo)).toBe('compartido');
  });

  it('el art/modelos.json del repositorio cumple el esquema', async () => {
    await expect(leerLista()).resolves.toBeInstanceOf(Array);
  });
});

describe('perfiles por fuente (T11a)', () => {
  const credito = (archivo: string, fuente: Credito['fuente']): Credito => ({
    archivo,
    sala: 'porteria',
    tipo: archivo.endsWith('.glb') ? 'modelo' : 'textura',
    titulo: 'x',
    autor: 'Kenney',
    fuente,
    url: 'https://kenney.nl/',
    licencia: 'CC0-1.0',
    licencia_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    cambios: null,
    fecha: '2026-11-16',
    plan: null,
    evidencia: null,
  });
  const modelo = (archivo: string): EntradaLista => ({
    archivo,
    piezas: [{ original: `${FURNITURE}#Models/GLTF format/desk.glb` }],
  });
  const textura = (archivo: string): EntradaLista => ({
    archivo,
    original: 'art/x.zip#a_Color.jpg',
  });

  it('kenney arma modelos, ambientcg texturas y las demás fuentes no tienen perfil', () => {
    expect(perfilDe('kenney')).toBe('kenney');
    expect(perfilDe('ambientcg')).toBe('ambientcg');
    for (const f of ['codigo', 'propio', 'quaternius', 'meshy', 'ia-imagen'] as const) {
      expect(perfilDe(f), f).toBeNull();
    }
  });

  it('planea solo lo que tiene crédito, perfil y el tipo correcto', () => {
    const a = 'public/assets/salas/porteria/escritorio.glb';
    const b = 'public/assets/salas/porteria/taza.glb';
    const c = 'public/assets/salas/porteria/silla.glb';
    const d = 'public/assets/salas/compartido/piso.ktx2';
    const e = 'public/assets/salas/compartido/techo.ktx2';
    const { planes, problemas } = planear(
      [modelo(a), modelo(b), modelo(c), textura(d), textura(e)],
      [credito(a, 'kenney'), credito(b, 'codigo'), credito(d, 'ambientcg'), credito(e, 'kenney')],
    );
    expect(planes.map((p) => [p.entrada.archivo, p.perfil])).toEqual([
      [a, 'kenney'],
      [d, 'ambientcg'],
    ]);
    expect(problemas).toEqual([
      `${b}: la fuente «codigo» no tiene perfil de limpieza`,
      `${c}: no tiene entrada en art/credits.json; anótala primero`,
      `${e}: el perfil kenney no produce un textura`,
    ]);
  });

  it('filtra por carpeta', () => {
    const a = 'public/assets/salas/porteria/escritorio.glb';
    const d = 'public/assets/salas/compartido/piso.ktx2';
    const { planes } = planear(
      [modelo(a), textura(d)],
      [credito(a, 'kenney'), credito(d, 'ambientcg')],
      'compartido',
    );
    expect(planes.map((p) => p.entrada.archivo)).toEqual([d]);
  });
});

describe('originales desde los zips de art/ (T11a)', () => {
  let carpeta = '';
  const zip = (): Uint8Array =>
    zipSync({
      'Models/GLB format/caja.glb': new Uint8Array([1, 2, 3]),
      'Models/GLB format/Textures/colormap.png': new Uint8Array([4, 5]),
      'Models/OBJ format/caja.obj': new Uint8Array([6]),
      'License.txt': new TextEncoder().encode('CC0'),
    });

  beforeAll(async () => {
    carpeta = await mkdtemp(path.join(tmpdir(), 'lup-zip-prueba-'));
    await writeFile(path.join(carpeta, 'paquete.zip'), zip());
    await writeFile(
      path.join(carpeta, 'puntero.zip'),
      'version https://git-lfs.github.com/spec/v1\n',
    );
    await writeFile(
      path.join(carpeta, 'malicioso.zip'),
      zipSync({ 'Models/../../fuera.glb': new Uint8Array([9]) }),
    );
  });
  afterAll(() => rm(carpeta, { recursive: true, force: true }));

  it('saca el modelo con su carpeta de texturas, sin lo demás', async () => {
    const extractor = new ExtractorOriginales(carpeta);
    try {
      const ruta = await extractor.ruta('paquete.zip#Models/GLB format/caja.glb');
      expect([...(await readFile(ruta))]).toEqual([1, 2, 3]);
      const textura = path.join(path.dirname(ruta), 'Textures', 'colormap.png');
      expect([...(await readFile(textura))]).toEqual([4, 5]);
      await expect(
        readFile(path.join(path.dirname(ruta), '..', 'OBJ format', 'caja.obj')),
      ).rejects.toThrow();
      // Una segunda pieza de la misma carpeta reutiliza lo ya sacado.
      expect(await extractor.ruta('paquete.zip#Models/GLB format/caja.glb')).toBe(ruta);
    } finally {
      await extractor.limpiar();
    }
  });

  it('avisa si falta el archivo, si el zip es un puntero de LFS o si trae rutas con «..»', async () => {
    const extractor = new ExtractorOriginales(carpeta);
    try {
      await expect(extractor.ruta('paquete.zip#Models/GLB format/otra.glb')).rejects.toThrow(
        /No encontré «Models\/GLB format\/otra.glb»/,
      );
      await expect(extractor.ruta('puntero.zip#a.glb')).rejects.toThrow(/git lfs pull/);
      await expect(extractor.ruta('malicioso.zip#Models/a.glb')).rejects.toThrow(/peligrosa/);
    } finally {
      await extractor.limpiar();
    }
  });
});

/** Una pieza de prueba: tres cajas de colores planos, una hija de otra y desplazada. */
function piezaDePrueba(documento: Document, nombre: string): Node {
  const bufer = documento.getRoot().listBuffers()[0] ?? documento.createBuffer();
  const caja = (color: [number, number, number, number]) => {
    // Una caja de 1 × 1 × 1 con la base en y = 0, 12 triángulos.
    const v = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ];
    const indices = [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1,
      2, 6, 1, 6, 5,
    ];
    const prim = documento
      .createPrimitive()
      .setAttribute(
        'POSITION',
        documento
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array(v.flat()))
          .setBuffer(bufer),
      )
      .setIndices(
        documento
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Uint16Array(indices))
          .setBuffer(bufer),
      )
      .setMaterial(documento.createMaterial().setBaseColorFactor(color));
    return documento.createMesh().addPrimitive(prim);
  };
  const raiz = documento.createNode(nombre).setMesh(caja([0.8, 0.5, 0.2, 1]));
  const hija = documento
    .createNode(`${nombre}-cajon`)
    .setTranslation([1, 0, 0])
    .setMesh(caja([0.2, 0.2, 0.2, 1]));
  raiz.addChild(hija);
  raiz.addChild(
    documento
      .createNode(`${nombre}-tapa`)
      .setTranslation([0, 1, 0])
      .setMesh(caja([0.9, 0.9, 0.9, 1])),
  );
  return raiz;
}

const tamano = (documento: Document) => {
  const escena = documento.getRoot().getDefaultScene();
  if (!escena) throw new Error('sin escena');
  const { min, max } = getBounds(escena);
  return { min, tam: max.map((v, i) => +(v - (min[i] ?? 0)).toFixed(4)) };
};

describe('perfil kenney (T11b)', () => {
  it('conoce la escala de los tres paquetes y la saca de la ruta del original', () => {
    expect(paqueteDe(`${FURNITURE}#Models/GLTF format/desk.glb`)).toBe('kenney-furniture-kit');
    expect(Object.keys(ESCALA_PAQUETE).sort()).toEqual([
      'kenney-factory-kit',
      'kenney-furniture-kit',
      'kenney-mini-shop',
    ]);
    const entrada = (originales: string[]) => ({
      archivo: 'public/assets/salas/porteria/x.glb',
      piezas: originales.map((original) => ({ original })),
    });
    expect(escalaDe(entrada([`${FURNITURE}#a.glb`]))).toBe(ESCALA_PAQUETE['kenney-furniture-kit']);
    expect(() => escalaDe(entrada([`${FURNITURE}#a.glb`, `${MINI_SHOP}#b.glb`]))).toThrow(
      /mismo paquete/,
    );
    expect(() => escalaDe(entrada(['art/compartido/originales/otro/x.zip#a.glb']))).toThrow(
      /ESCALA_PAQUETE/,
    );
  });

  it('une piezas de colores planos en una malla, un material con paleta y base en y = 0', async () => {
    const documento = new Document();
    documento.createScene();
    const a = piezaDePrueba(documento, 'a');
    const b = piezaDePrueba(documento, 'b');
    await aplicarPerfilKenney(documento, [{ raices: [a] }, { raices: [b], pos: [2, 0, 0] }], {
      escala: 2,
    });
    const raiz = documento.getRoot();
    const mallas = raiz.listNodes().filter((n) => n.getMesh());
    expect(mallas).toHaveLength(1);
    expect(mallas[0]?.getMesh()?.listPrimitives()).toHaveLength(1);
    expect(raiz.listMaterials()).toHaveLength(1);
    expect(raiz.listMaterials()[0]?.getBaseColorTexture()).not.toBeNull();
    // Dos piezas de 2 × 2 × 1 una al lado de la otra, por 2: 8 × 4 × 2, centrado en x y z.
    const { min, tam } = tamano(documento);
    expect(tam).toEqual([8, 4, 2]);
    expect(min.map((v) => +v.toFixed(4))).toEqual([-4, 0, -1]);
    // 6 cajas de 12 triángulos.
    expect((mallas[0]?.getMesh()?.listPrimitives()[0]?.getIndices()?.getCount() ?? 0) / 3).toBe(72);
  });

  it('gira el modelo y lo estira por eje sin deformar las piezas giradas', async () => {
    const documento = new Document();
    documento.createScene();
    const a = piezaDePrueba(documento, 'a');
    await aplicarPerfilKenney(documento, [{ raices: [a], giro: 90 }], {
      escala: 1,
      giro: 90,
      estirar: [1, 1.5, 3],
    });
    // La pieza (2 × 2 × 1) gira 180° en total: sigue de 2 × 2 × 1, y se estira a 2 × 3 × 3.
    expect(tamano(documento).tam).toEqual([2, 3, 3]);
  });

  it('con «caja» calza justo en las medidas del objeto, y un eje sin medida va proporcional', async () => {
    const justo = new Document();
    justo.createScene();
    await aplicarPerfilKenney(justo, [{ raices: [piezaDePrueba(justo, 'a')] }], {
      escala: 2,
      caja: [1.2, 0.75, 0.6],
    });
    expect(tamano(justo).tam).toEqual([1.2, 0.75, 0.6]);

    const plano = new Document();
    plano.createScene();
    await aplicarPerfilKenney(plano, [{ raices: [piezaDePrueba(plano, 'a')] }], {
      escala: 1,
      caja: [1, 4, null],
    });
    // 2 × 2 × 1 → x ×0,5 e y ×2: el fondo sigue la media, ×1,25.
    expect(tamano(plano).tam).toEqual([1, 4, 1.25]);
  });
});

describe('perfil ambientcg (T11e)', () => {
  it('solo acepta el mapa de color', async () => {
    expect(esMapaDeColor('Tiles040_1K-JPG_Color.jpg')).toBe(true);
    expect(esMapaDeColor('Tiles040_1K-JPG_NormalGL.jpg')).toBe(false);
    expect(esMapaDeColor('Tiles040.png')).toBe(false);
    await expect(texturaAmbientcg('Tiles040_1K-JPG_Roughness.jpg', 'x.ktx2')).rejects.toThrow(
      /solo se usa el mapa de color/,
    );
  });
});
