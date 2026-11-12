import { describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { aplicarEtapaComun, crearIO, medir } from '../../scripts/modelos/etapa-comun.ts';

/**
 * Escena "como la exporta un pack": 6 sillas, cada una con su copia de la misma malla
 * y su copia del mismo material, vértices sin soldar, más un material y un nodo sobrantes.
 */
function escenaDePrueba(copias = 6): Document {
  const documento = new Document();
  const bufer = documento.createBuffer();
  const escena = documento.createScene('sala');
  documento.getRoot().setDefaultScene(escena);
  documento.createMaterial('sobrante');

  // Un cubo de 12 triángulos con 36 vértices sueltos (sin índice), como sale de muchos exportadores.
  const esquinas = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ];
  const caras = [
    [0, 2, 1, 0, 3, 2],
    [4, 5, 6, 4, 6, 7],
    [0, 1, 5, 0, 5, 4],
    [3, 6, 2, 3, 7, 6],
    [0, 4, 7, 0, 7, 3],
    [1, 2, 6, 1, 6, 5],
  ].flat();
  const posiciones = new Float32Array(caras.flatMap((i) => esquinas[i] ?? []));

  for (let i = 0; i < copias; i++) {
    const material = documento.createMaterial(`madera-${i}`).setBaseColorFactor([0.6, 0.4, 0.2, 1]);
    const posicion = documento
      .createAccessor()
      .setType('VEC3')
      .setArray(posiciones.slice())
      .setBuffer(bufer);
    const primitiva = documento
      .createPrimitive()
      .setAttribute('POSITION', posicion)
      .setMaterial(material);
    const malla = documento.createMesh(`silla-${i}`).addPrimitive(primitiva);
    escena.addChild(
      documento
        .createNode(`silla-${i}`)
        .setMesh(malla)
        .setTranslation([i * 3, 0, 0]),
    );
  }
  escena.addChild(documento.createNode('vacio'));
  return documento;
}

describe('etapa común de optimize-models', () => {
  it('mide la escena original', () => {
    expect(medir(escenaDePrueba())).toEqual({
      triangulos: 72,
      drawCalls: 6,
      mallas: 6,
      materiales: 7,
    });
  });

  it('une duplicados, instancia y conserva los triángulos', async () => {
    const documento = escenaDePrueba();
    await aplicarEtapaComun(documento);

    expect(medir(documento)).toEqual({ triangulos: 72, drawCalls: 1, mallas: 1, materiales: 1 });
    const extensiones = documento
      .getRoot()
      .listExtensionsUsed()
      .map((e) => e.extensionName);
    expect(extensiones).toEqual(
      expect.arrayContaining([
        'EXT_mesh_gpu_instancing',
        'EXT_meshopt_compression',
        'KHR_mesh_quantization',
      ]),
    );
    // weld: el cubo pasa de 36 vértices sueltos a 8 con índice.
    const primitiva = documento.getRoot().listMeshes()[0]?.listPrimitives()[0];
    expect(primitiva?.getAttribute('POSITION')?.getCount()).toBe(8);
    expect(primitiva?.getIndices()?.getCount()).toBe(36);
  });

  it('con --sin-instance deja una draw call por silla', async () => {
    const documento = escenaDePrueba();
    await aplicarEtapaComun(documento, { instanciar: false });
    expect(medir(documento)).toMatchObject({ triangulos: 72, drawCalls: 6, mallas: 1 });
  });

  it('no instancia por debajo del mínimo', async () => {
    const documento = escenaDePrueba(3);
    await aplicarEtapaComun(documento);
    expect(medir(documento).drawCalls).toBe(3);
  });

  it('escribe un GLB más liviano que se vuelve a leer con meshopt', async () => {
    const io = await crearIO();
    const original = await io.writeBinary(escenaDePrueba());

    const documento = escenaDePrueba();
    await aplicarEtapaComun(documento);
    const optimizado = await io.writeBinary(documento);

    expect(optimizado.byteLength).toBeLessThan(original.byteLength / 2);
    const releido = await io.readBinary(optimizado);
    expect(medir(releido)).toEqual({ triangulos: 72, drawCalls: 1, mallas: 1, materiales: 1 });
  });
});
