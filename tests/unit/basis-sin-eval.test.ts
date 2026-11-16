import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESTINO, ORIGINAL, sinEval } from '../../scripts/csp/basis-sin-eval';
import { gestorSinEval } from '../../src/engine/carga/cargador';

/**
 * T02b · El transcodificador Basis sin `Function(...)` (para la CSP sin 'unsafe-eval'). Debe
 * estar al día con el de three y transcodificar exactamente igual que el original.
 */

const original = readFileSync(ORIGINAL, 'utf8');
const generado = readFileSync(DESTINO, 'utf8');
const wasm = readFileSync(ORIGINAL.replace(/\.js$/, '.wasm'));

interface Ktx2File {
  isValid(): number;
  getWidth(): number;
  getHeight(): number;
  startTranscoding(): number;
  getImageTranscodedSizeInBytes(nivel: number, capa: number, cara: number, formato: number): number;
  transcodeImage(
    destino: Uint8Array,
    nivel: number,
    capa: number,
    cara: number,
    formato: number,
    banderas: number,
    canalR: number,
    canalG: number,
  ): number;
  close(): void;
  delete(): void;
}
interface ModuloBasis {
  initializeBasis(): void;
  KTX2File: new (datos: Uint8Array) => Ktx2File;
}

/** Carga el módulo de Emscripten desde su texto (en Node no hay CSP). */
async function cargar(texto: string): Promise<ModuloBasis> {
  const modulo = { exports: {} as unknown };
  new Function('module', 'exports', 'require', '__filename', '__dirname', texto)(
    modulo,
    modulo.exports,
    createRequire(import.meta.url),
    ORIGINAL,
    path.dirname(ORIGINAL),
  );
  const BASIS = modulo.exports as (o: { wasmBinary: Uint8Array }) => Promise<ModuloBasis>;
  const m = await BASIS({ wasmBinary: new Uint8Array(wasm) });
  m.initializeBasis();
  return m;
}

/** Las texturas KTX2 del GLB de prueba. */
function texturasDelCubo(): Uint8Array[] {
  const glb = readFileSync('public/assets/pruebas/cubo.glb');
  const largoJson = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + largoJson).toString('utf8')) as {
    images: { mimeType: string; bufferView: number }[];
    bufferViews: { byteOffset?: number; byteLength: number }[];
  };
  const binario = glb.subarray(20 + largoJson + 8);
  return json.images
    .filter((i) => i.mimeType === 'image/ktx2')
    .map((i) => {
      const v = json.bufferViews[i.bufferView];
      if (!v) throw new Error('bufferView');
      const desde = v.byteOffset ?? 0;
      return new Uint8Array(binario.subarray(desde, desde + v.byteLength));
    });
}

/** Transcodifica a RGBA32 (formato 13 de Basis) y devuelve los bytes. */
function transcodificar(m: ModuloBasis, datos: Uint8Array): Uint8Array {
  const f = new m.KTX2File(datos);
  try {
    expect(f.isValid()).toBeTruthy();
    expect(f.startTranscoding()).toBeTruthy();
    const tamano = f.getImageTranscodedSizeInBytes(0, 0, 0, 13);
    const destino = new Uint8Array(tamano);
    expect(f.transcodeImage(destino, 0, 0, 0, 13, 0, -1, -1)).toBeTruthy();
    return destino;
  } finally {
    f.close();
    f.delete();
  }
}

describe('T02b · transcodificador Basis sin eval', () => {
  it('el archivo generado está al día con el de three (npm run basis-sin-eval)', () => {
    expect(generado).toBe(sinEval(original));
  });

  it('no crea código con Function ni eval', () => {
    expect(generado).not.toMatch(/newFunc\(Function|new Function|\beval\(/);
    // El original sí lo hacía: por eso existe esta copia.
    expect(original).toMatch(/newFunc\(Function/);
  });

  it('transcodifica las texturas del cubo de prueba igual que el original', async () => {
    const texturas = texturasDelCubo();
    expect(texturas.length).toBeGreaterThan(0);
    const [a, b] = await Promise.all([cargar(original), cargar(generado)]);
    for (const t of texturas) {
      const esperado = transcodificar(a, t);
      expect(esperado.length).toBeGreaterThan(0);
      expect(transcodificar(b, t)).toEqual(esperado);
    }
  }, 30_000);

  it('una llamada con argumentos de menos falla igual que antes', async () => {
    const m = await cargar(generado);
    const f = new m.KTX2File(texturasDelCubo()[0] ?? new Uint8Array());
    expect(() => (f.getWidth as (...a: unknown[]) => number)(1)).toThrow(/expected 0/);
    f.close();
    f.delete();
  }, 30_000);

  it('el cargador pide la copia sin eval en lugar del .js de three; el .wasm no cambia', () => {
    const g = gestorSinEval();
    for (const url of [
      '/_astro/basis_transcoder.o4Hde_L7.js',
      '/node_modules/three/examples/jsm/libs/basis/basis_transcoder.js?v=1',
    ]) {
      expect(g.resolveURL(url)).toMatch(/basis_transcoder_sin_eval/);
    }
    expect(g.resolveURL('/_astro/basis_transcoder.VXdx5NbI.wasm')).toBe(
      '/_astro/basis_transcoder.VXdx5NbI.wasm',
    );
    expect(g.resolveURL('/assets/pruebas/cubo.glb')).toBe('/assets/pruebas/cubo.glb');
  });

  it('todo KTX2Loader del juego usa la copia sin eval', () => {
    const archivos = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => path.join('src', f));
    const usos = archivos.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/new KTX2Loader\(([^)]*\)?)\)/g)].map((m) => [f, m[1]]),
    );
    expect(usos.length).toBeGreaterThanOrEqual(2);
    for (const [archivo, argumento] of usos) expect(argumento, archivo).toBe('gestorSinEval()');
  });
});
