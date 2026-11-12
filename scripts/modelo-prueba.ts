/**
 * modelo-prueba (T10): genera public/assets/pruebas/cubo.glb para `/jugar?prueba=glb`.
 *
 *   npm run modelo-prueba
 *
 * Un cubo propio (sin licencia de terceros) con un damero de color y un mapa normal de
 * relieve, que pasa por la etapa común de optimize-models: meshopt + KTX2 (ETC1S y UASTC).
 * Necesita KTX-Software, igual que optimize-models.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Document } from '@gltf-transform/core';
import { aplicarEtapaComun, crearIO, medir } from './modelos/etapa-comun.ts';
import { crearPng } from './modelos/png.ts';

const DESTINO = path.join('public', 'assets', 'pruebas', 'cubo.glb');

/** Las 6 caras del cubo: normal y dos ejes que recorren la cara (u, v). */
const CARAS: [number[], number[], number[]][] = [
  [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ],
  [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ],
  [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, -1],
    [-1, 0, 0],
    [0, 1, 0],
  ],
];

function cubo(documento: Document) {
  const posiciones: number[] = [];
  const normales: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [n, u, v] of CARAS) {
    const inicio = posiciones.length / 3;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      for (let i = 0; i < 3; i++) {
        posiciones.push((n[i] ?? 0) + a * (u[i] ?? 0) + b * (v[i] ?? 0));
        normales.push(n[i] ?? 0);
      }
      uvs.push((a + 1) / 2, (1 - b) / 2);
    }
    indices.push(inicio, inicio + 1, inicio + 2, inicio, inicio + 2, inicio + 3);
  }
  const bufer = documento.getRoot().listBuffers()[0] ?? documento.createBuffer();
  const accesor = (
    tipo: 'VEC2' | 'VEC3' | 'SCALAR',
    datos: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>,
  ) => documento.createAccessor().setType(tipo).setArray(datos).setBuffer(bufer);
  return documento
    .createPrimitive()
    .setAttribute('POSITION', accesor('VEC3', new Float32Array(posiciones)))
    .setAttribute('NORMAL', accesor('VEC3', new Float32Array(normales)))
    .setAttribute('TEXCOORD_0', accesor('VEC2', new Float32Array(uvs)))
    .setIndices(accesor('SCALAR', new Uint16Array(indices)));
}

async function principal(): Promise<number> {
  const documento = new Document();
  documento.createBuffer();
  documento.getRoot().getAsset().copyright = 'La Última Prueba, modelo propio de prueba';

  // Damero naranja y azul de 8×8 casillas, con un borde claro en cada casilla.
  const color = crearPng(256, 256, (x, y) => {
    if (x % 32 === 0 || y % 32 === 0) return [235, 235, 225];
    return ((x >> 5) + (y >> 5)) % 2 ? [232, 163, 61] : [40, 70, 120];
  });
  // Relieve: cúpulas suaves en cada casilla, codificadas como normales en espacio tangente.
  const normal = crearPng(128, 128, (x, y) => {
    const dx = ((x % 16) - 7.5) / 7.5;
    const dy = ((y % 16) - 7.5) / 7.5;
    const nx = -dx * 0.5;
    const ny = dy * 0.5;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const a = (c: number) => Math.round((c * 0.5 + 0.5) * 255);
    return [a(nx), a(ny), a(nz)];
  });

  const material = documento
    .createMaterial('damero')
    .setBaseColorTexture(
      documento.createTexture('damero-color').setImage(color).setMimeType('image/png'),
    )
    .setNormalTexture(
      documento.createTexture('damero-normal').setImage(normal).setMimeType('image/png'),
    )
    .setMetallicFactor(0)
    .setRoughnessFactor(0.7);
  const escena = documento.createScene('prueba');
  documento.getRoot().setDefaultScene(escena);
  escena.addChild(
    documento
      .createNode('cubo')
      .setMesh(documento.createMesh('cubo').addPrimitive(cubo(documento).setMaterial(material))),
  );

  const texturas = await aplicarEtapaComun(documento, { instanciar: false });
  await mkdir(path.dirname(DESTINO), { recursive: true });
  await (await crearIO()).write(DESTINO, documento);

  const { triangulos, drawCalls } = medir(documento);
  console.log(`Escrito ${DESTINO}: ${triangulos} triángulos, ${drawCalls} draw call`);
  for (const t of texturas) {
    console.log(`  ${t.nombre}: ${t.despues.ancho}×${t.despues.alto} ${t.modo.toUpperCase()}`);
  }
  return 0;
}

process.exitCode = await principal();
