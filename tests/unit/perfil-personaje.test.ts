import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Document, getBounds } from '@gltf-transform/core';
import type { Node } from '@gltf-transform/core';
import { esquemaLista } from '../../scripts/modelos/lista.ts';
import { crearPng, leerPng } from '../../scripts/modelos/png.ts';
import { aplicarPerfilPersonaje } from '../../scripts/perfiles/personaje.ts';
import { PAQUETE_PERSONAJES } from '../../src/engine/coop/modelo-personajes';

// T83c: el perfil de personajes deja un modelo con esqueleto, una draw call, solo los clips
// pedidos, en metros y con la camiseta marcada para pintarla del color del jugador.

const HUESOS = ['root', 'torso', 'arm-left', 'arm-right', 'head', 'leg-left'] as const;
type Hueso = (typeof HUESOS)[number];

/** Bloques de la paleta (64 × 128 px) con nombre: [columna, fila]. */
const BLOQUE = { piel: [1, 2], camiseta: [4, 2], cinturon: [0, 2], pelo: [3, 3] } as const;
type Bloque = keyof typeof BLOQUE;

/** Paleta de 512 × 512 con un color por bloque (y un degradado, como la de Kenney). */
const paleta = (): Uint8Array =>
  crearPng(512, 512, (x, y) => [(x >> 6) * 30, (y >> 7) * 60, 200 - (y % 128)]);

/**
 * Un personaje de prueba como los de Mini Characters: cuerpo y cabeza en mallas aparte con el
 * mismo esqueleto, tangentes y tres clips. Cada triángulo tiene sus vértices, su hueso y su
 * bloque de la paleta. Mide 0,776 de alto.
 */
function personaje(): { doc: Document; raiz: Node } {
  const doc = new Document();
  const bufer = doc.createBuffer();
  const raiz = doc.createNode('character-prueba');
  const huesos = new Map<Hueso, Node>();
  for (const h of HUESOS) huesos.set(h, doc.createNode(h));
  const nodo = (h: Hueso): Node => huesos.get(h) as Node;
  nodo('root').addChild(nodo('torso')).addChild(nodo('leg-left'));
  nodo('torso').addChild(nodo('arm-left')).addChild(nodo('arm-right')).addChild(nodo('head'));
  raiz.addChild(nodo('root'));
  doc.createScene().addChild(raiz);

  const textura = doc.createTexture('colormap').setImage(paleta()).setMimeType('image/png');
  const material = doc.createMaterial('colormap').setBaseColorTexture(textura);
  const ibm = doc
    .createAccessor()
    .setType('MAT4')
    .setArray(
      new Float32Array(HUESOS.length * 16).map((_, i) =>
        i % 16 === 0 || i % 16 === 5 || i % 16 === 10 || i % 16 === 15 ? 1 : 0,
      ),
    )
    .setBuffer(bufer);
  const piel = () => {
    const s = doc.createSkin().setInverseBindMatrices(ibm);
    for (const h of HUESOS) s.addJoint(nodo(h));
    return s;
  };

  let altura = 0;
  const malla = (nombre: string, tris: Array<[Hueso, Bloque]>) => {
    const pos: number[] = [];
    const uv: number[] = [];
    const juntas: number[] = [];
    const pesos: number[] = [];
    tris.forEach(([h, b], i) => {
      const [bx, by] = BLOQUE[b];
      for (let k = 0; k < 3; k++) {
        // Un triángulo por debajo de otro; el último llega a 0,776.
        pos.push(k * 0.1, altura, 0);
        uv.push((bx * 64 + 20 + k * 10) / 512, (by * 128 + 30 + k * 30) / 512);
        juntas.push(HUESOS.indexOf(h), 0, 0, 0);
        pesos.push(1, 0, 0, 0);
      }
      altura = Math.min(0.776, altura + 0.776 / 14);
      void i;
    });
    const acc = (tipo: 'VEC2' | 'VEC3' | 'VEC4', datos: ArrayLike<number>, enteros = false) =>
      doc
        .createAccessor()
        .setType(tipo)
        .setArray(enteros ? new Uint16Array(datos) : new Float32Array(datos))
        .setBuffer(bufer);
    const n = pos.length / 3;
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', acc('VEC3', pos))
      .setAttribute(
        'NORMAL',
        acc(
          'VEC3',
          new Array(n * 3).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)),
        ),
      )
      .setAttribute('TANGENT', acc('VEC4', new Array(n * 4).fill(1)))
      .setAttribute('TEXCOORD_0', acc('VEC2', uv))
      .setAttribute('JOINTS_0', acc('VEC4', juntas, true))
      .setAttribute('WEIGHTS_0', acc('VEC4', pesos))
      .setIndices(
        doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Uint16Array(Array.from({ length: n }, (_, i) => i)))
          .setBuffer(bufer),
      );
    const m = doc.createMesh(nombre).addPrimitive(prim);
    raiz.addChild(doc.createNode(nombre).setMesh(m).setSkin(piel()));
  };
  // El torso tiene más cinturón que camiseta (como male-a); las mangas son de la camiseta.
  malla('body-mesh', [
    ['torso', 'cinturon'],
    ['torso', 'cinturon'],
    ['torso', 'cinturon'],
    ['torso', 'camiseta'],
    ['torso', 'camiseta'],
    ['arm-left', 'camiseta'],
    ['arm-right', 'camiseta'],
    ['arm-right', 'camiseta'],
    ['arm-left', 'piel'],
    ['arm-right', 'piel'],
    ['leg-left', 'cinturon'],
  ]);
  malla('head-mesh', [
    ['head', 'piel'],
    ['head', 'piel'],
    ['head', 'pelo'],
  ]);

  for (const nombre of ['idle', 'walk', 'sprint']) {
    const muestreo = doc
      .createAnimationSampler()
      .setInput(
        doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Float32Array([0, 1]))
          .setBuffer(bufer),
      )
      .setOutput(
        doc
          .createAccessor()
          .setType('VEC4')
          .setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]))
          .setBuffer(bufer),
      );
    const canal = doc
      .createAnimationChannel()
      .setTargetNode(nodo('torso'))
      .setTargetPath('rotation')
      .setSampler(muestreo);
    doc.createAnimation(nombre).addSampler(muestreo).addChannel(canal);
  }
  return { doc, raiz };
}

describe('perfil de personajes (T83c)', () => {
  it('una sola malla con piel, sin tangentes, solo los clips pedidos y del alto pedido', async () => {
    const { doc, raiz } = personaje();
    await aplicarPerfilPersonaje(doc, [raiz], {
      clips: ['idle', 'walk'],
      alto: 1.4,
      uniforme: ['torso', 'arm-left', 'arm-right'],
    });
    const r = doc.getRoot();
    const conMalla = r.listNodes().filter((n) => n.getMesh());
    expect(conMalla).toHaveLength(1);
    expect(conMalla[0]?.getSkin()).not.toBeNull();
    const prims = r.listMeshes().flatMap((m) => m.listPrimitives());
    expect(prims).toHaveLength(1);
    expect(prims[0]?.getAttribute('TANGENT')).toBeNull();
    expect(r.listAnimations().map((a) => a.getName())).toEqual(['idle', 'walk']);
    const escena = r.getDefaultScene();
    if (!escena) throw new Error('sin escena');
    const { min, max } = getBounds(escena);
    expect((max[1] ?? 0) - (min[1] ?? 0)).toBeCloseTo(1.4, 3);
    expect(min[1]).toBeCloseTo(0, 5);
  });

  it('marca la camiseta y las mangas, no el cinturón ni las manos ni la cabeza', async () => {
    const { doc, raiz } = personaje();
    await aplicarPerfilPersonaje(doc, [raiz], {
      clips: ['idle'],
      alto: 1.4,
      uniforme: ['torso', 'arm-left', 'arm-right'],
    });
    const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
    const tinte = prim?.getAttribute('_TINTE');
    if (!tinte) throw new Error('sin _TINTE');
    // Los triángulos van en orden: 11 del cuerpo y 3 de la cabeza, 3 vértices cada uno.
    const porTriangulo = Array.from({ length: 14 }, (_, f) => tinte.getScalar(f * 3));
    expect(porTriangulo).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('falla si falta un clip, en lugar de publicar un personaje sin caminar', async () => {
    const { doc, raiz } = personaje();
    await expect(
      aplicarPerfilPersonaje(doc, [raiz], { clips: ['run'], alto: 1.4 }),
    ).rejects.toThrow(/run/);
  });
});

describe('lector PNG mínimo (T83c)', () => {
  it('lee lo que escribe crearPng, en RGBA', () => {
    const png = crearPng(5, 3, (x, y) => [x * 40, y * 80, 7]);
    const img = leerPng(png);
    expect([img.ancho, img.alto]).toEqual([5, 3]);
    expect(Array.from(img.datos.subarray((2 * 5 + 4) * 4, (2 * 5 + 4) * 4 + 4))).toEqual([
      160, 160, 7, 255,
    ]);
  });
});

describe('art/modelos.json con personajes (T83c)', () => {
  const zip = 'art/compartido/originales/kenney-mini-characters/kenney_mini-characters.zip';
  const entrada = {
    archivo: 'public/assets/salas/compartido/estudiante-z.glb',
    piezas: [{ original: `${zip}#Models/GLB format/character-male-a.glb` }],
    animado: { clips: ['idle', 'walk'], alto: 1.4, uniforme: ['torso'] },
  };

  it('acepta un personaje animado de una sola pieza', () => {
    expect(esquemaLista.safeParse([entrada]).success).toBe(true);
  });

  it('no acepta un personaje con dos piezas, caja o giro', () => {
    const dos = { ...entrada, piezas: [...entrada.piezas, ...entrada.piezas] };
    expect(esquemaLista.safeParse([dos]).success).toBe(false);
    expect(esquemaLista.safeParse([{ ...entrada, giro: 90 }]).success).toBe(false);
    expect(esquemaLista.safeParse([{ ...entrada, caja: [1, 1, 1] }]).success).toBe(false);
  });
});

describe('personajes publicados (T83c)', () => {
  it('cada uno es una draw call con menos de 2.000 triángulos, y están los cuatro', async () => {
    const manifiesto = JSON.parse(await readFile('public/assets/manifest.json', 'utf8')) as {
      salas: Record<
        string,
        { archivos: Array<{ archivo: string; triangulos?: number; drawCalls?: number }> }
      >;
    };
    const archivos = manifiesto.salas['compartido']?.archivos ?? [];
    for (const id of PAQUETE_PERSONAJES.archivos) {
      const nombre = id.split('/')[1] ?? '';
      const a = archivos.find((x) => x.archivo.startsWith(`salas/compartido/${nombre}.`));
      expect(a, id).toBeDefined();
      expect(a?.drawCalls).toBe(1);
      expect(a?.triangulos).toBeLessThan(2000);
    }
  });
});
