import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from 'three';
import type { Material, Object3D } from 'three';
import { LUGARES } from '../../src/content/esquema-salas';
import type { Sala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { liberarObjeto } from '../../src/engine/carga/liberar';
import { indiceDeManifiesto, urlDeAsset } from '../../src/engine/carga/manifiesto';
import { interactivoDe } from '../../src/engine/interaccion/interaccion';
import { construirSala } from '../../src/engine/salas/construir';
import {
  aLambert,
  ajusteDeModelo,
  DE_MODELO,
  medidasDeAjuste,
  ponerModelos,
} from '../../src/engine/salas/modelos';
import { necesitaVestir, urlsDeSala, vestirSala } from '../../src/engine/salas/vestir';
import type { FuentesAssets } from '../../src/engine/salas/vestir';

// T19e: si un objeto de salas.json trae `modelo`, el motor pone ese GLB encima de su primitiva.

/** Un «GLB» hecho a mano: una caja de 2 × 1 × 1 m corrida hacia arriba, en Standard. */
function modeloFalso(color = 0x336699): Group {
  const escena = new Group();
  const malla = new Mesh(new BoxGeometry(2, 1, 1), new MeshStandardMaterial({ color }));
  malla.position.set(0, 1, 0);
  escena.add(malla);
  return escena;
}

/** La portería con modelos: el casillero (se toca) y el escritorio (fijo). */
function porteriaConModelos(): Sala {
  const sala = salaPorId('porteria');
  return {
    ...sala,
    objetos: sala.objetos.map((o) =>
      o.id === 'porteria-casillero'
        ? { ...o, modelo: 'casillero' }
        : o.id === 'porteria-escritorio'
          ? { ...o, modelo: 'escritorio' }
          : o,
    ),
  };
}

/** La cooperativa con los tres estantes del mismo modelo. */
function cooperativaConEstantes(): Sala {
  const sala = salaPorId('s1-cooperativa');
  return {
    ...sala,
    objetos: sala.objetos.map((o) =>
      o.id.startsWith('s1-estante-') ? { ...o, modelo: 'estante' } : o,
    ),
  };
}

const materiales = (o: Object3D): Material[] => {
  const lista: Material[] = [];
  o.traverse((x) => {
    const m = (x as Mesh).material;
    if (m) lista.push(...(Array.isArray(m) ? m : [m]));
  });
  return lista;
};

/** Draw calls de verdad: mallas con algún material visible (las instanciadas cuentan una). */
function dibujadas(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh || !o.visible) return;
    const lista = Array.isArray(malla.material) ? malla.material : [malla.material];
    n += lista.filter((m) => m.visible).length;
  });
  return n;
}

const MANIFIESTO = {
  salas: {
    porteria: {
      archivos: [
        { archivo: 'salas/porteria/casillero.0123abcd.glb' },
        { archivo: 'salas/porteria/escritorio.89abcdef.glb' },
      ],
    },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ajuste del modelo a tam (T19e)', () => {
  it('cabe sin deformarse, centrado y con la base en el piso del objeto', () => {
    const modelo = modeloFalso();
    const caja = new Box3().setFromObject(modelo);
    const m = ajusteDeModelo(caja, { forma: 'caja', tam: [1, 1, 1] });
    const ajustada = caja.clone().applyMatrix4(m);
    // Lo que limita es el ancho: 2 m → 1 m, escala 0,5 en los tres ejes.
    expect(ajustada.min.x).toBeCloseTo(-0.5);
    expect(ajustada.max.x).toBeCloseTo(0.5);
    expect(ajustada.min.y).toBeCloseTo(0);
    expect(ajustada.max.y).toBeCloseTo(0.5);
    expect(ajustada.max.z).toBeCloseTo(0.25);
  });

  it('en un plano no cuenta el fondo; en una esfera, el diámetro en todo', () => {
    expect(medidasDeAjuste({ forma: 'plano', tam: [1, 2, 0] })).toEqual([1, 2, Infinity]);
    expect(medidasDeAjuste({ forma: 'esfera', tam: [0.3, 0.3, 0] })).toEqual([0.3, 0.3, 0.3]);
    expect(medidasDeAjuste({ forma: 'cilindro', tam: [0.5, 1, 0] })).toEqual([0.5, 1, 0.5]);
    const caja = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 4, 1));
    const ajustada = caja
      .clone()
      .applyMatrix4(ajusteDeModelo(caja, { forma: 'plano', tam: [1, 4, 0] }));
    expect(ajustada.max.x - ajustada.min.x).toBeCloseTo(1);
  });

  it('los materiales pasan a Lambert con su color y su mapa', () => {
    const modelo = modeloFalso(0xff0000);
    const mapa = new DataTexture(new Uint8Array(4), 1, 1);
    const original = (modelo.children[0] as Mesh).material as MeshStandardMaterial;
    original.map = mapa;
    aLambert(modelo);
    const m = (modelo.children[0] as Mesh).material as MeshLambertMaterial;
    expect(m).toBeInstanceOf(MeshLambertMaterial);
    expect(m.color.getHex()).toBe(0xff0000);
    expect(m.map).toBe(mapa);
  });
});

describe('modelos en la sala (T19e)', () => {
  it('sin modelos no hay nada que descargar', () => {
    expect(necesitaVestir(salaPorId('porteria'))).toBe(false);
    expect(necesitaVestir(porteriaConModelos())).toBe(true);
  });

  it('un objeto con modelo no se une a la malla fija y sus colisiones no cambian', () => {
    const sin = construirSala(salaPorId('porteria'));
    const con = construirSala(porteriaConModelos());
    expect(con.cajas).toEqual(sin.cajas);
    expect(con.raiz.getObjectByName('porteria-escritorio')).toBeDefined();
    expect(sin.raiz.getObjectByName('porteria-escritorio')).toBeUndefined();
  });

  it('pone el modelo encima, esconde la primitiva y el toque sigue dando con el objeto', () => {
    const sala = porteriaConModelos();
    const { raiz } = construirSala(sala);
    const puestos = ponerModelos(
      raiz,
      sala,
      new Map([
        ['casillero', modeloFalso()],
        ['escritorio', modeloFalso()],
      ]),
    );
    expect(puestos.objetos.sort()).toEqual(['porteria-casillero', 'porteria-escritorio']);
    const casillero = raiz.getObjectByName('porteria-casillero');
    if (!casillero) throw new Error('sin casillero');
    const copia = casillero.getObjectByName('porteria-casillero-modelo');
    expect(copia?.userData[DE_MODELO]).toBe('casillero');
    // La primitiva no se dibuja, pero sigue ahí.
    expect((casillero as Mesh).isMesh).toBe(true);
    expect(((casillero as Mesh).material as Material).visible).toBe(false);

    // El modelo ocupa la caja del casillero (1 × 1,8 × 0,5 m en x = 2, z = −4,7).
    raiz.updateMatrixWorld(true);
    const caja = new Box3().setFromObject(copia as Object3D);
    expect(caja.min.y).toBeCloseTo(0);
    expect(caja.max.x).toBeLessThanOrEqual(2.5 + 1e-6);
    expect((caja.min.x + caja.max.x) / 2).toBeCloseTo(2);

    // Un rayo hacia el casillero encuentra el objeto que se toca.
    const rayo = new Raycaster(new Vector3(2, 1, 0), new Vector3(0, 0, -1));
    const choque = rayo.intersectObject(raiz, true)[0];
    expect(interactivoDe(choque?.object ?? null)?.name).toBe('porteria-casillero');
  });

  it('lo que se toca lleva materiales propios: el resaltado no se contagia', () => {
    const sala = porteriaConModelos();
    const { raiz } = construirSala(sala);
    const modelo = modeloFalso();
    aLambert(modelo);
    ponerModelos(raiz, sala, new Map([['casillero', modelo]]));
    const casillero = raiz.getObjectByName('porteria-casillero-modelo');
    if (!casillero) throw new Error('sin modelo');
    const propios = materiales(casillero);
    for (const m of materiales(modelo)) expect(propios).not.toContain(m);
  });

  it('los estantes repetidos van en una malla instanciada: una draw call para los tres', () => {
    const sala = cooperativaConEstantes();
    const { raiz } = construirSala(sala);
    const antes = dibujadas(raiz);
    const puestos = ponerModelos(raiz, sala, new Map([['estante', modeloFalso()]]));
    expect(puestos.instanciadas).toBe(1);
    const instancias = raiz.getObjectByName('estante-instancias') as InstancedMesh;
    expect(instancias).toBeInstanceOf(InstancedMesh);
    expect(instancias.count).toBe(3);
    // Las tres primitivas dejan de dibujarse y entra una sola malla.
    expect(dibujadas(raiz)).toBe(antes - 3 + 1);

    // Cada instancia queda centrada sobre su estante, con la base en el piso.
    const estantes = sala.objetos.filter((o) => o.modelo === 'estante');
    const matriz = new Matrix4();
    // La matriz de cada instancia lleva la geometría de la malla (la caja de 2 × 1 × 1 m).
    const caja = new Box3(new Vector3(-1, -0.5, -0.5), new Vector3(1, 0.5, 0.5));
    estantes.forEach((o, i) => {
      instancias.getMatrixAt(i, matriz);
      const ajustada = caja.clone().applyMatrix4(matriz);
      const centro = ajustada.getCenter(new Vector3());
      expect(centro.x).toBeCloseTo(o.pos[0]);
      expect(centro.z).toBeCloseTo(o.pos[2]);
      expect(ajustada.min.y).toBeCloseTo(0);
    });
  });

  it('liberar la sala libera también las mallas instanciadas', () => {
    const sala = cooperativaConEstantes();
    const { raiz } = construirSala(sala);
    ponerModelos(raiz, sala, new Map([['estante', modeloFalso()]]));
    const instancias = raiz.getObjectByName('estante-instancias') as InstancedMesh;
    const liberada = vi.fn();
    instancias.addEventListener('dispose', liberada);
    liberarObjeto(raiz);
    expect(liberada).toHaveBeenCalled();
  });
});

describe('vestir con modelos (T19e)', () => {
  const fuentes = (): { f: FuentesAssets; pedidas: string[] } => {
    const pedidas: string[] = [];
    return {
      pedidas,
      f: {
        indice: () => Promise.resolve(indiceDeManifiesto(MANIFIESTO)),
        textura: () => Promise.reject(new Error('sin texturas')),
        modelo: (url) => {
          pedidas.push(url);
          return url.includes('casillero')
            ? Promise.resolve(modeloFalso())
            : Promise.reject(new Error('no carga'));
        },
      },
    };
  };

  it('carga cada modelo de la carpeta de la sala; lo que falla se queda con su primitiva', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sala = porteriaConModelos();
    const { raiz } = construirSala(sala);
    const { f, pedidas } = fuentes();
    await vestirSala(raiz, sala, f);
    expect(pedidas.sort()).toEqual([
      '/assets/salas/porteria/casillero.0123abcd.glb',
      '/assets/salas/porteria/escritorio.89abcdef.glb',
    ]);
    expect(raiz.getObjectByName('porteria-casillero-modelo')).toBeDefined();
    expect(raiz.getObjectByName('porteria-escritorio-modelo')).toBeUndefined();
    const escritorio = raiz.getObjectByName('porteria-escritorio') as Mesh;
    expect((escritorio.material as Material).visible).toBe(true);
    // Lo que se descarga llega en Lambert.
    const modelo = raiz.getObjectByName('porteria-casillero-modelo') as Object3D;
    for (const m of materiales(modelo)) expect(m).toBeInstanceOf(MeshLambertMaterial);
    expect(urlsDeSala(sala, indiceDeManifiesto(MANIFIESTO))).toHaveLength(2);
  });

  it('un modelo que no está en el manifiesto no se pide', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sala = cooperativaConEstantes();
    const { raiz } = construirSala(sala);
    const { f, pedidas } = fuentes();
    await vestirSala(raiz, sala, f);
    expect(pedidas).toEqual([]);
  });
});

describe('modelos de salas.json (T19e)', () => {
  it('cada modelo que pide un objeto está publicado en la carpeta de su sala', () => {
    const indice = indiceDeManifiesto(
      JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as unknown,
    );
    for (const l of LUGARES) {
      for (const o of salaPorId(l).objetos) {
        if (!o.modelo) continue;
        expect(
          urlDeAsset(indice, `${l}/${o.modelo}`, 'glb'),
          `${o.id}: ${o.modelo}`,
        ).not.toBeNull();
      }
    }
  });
});
