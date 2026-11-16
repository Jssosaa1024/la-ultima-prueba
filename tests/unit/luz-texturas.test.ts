import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
} from 'three';
import type { Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, Texture } from 'three';
import { LUGARES } from '../../src/content/esquema-salas';
import type { Sala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { LIMITES_PANEL } from '../../src/debug/metricas';
import { indiceDeManifiesto, pedirIndice, urlDeAsset } from '../../src/engine/carga/manifiesto';
import { crearCargadorSalas } from '../../src/engine/salas/cargador';
import { construirSala, TEXTURA, uvEnMetros } from '../../src/engine/salas/construir';
import {
  crearSombras,
  MARGEN_SOMBRA,
  objetosConSombra,
  texturaSombra,
} from '../../src/engine/salas/sombras';
import { necesitaVestir, urlsDeSala, vestirSala } from '../../src/engine/salas/vestir';
import type { FuentesAssets } from '../../src/engine/salas/vestir';
import { carga } from '../../src/signals/interfaz';

// T19f (luz sin horneado y sombras de contacto) y T19g (texturas de piso, paredes y techo).

const conTexturas = (sala: Sala, metros?: number): Sala => ({
  ...sala,
  texturas: {
    piso: 'compartido/piso-madera',
    paredes: 'compartido/pared-yeso',
    techo: 'compartido/techo-placas',
    ...(metros ? { metros } : {}),
  },
});

const MANIFIESTO = {
  version: 1,
  salas: {
    compartido: {
      archivos: [
        { archivo: 'salas/compartido/piso-madera.0123abcd.ktx2' },
        { archivo: 'salas/compartido/pared-yeso.89abcdef.ktx2' },
      ],
    },
  },
};

const nombrada = (raiz: Object3D, nombre: string): Mesh => {
  const m = raiz.getObjectByName(nombre) as Mesh | undefined;
  if (!m) throw new Error(`falta ${nombre}`);
  return m;
};

const luces = (raiz: Object3D) => {
  const lista: Object3D[] = [];
  raiz.traverse((o) => {
    if ((o as { isLight?: boolean }).isLight) lista.push(o);
  });
  return lista;
};

afterEach(() => {
  carga.value = { estado: 'inactiva', progreso: 0 };
  vi.restoreAllMocks();
});

describe('luz sin horneado (T19f)', () => {
  it.each(LUGARES)('%s: una hemisférica y una direccional, sin sombras en tiempo real', (l) => {
    const { raiz } = construirSala(salaPorId(l));
    const lista = luces(raiz);
    expect(lista.map((o) => o.type).sort()).toEqual(['DirectionalLight', 'HemisphereLight']);
    for (const luz of lista) expect(luz.castShadow).toBe(false);
    raiz.traverse((o) => expect(o.castShadow).toBe(false));
  });

  it('la portería lleva sombra bajo el casillero, el escritorio y la silla', () => {
    const ids = objetosConSombra(salaPorId('porteria').objetos).map((o) => o.id);
    expect(ids).toEqual(['porteria-casillero', 'porteria-escritorio', 'porteria-silla']);
  });

  it('no hay sombra bajo lo que se recoge, los planos ni los grupos que se animan', () => {
    for (const l of LUGARES) {
      for (const o of objetosConSombra(salaPorId(l).objetos)) {
        expect(o.accion).not.toBe('recoger');
        expect(o.forma).not.toBe('plano');
        if (o.forma === 'grupo') expect(o.accion).toBeUndefined();
        expect(o.pos[1]).toBeLessThan(0.05);
      }
    }
    const ids = LUGARES.flatMap((l) => objetosConSombra(salaPorId(l).objetos).map((o) => o.id));
    expect(ids).not.toContain('s2-hoja-ayer');
    expect(ids).not.toContain('s3-postes');
    expect(ids).not.toContain('s4-carritos');
  });

  it('todas las sombras de una sala son UNA malla transparente pegada al piso', () => {
    const { raiz } = construirSala(salaPorId('s2-laboratorio'));
    const sombras = nombrada(raiz, 'sombras');
    const n = objetosConSombra(salaPorId('s2-laboratorio').objetos).length;
    expect(sombras.geometry.getAttribute('position').count).toBe(16 * n);
    const material = sombras.material as MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.map).toBeInstanceOf(DataTexture);
    sombras.geometry.computeBoundingBox();
    expect(sombras.geometry.boundingBox?.max.y).toBeLessThan(0.01);
    expect(sombras.geometry.boundingBox?.min.y).toBeGreaterThan(0);
  });

  it('la sombra rodea al mueble con su giro y el toque la atraviesa', () => {
    const sombras = crearSombras([
      { id: 's1-mesa', forma: 'caja', tam: [2, 1, 1], pos: [1, 0, -1], giro: 90, color: '#000000' },
    ]);
    if (!sombras) throw new Error('sin sombras');
    sombras.geometry.computeBoundingBox();
    const caja = sombras.geometry.boundingBox;
    // Girada 90°: el ancho (2 m) queda en z.
    expect(caja?.max.x).toBeCloseTo(1 + 0.5 + MARGEN_SOMBRA);
    expect(caja?.max.z).toBeCloseTo(-1 + 1 + MARGEN_SOMBRA);
    const rayo = new Raycaster(new Vector3(1, 2, -1), new Vector3(0, -1, 0));
    expect(rayo.intersectObject(sombras)).toHaveLength(0);
    // Mira hacia arriba: la normal de la primera cara apunta a +y.
    const p = sombras.geometry.getAttribute('position');
    const i = sombras.geometry.getIndex();
    if (!i) throw new Error('sin índice');
    const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(p, i.getX(k)));
    if (!a || !b || !c) throw new Error('sin cara');
    expect(b.clone().sub(a).cross(c.clone().sub(a)).y).toBeGreaterThan(0);
  });

  it('la textura es oscura en el centro y transparente en el borde', () => {
    const t = texturaSombra();
    const { data, width } = t.image as { data: Uint8Array; width: number };
    const alfa = (x: number, y: number) => data[(y * width + x) * 4 + 3] ?? -1;
    expect(alfa(width / 2, width / 2)).toBeGreaterThan(240);
    expect(alfa(0, width / 2)).toBeLessThan(10);
    expect(alfa(0, 0)).toBeLessThan(alfa(0, width / 2) + 1);
  });

  it('sin muebles apoyados no hay malla de sombras', () => {
    expect(crearSombras([])).toBeNull();
  });
});

describe('texturas de piso, paredes y techo (T19g)', () => {
  it('sin texturas, el cascarón sigue unido a la malla fija', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    expect(raiz.getObjectByName('piso')).toBeUndefined();
    expect(raiz.getObjectByName('paredes')).toBeUndefined();
    expect(necesitaVestir(salaPorId('porteria'))).toBe(false);
  });

  it('con textura, cada superficie queda en su malla, con su color y el id', () => {
    const sala = conTexturas(salaPorId('porteria'));
    const { raiz } = construirSala(sala);
    for (const [nombre, id, color] of [
      ['piso', 'compartido/piso-madera', sala.colores.piso],
      ['paredes', 'compartido/pared-yeso', sala.colores.paredes],
      ['techo', 'compartido/techo-placas', sala.colores.techo],
    ] as const) {
      const m = nombrada(raiz, nombre);
      expect(m.userData[TEXTURA]).toBe(id);
      expect(`#${(m.material as MeshLambertMaterial).color.getHexString()}`).toBe(color);
    }
    expect(necesitaVestir(sala)).toBe(true);
  });

  it('las paredes siguen siendo 4 cajas de colisión aunque se dibujen en una malla', () => {
    const sin = construirSala(salaPorId('s1-cooperativa'));
    const con = construirSala(conTexturas(salaPorId('s1-cooperativa')));
    expect(con.cajas).toEqual(sin.cajas);
    expect(con.triangulos).toBe(sin.triangulos);
  });

  it('las UV van en metros: el piso de 6 × 10 m repite 3 × 5 veces con 2 m', () => {
    const { raiz } = construirSala(conTexturas(salaPorId('porteria')));
    const uv = nombrada(raiz, 'piso').geometry.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(3);
    expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(5);
    const { raiz: otra } = construirSala(conTexturas(salaPorId('porteria'), 1));
    const paredes = nombrada(otra, 'paredes').geometry;
    const uv1 = paredes.getAttribute('uv');
    const normal = paredes.getAttribute('normal');
    // En las caras verticales de las paredes, v es la altura: 3,2 m con 1 m por repetición.
    const alto = Array.from({ length: uv1.count }, (_, i) => i)
      .filter((i) => Math.abs(normal.getY(i)) < 0.5)
      .map((i) => uv1.getY(i));
    expect(Math.max(...alto) - Math.min(...alto)).toBeCloseTo(3.2);
  });

  it('uvEnMetros elige el plano según la normal', () => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([4, 2, 6, 4, 2, 6, 4, 2, 6], 3));
    g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 1, 0, 0, 0, 0, 1], 3));
    uvEnMetros(g, 2);
    expect(Array.from(g.getAttribute('uv').array)).toEqual([2, 3, 3, 1, 2, 1]);
  });

  it('con texturas en las tres superficies, ninguna sala pasa de 40 draw calls', () => {
    for (const l of LUGARES) {
      const sin = construirSala(salaPorId(l));
      const con = construirSala(conTexturas(salaPorId(l)));
      expect(con.mallas).toBe(sin.mallas + 3);
      // Los 5 del cooperativo con 4 jugadores (T83b).
      expect(con.mallas + 5).toBeLessThanOrEqual(LIMITES_PANEL.drawCalls);
    }
  });
});

describe('manifiesto de assets (T19g)', () => {
  it('arma el índice y descarta rutas raras', () => {
    const indice = indiceDeManifiesto({
      salas: {
        compartido: {
          archivos: [
            ...MANIFIESTO.salas.compartido.archivos,
            { archivo: 'salas/compartido/../x.0123abcd.ktx2' },
            { archivo: 'salas/compartido/Mayus.0123abcd.ktx2' },
            { archivo: 'salas/compartido/sin-hash.ktx2' },
            { archivo: 'audio/es/x.0123abcd.m4a' },
            { archivo: 42 },
          ],
        },
        rota: null,
      },
    });
    expect([...indice.keys()]).toEqual([
      'compartido/piso-madera.ktx2',
      'compartido/pared-yeso.ktx2',
    ]);
    expect(urlDeAsset(indice, 'compartido/piso-madera', 'ktx2')).toBe(
      '/assets/salas/compartido/piso-madera.0123abcd.ktx2',
    );
    expect(urlDeAsset(indice, 'compartido/piso-madera', 'glb')).toBeNull();
    expect(indiceDeManifiesto(null).size).toBe(0);
    expect(indiceDeManifiesto({ salas: 'x' }).size).toBe(0);
  });

  it('si no se puede leer, el índice queda vacío', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await pedirIndice(() => Promise.reject(new Error('sin red')))).size).toBe(0);
    expect((await pedirIndice(() => Promise.resolve(new Response('', { status: 404 })))).size).toBe(
      0,
    );
    const bien = await pedirIndice(() => Promise.resolve(Response.json(MANIFIESTO)));
    expect(bien.size).toBe(2);
  });
});

describe('vestir la sala (T19g)', () => {
  const fuentes = (falla = false) => {
    const pedidas: string[] = [];
    const f: FuentesAssets = {
      indice: () => Promise.resolve(indiceDeManifiesto(MANIFIESTO)),
      textura: (url) => {
        pedidas.push(url);
        return falla
          ? Promise.reject(new Error('no carga'))
          : Promise.resolve(new DataTexture(new Uint8Array(4), 1, 1) as Texture);
      },
    };
    return { f, pedidas };
  };

  it('pone el mapa repetido y en blanco; lo que no está en el manifiesto queda con su color', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sala = conTexturas(salaPorId('porteria'));
    const { raiz } = construirSala(sala);
    const { f, pedidas } = fuentes();
    await vestirSala(raiz, sala, f);
    expect(pedidas.sort()).toEqual([
      '/assets/salas/compartido/pared-yeso.89abcdef.ktx2',
      '/assets/salas/compartido/piso-madera.0123abcd.ktx2',
    ]);
    const piso = nombrada(raiz, 'piso').material as MeshLambertMaterial;
    expect(piso.map).not.toBeNull();
    expect(piso.map?.wrapS).toBe(1000); // RepeatWrapping
    expect(piso.map?.colorSpace).toBe('srgb');
    expect(piso.color.getHex()).toBe(0xffffff);
    // El techo no está publicado: sigue con su color.
    const techo = nombrada(raiz, 'techo').material as MeshLambertMaterial;
    expect(techo.map).toBeNull();
    expect(`#${techo.color.getHexString()}`).toBe(sala.colores.techo);
    expect(urlsDeSala(sala, indiceDeManifiesto(MANIFIESTO))).toHaveLength(2);
  });

  it('si una textura no carga, la sala se queda con sus colores y no falla', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sala = conTexturas(salaPorId('porteria'));
    const { raiz } = construirSala(sala);
    await expect(vestirSala(raiz, sala, fuentes(true).f)).resolves.toBeUndefined();
    expect((nombrada(raiz, 'piso').material as MeshLambertMaterial).map).toBeNull();
  });

  it('el cargador viste cada sala armada una vez y precalienta la siguiente', async () => {
    const vestidas: string[] = [];
    const vestir = vi.fn((c: { id: string }) => {
      vestidas.push(c.id);
      return Promise.resolve();
    });
    const precalentar = vi.fn();
    const cargador = crearCargadorSalas({
      renderer: { compileAsync: () => Promise.resolve() },
      escena: new Scene(),
      camara: new PerspectiveCamera(),
      distribucion: salaPorId,
      construir: construirSala,
      vestir,
      precalentar,
    });
    await cargador.entrar('porteria');
    await cargador.entrar('s1-cooperativa');
    // La portería se conserva armada y vestida: volver no la viste otra vez.
    await cargador.entrar('porteria');
    expect(vestidas).toEqual(['porteria', 's1-cooperativa']);
    cargador.precargar('s2-laboratorio');
    expect(precalentar).toHaveBeenCalledTimes(1);
    cargador.liberar();
  });

  it('si vestir falla, la sala entra igual', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cargador = crearCargadorSalas({
      renderer: { compileAsync: () => Promise.resolve() },
      escena: new Scene(),
      camara: new PerspectiveCamera(),
      distribucion: salaPorId,
      construir: construirSala,
      vestir: () => Promise.reject(new Error('sin red')),
    });
    expect((await cargador.entrar('porteria'))?.id).toBe('porteria');
    cargador.liberar();
  });
});

describe('texturas de salas.json (T19g)', () => {
  it('cada textura que pide una sala está publicada en el manifiesto', () => {
    const indice = indiceDeManifiesto(
      JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as unknown,
    );
    for (const l of LUGARES) {
      const sala = salaPorId(l);
      for (const id of [sala.texturas?.piso, sala.texturas?.paredes, sala.texturas?.techo]) {
        if (id) expect(urlDeAsset(indice, id, 'ktx2'), `${l}: ${id}`).not.toBeNull();
      }
    }
  });
});
