import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { datosDelBuild, NUCLEO_FIJO, textoSW, type DatosSW } from '../../scripts/pwa/integracion';

// T94: el service worker propio. Se corre la plantilla real en un contexto aislado con
// `caches` y `fetch` falsos.

const PLANTILLA = await readFile('scripts/pwa/sw.js', 'utf8');

type Respuesta = { ok: boolean; status: number; type: string; clone(): Respuesta; cuerpo: string };
const respuesta = (cuerpo: string, status = 200): Respuesta => ({
  ok: status >= 200 && status < 300,
  status,
  type: 'basic',
  cuerpo,
  clone() {
    return this;
  },
});

const clave = (x: unknown): string =>
  typeof x === 'string' ? x : new URL((x as { url: string }).url).pathname;

/** Un service worker de un build, con su propio almacén de cachés compartido entre versiones. */
function cargarSW(
  datos: DatosSW,
  almacen: Map<string, Map<string, Respuesta>>,
  red: () => boolean,
) {
  const oyentes: Record<string, (e: unknown) => void> = {};
  const abrir = (n: string) => {
    const c = almacen.get(n) ?? new Map<string, Respuesta>();
    almacen.set(n, c);
    return {
      put: async (k: unknown, r: Respuesta) => void c.set(clave(k), r),
      addAll: async (ks: unknown[]) => {
        for (const k of ks) c.set(clave(k), respuesta(`red:${clave(k)}`));
      },
      keys: async () => [...c.keys()].map((k) => ({ url: `https://sitio${k}` })),
      delete: async (k: unknown) => c.delete(clave(k)),
    };
  };
  const contexto = {
    URL,
    Request: class {
      url: string;
      constructor(u: string) {
        this.url = `https://sitio${u}`;
      }
    },
    self: {
      __SW__: datos,
      location: { origin: 'https://sitio' },
      clients: { claim: async () => undefined },
      addEventListener: (t: string, fn: (e: unknown) => void) => (oyentes[t] = fn),
    },
    caches: {
      open: async (n: string) => abrir(n),
      keys: async () => [...almacen.keys()],
      delete: async (n: string) => almacen.delete(n),
      match: async (k: unknown) => {
        for (const c of almacen.values()) {
          const r = c.get(clave(k));
          if (r) return r;
        }
        return undefined;
      },
    },
    fetch: async (k: unknown) => {
      if (!red()) throw new TypeError('sin red');
      return respuesta(`red:${clave(k)}`);
    },
  };
  runInNewContext(PLANTILLA, contexto);
  const esperar = async (tipo: string, extra: object = {}) => {
    let promesa: Promise<unknown> = Promise.resolve();
    oyentes[tipo]?.({ waitUntil: (p: Promise<unknown>) => (promesa = p), ...extra });
    await promesa;
  };
  return {
    instalar: () => esperar('install'),
    activar: () => esperar('activate'),
    async pedir(ruta: string, navegar = false): Promise<string | 'sin-respuesta'> {
      let r: Promise<Respuesta> | null = null;
      oyentes['fetch']?.({
        request: {
          url: `https://sitio${ruta}`,
          method: 'GET',
          mode: navegar ? 'navigate' : 'cors',
          headers: { has: () => false },
        },
        respondWith: (p: Promise<Respuesta>) => (r = p),
      });
      if (!r) return 'sin-respuesta';
      return (await (r as Promise<Respuesta>)).cuerpo;
    },
  };
}

const v1: DatosSW = {
  version: 'v1',
  nucleo: ['/', '/jugar/', '/_astro/motor.AAAAAAAA.js'],
  salas: ['/assets/salas/s1/escena.11111111.glb'],
};
const v2: DatosSW = {
  version: 'v2',
  nucleo: ['/', '/jugar/', '/_astro/motor.BBBBBBBB.js'],
  salas: ['/assets/salas/s1/escena.22222222.glb'],
};

describe('service worker', () => {
  it('guarda el núcleo al instalarse y lo sirve sin red', async () => {
    let hayRed = true;
    const almacen = new Map();
    const sw = cargarSW(v1, almacen, () => hayRed);
    await sw.instalar();
    await sw.activar();
    hayRed = false;
    expect(await sw.pedir('/jugar/', true)).toBe('red:/jugar/');
    // `/jugar` sin barra y con parámetros es la misma página.
    expect(await sw.pedir('/jugar', true)).toBe('red:/jugar/');
    expect(await sw.pedir('/_astro/motor.AAAAAAAA.js')).toBe('red:/_astro/motor.AAAAAAAA.js');
  });

  it('las páginas van primero a la red: una versión nueva no queda tapada', async () => {
    const almacen = new Map([['nucleo-v1', new Map([['/jugar/', respuesta('vieja')]])]]);
    const sw = cargarSW(v1, almacen, () => true);
    expect(await sw.pedir('/jugar/', true)).toBe('red:/jugar/');
    // Y la copia guardada queda al día para cuando no haya red.
    expect(almacen.get('nucleo-v1')?.get('/jugar/')?.cuerpo).toBe('red:/jugar/');
  });

  it('guarda las salas visitadas y las sirve sin red', async () => {
    let hayRed = true;
    const sw = cargarSW(v1, new Map(), () => hayRed);
    await sw.instalar();
    expect(await sw.pedir('/assets/salas/s1/escena.11111111.glb')).toContain('escena');
    hayRed = false;
    expect(await sw.pedir('/assets/salas/s1/escena.11111111.glb')).toContain('escena');
    // Lo que no se visitó no está.
    await expect(sw.pedir('/assets/salas/s2/escena.33333333.glb')).rejects.toThrow('sin red');
  });

  it('al activar una versión nueva borra el núcleo viejo y las salas que ya no existen', async () => {
    const almacen = new Map();
    const viejo = cargarSW(v1, almacen, () => true);
    await viejo.instalar();
    await viejo.activar();
    await viejo.pedir('/assets/salas/s1/escena.11111111.glb');
    await viejo.pedir('/assets/manifest.json');

    const nuevo = cargarSW(v2, almacen, () => true);
    await nuevo.instalar();
    // Mientras la versión nueva espera, la vieja sigue completa (una partida abierta la usa).
    expect([...almacen.keys()].sort()).toEqual(['nucleo-v1', 'nucleo-v2', 'salas']);
    await nuevo.activar();
    expect([...almacen.keys()].sort()).toEqual(['nucleo-v2', 'salas']);
    expect([...almacen.get('salas').keys()]).toEqual(['/assets/manifest.json']);
  });

  it('no responde lo que no es del sitio ni lo que no conoce', async () => {
    const sw = cargarSW(v1, new Map(), () => true);
    expect(await sw.pedir('/docentes/datos.json')).toBe('sin-respuesta');
  });

  it('nunca toca la partida guardada ni otros datos del navegador', () => {
    // Sin los comentarios, que sí los nombran para explicarlo.
    const codigo = PLANTILLA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/localStorage|sessionStorage|indexedDB|skipWaiting/);
  });
});

describe('integración del build', () => {
  let raiz = '';
  beforeAll(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'sw-'));
    for (const ruta of [
      ...NUCLEO_FIJO,
      '/_astro/a.12345678.js',
      '/assets/salas/s1/e.12345678.glb',
    ]) {
      const archivo = path.join(raiz, ruta.endsWith('/') ? ruta + 'index.html' : ruta);
      await mkdir(path.dirname(archivo), { recursive: true });
      await writeFile(archivo, ruta);
    }
  });
  afterAll(() => rm(raiz, { recursive: true, force: true }));

  it('lista el núcleo y las salas, y la versión cambia solo si cambia algo', async () => {
    const a = await datosDelBuild(raiz, PLANTILLA);
    expect(a.nucleo).toContain('/_astro/a.12345678.js');
    expect(a.nucleo).toContain('/jugar/');
    expect(a.salas).toEqual(['/assets/salas/s1/e.12345678.glb']);
    expect((await datosDelBuild(raiz, PLANTILLA)).version).toBe(a.version);
    await writeFile(path.join(raiz, 'jugar', 'index.html'), 'otra');
    expect((await datosDelBuild(raiz, PLANTILLA)).version).not.toBe(a.version);
    expect(textoSW(a, PLANTILLA).startsWith('self.__SW__ = {')).toBe(true);
  });
});
