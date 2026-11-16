/**
 * taza-prueba (T10b): genera `art/prueba-assets/originales/taza.glb`, una taza low-poly hecha
 * por código, para probar el camino completo de un asset mientras no haya un original de
 * Kenney: `optimize-models` → `public/assets/salas/porteria/` → `/jugar?prueba=asset`.
 *
 *   npm run taza-prueba
 *
 * Es un ORIGINAL sin optimizar (textura PNG, sin meshopt), como llega un modelo descargado.
 * Cuando Alex traiga la taza de Kenney, ese archivo reemplaza a este con el mismo nombre.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Document } from '@gltf-transform/core';
import type { Primitive } from '@gltf-transform/core';
import { crearIO, medir } from './modelos/etapa-comun.ts';
import { crearPng } from './modelos/png.ts';

export const DESTINO_TAZA = path.join('art', 'prueba-assets', 'originales', 'taza.glb');

/** Medidas en metros. */
const RADIO = 0.045;
const RADIO_DENTRO = 0.04;
const ALTO = 0.095;
const FONDO = 0.008;
const LADOS = 16;

interface Malla {
  posiciones: number[];
  normales: number[];
  uvs: number[];
  indices: number[];
}

function vertice(m: Malla, p: number[], n: number[], uv: number[]): number {
  m.posiciones.push(...p);
  m.normales.push(...n);
  m.uvs.push(...uv);
  return m.posiciones.length / 3 - 1;
}

/** Pared de cilindro. `adentro` voltea normales y caras. */
function pared(m: Malla, r: number, y0: number, y1: number, adentro: boolean): void {
  const inicio = m.posiciones.length / 3;
  for (let i = 0; i <= LADOS; i++) {
    const a = (i / LADOS) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const n = adentro ? [-c, 0, -s] : [c, 0, s];
    vertice(m, [r * c, y0, r * s], n, [i / LADOS, 1 - y0 / ALTO]);
    vertice(m, [r * c, y1, r * s], n, [i / LADOS, 1 - y1 / ALTO]);
  }
  for (let i = 0; i < LADOS; i++) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => inicio + i * 2 + k) as [
      number,
      number,
      number,
      number,
    ];
    // Por fuera, las caras miran hacia afuera (antihorario visto desde afuera).
    if (adentro) m.indices.push(a, c, b, b, c, d);
    else m.indices.push(a, b, c, b, d, c);
  }
}

/** Anillo plano entre dos radios a la altura `y`, mirando hacia arriba o abajo. */
function anillo(m: Malla, r0: number, r1: number, y: number, arriba: boolean): void {
  const inicio = m.posiciones.length / 3;
  const n = arriba ? [0, 1, 0] : [0, -1, 0];
  for (let i = 0; i <= LADOS; i++) {
    const a = (i / LADOS) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    vertice(m, [r0 * c, y, r0 * s], n, [0.02, 0.02]);
    vertice(m, [r1 * c, y, r1 * s], n, [0.02, 0.02]);
  }
  for (let i = 0; i < LADOS; i++) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => inicio + i * 2 + k) as [
      number,
      number,
      number,
      number,
    ];
    if (arriba) m.indices.push(a, c, b, b, c, d);
    else m.indices.push(a, b, c, b, d, c);
  }
}

/** Asa: medio toro del lado +x, en el plano xy. */
function asa(m: Malla): void {
  const centro = [RADIO + 0.006, ALTO / 2];
  const radio = 0.026;
  const tubo = 0.0065;
  const tramos = 8;
  const gajos = 6;
  const inicio = m.posiciones.length / 3;
  for (let i = 0; i <= tramos; i++) {
    const t = -Math.PI / 2 + (i / tramos) * Math.PI;
    const [ct, st] = [Math.cos(t), Math.sin(t)];
    for (let j = 0; j <= gajos; j++) {
      const g = (j / gajos) * Math.PI * 2;
      const [cg, sg] = [Math.cos(g), Math.sin(g)];
      const n = [ct * cg, st * cg, sg];
      const p = [
        (centro[0] ?? 0) + (radio + tubo * cg) * ct,
        (centro[1] ?? 0) + (radio + tubo * cg) * st,
        tubo * sg,
      ];
      vertice(m, p, n, [0.02, 0.02]);
    }
  }
  const fila = gajos + 1;
  for (let i = 0; i < tramos; i++) {
    for (let j = 0; j < gajos; j++) {
      const a = inicio + i * fila + j;
      const b = a + fila;
      m.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

function primitiva(documento: Document, m: Malla): Primitive {
  const bufer = documento.getRoot().listBuffers()[0] ?? documento.createBuffer();
  const accesor = (
    tipo: 'VEC2' | 'VEC3' | 'SCALAR',
    datos: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>,
  ) => documento.createAccessor().setType(tipo).setArray(datos).setBuffer(bufer);
  return documento
    .createPrimitive()
    .setAttribute('POSITION', accesor('VEC3', new Float32Array(m.posiciones)))
    .setAttribute('NORMAL', accesor('VEC3', new Float32Array(m.normales)))
    .setAttribute('TEXCOORD_0', accesor('VEC2', new Float32Array(m.uvs)))
    .setIndices(accesor('SCALAR', new Uint16Array(m.indices)));
}

/** El documento de la taza, sin optimizar. */
export function crearTaza(): Document {
  const documento = new Document();
  documento.createBuffer();
  const m: Malla = { posiciones: [], normales: [], uvs: [], indices: [] };
  pared(m, RADIO, 0, ALTO, false);
  pared(m, RADIO_DENTRO, FONDO, ALTO, true);
  anillo(m, RADIO_DENTRO, RADIO, ALTO, true);
  anillo(m, 0, RADIO, 0, false);
  anillo(m, 0, RADIO_DENTRO, FONDO, true);
  asa(m);

  // Loza blanca con una franja azul y una línea naranja alrededor (solo color).
  const color = crearPng(128, 64, (_x, y) => {
    if (y >= 24 && y < 34) return [44, 82, 140];
    if (y >= 36 && y < 39) return [232, 150, 50];
    return [238, 234, 226];
  });
  const material = documento
    .createMaterial('loza')
    .setBaseColorTexture(documento.createTexture('loza').setImage(color).setMimeType('image/png'))
    .setMetallicFactor(0)
    .setRoughnessFactor(0.5);
  const escena = documento.createScene('taza');
  documento.getRoot().setDefaultScene(escena);
  escena.addChild(
    documento
      .createNode('taza')
      .setMesh(
        documento.createMesh('taza').addPrimitive(primitiva(documento, m).setMaterial(material)),
      ),
  );
  return documento;
}

async function principal(): Promise<number> {
  const documento = crearTaza();
  await mkdir(path.dirname(DESTINO_TAZA), { recursive: true });
  await (await crearIO()).write(DESTINO_TAZA, documento);
  const { triangulos } = medir(documento);
  console.log(`Escrito ${DESTINO_TAZA}: ${triangulos} triángulos (original sin optimizar)`);
  return 0;
}

// Solo al correrlo como script (los tests importan `crearTaza`).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exitCode = await principal();
}
