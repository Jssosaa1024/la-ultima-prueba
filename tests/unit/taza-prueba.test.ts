import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aplicarEtapaComun, crearIO, medir } from '../../scripts/modelos/etapa-comun.ts';
import { crearTaza, DESTINO_TAZA } from '../../scripts/taza-prueba.ts';
import { esquemaCreditos } from '../../scripts/creditos/esquema.ts';
import { salaPorId } from '../../src/content/salas';
import { indiceDeManifiesto, urlDeAsset } from '../../src/engine/carga/manifiesto';
import {
  conTazaDePrueba,
  esPruebaAsset,
  ID_TAZA,
  MODELO_TAZA,
} from '../../src/engine/salas/prueba-asset';

// T10b: la taza de prueba (generada por código mientras no haya la de Kenney) recorre el
// pipeline y `?prueba=asset` la pone sobre el escritorio de la portería.

describe('taza de prueba (T10b)', () => {
  it('es low-poly y todas sus caras miran hacia donde dicen sus normales', () => {
    const documento = crearTaza();
    expect(medir(documento).triangulos).toBeLessThan(600);
    const primitiva = documento.getRoot().listMeshes()[0]?.listPrimitives()[0];
    const p = primitiva?.getAttribute('POSITION');
    const n = primitiva?.getAttribute('NORMAL');
    const i = primitiva?.getIndices();
    if (!p || !n || !i) throw new Error('taza incompleta');
    const v = (k: number) => p.getElement(k, [0, 0, 0]);
    for (let t = 0; t < i.getCount(); t += 3) {
      const [a, b, c] = [i.getScalar(t), i.getScalar(t + 1), i.getScalar(t + 2)];
      const [pa, pb, pc] = [v(a), v(b), v(c)];
      const e1 = pb.map((x, k) => x - (pa[k] ?? 0));
      const e2 = pc.map((x, k) => x - (pa[k] ?? 0));
      const cara = [
        (e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0),
        (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0),
        (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0),
      ];
      const largo = Math.hypot(...cara);
      if (largo < 1e-12) continue;
      const normal = n.getElement(a, [0, 0, 0]);
      const coseno = cara.reduce((s, x, k) => s + x * (normal[k] ?? 0), 0) / largo;
      expect(coseno, `triángulo ${t / 3}`).toBeGreaterThan(0);
    }
  });

  it('pasa la etapa común: meshopt, textura KTX2 de color y el crédito dentro', async () => {
    const documento = crearTaza();
    const texturas = await aplicarEtapaComun(documento, {
      instanciar: false,
      copyright: 'Taza de prueba · La Última Prueba · propio',
    });
    expect(texturas).toHaveLength(1);
    expect(texturas[0]?.modo).toBe('etc1s');
    const io = await crearIO();
    const glb = await io.writeBinary(documento);
    const leido = await io.readBinary(glb);
    expect(
      leido
        .getRoot()
        .listExtensionsUsed()
        .map((e) => e.extensionName),
    ).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']));
    expect(leido.getRoot().getAsset().copyright).toContain('La Última Prueba');
  }, 60_000);

  it('el original, la salida y su crédito están en el repositorio', () => {
    expect(DESTINO_TAZA.split(/[\\/]/).join('/')).toBe('art/prueba-assets/originales/taza.glb');
    expect(readFileSync(DESTINO_TAZA).byteLength).toBeGreaterThan(0);
    const creditos = esquemaCreditos.parse(JSON.parse(readFileSync('art/credits.json', 'utf8')));
    const credito = creditos.find((c) => c.archivo === 'public/assets/salas/porteria/taza.glb');
    expect(credito?.sala).toBe('porteria');
    const indice = indiceDeManifiesto(
      JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as unknown,
    );
    expect(urlDeAsset(indice, `porteria/${MODELO_TAZA}`, 'glb')).toMatch(
      /^\/assets\/salas\/porteria\/taza\.[0-9a-f]{8}\.glb$/,
    );
  });
});

describe('?prueba=asset (T10b)', () => {
  it('solo vale el texto exacto', () => {
    expect(esPruebaAsset('?prueba=asset')).toBe(true);
    for (const b of ['', '?prueba=glb', '?prueba=Asset', '?prueba=asset2', '?asset=1']) {
      expect(esPruebaAsset(b), b).toBe(false);
    }
  });

  it('pone la taza encima del escritorio de la portería, sin tocar las demás salas', () => {
    const porteria = conTazaDePrueba(salaPorId('porteria'));
    const taza = porteria.objetos.find((o) => o.id === ID_TAZA);
    const escritorio = porteria.objetos.find((o) => o.id === 'porteria-escritorio');
    if (!taza || !escritorio) throw new Error('falta la taza o el escritorio');
    expect(taza.modelo).toBe(MODELO_TAZA);
    expect(taza.pos[1]).toBeCloseTo(escritorio.pos[1] + escritorio.tam[1]);
    expect(Math.abs(taza.pos[0] - escritorio.pos[0])).toBeLessThan(escritorio.tam[0] / 2);
    expect(Math.abs(taza.pos[2] - escritorio.pos[2])).toBeLessThan(escritorio.tam[2] / 2);
    expect(taza.accion).toBeUndefined();
    const sala1 = salaPorId('s1-cooperativa');
    expect(conTazaDePrueba(sala1)).toBe(sala1);
    expect(salaPorId('porteria').objetos.some((o) => o.id === ID_TAZA)).toBe(false);
  });
});
