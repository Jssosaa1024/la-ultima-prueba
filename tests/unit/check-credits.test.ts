import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { esquemaCredito, FUENTES, type Credito } from '../../scripts/creditos/esquema.ts';
import {
  listarEvidencias,
  listarPublicados,
  leerManifiestoCreditos,
} from '../../scripts/creditos/leer.ts';
import {
  creditoDe,
  problemasDeCredito,
  revisarCreditos,
  sinHash,
  textoCopyright,
} from '../../scripts/creditos/reglas.ts';
import { aplicarEtapaComun, crearIO } from '../../scripts/modelos/etapa-comun.ts';

/**
 * T11g · Esquema de art/credits.json y asset.copyright. T11h · check-credits.
 */

const raizRepo = path.join(import.meta.dirname, '..', '..');

/** Un modelo CC BY de Sketchfab bien anotado, como el ejemplo de la especificación. */
const graderia: Credito = {
  archivo: 'public/assets/salas/s3-gimnasio/graderia.glb',
  sala: 's3-gimnasio',
  tipo: 'modelo',
  titulo: 'Bleachers',
  autor: 'nombre_del_autor',
  fuente: 'sketchfab',
  url: 'https://sketchfab.com/3d-models/bleachers',
  licencia: 'CC-BY-4.0',
  licencia_url: 'https://creativecommons.org/licenses/by/4.0/',
  cambios: 'simplificado a 6k triángulos, rehorneado, texturas KTX2 1024, meshopt',
  fecha: '2026-11-05',
  plan: null,
  evidencia: 'art/evidencia/graderia.png',
};

const kenney: Credito = {
  archivo: 'public/assets/salas/s1-cooperativa/estante.glb',
  sala: 's1-cooperativa',
  tipo: 'modelo',
  titulo: 'Furniture Kit',
  autor: 'Kenney',
  fuente: 'kenney',
  url: 'https://kenney.nl/assets/furniture-kit',
  licencia: 'CC0-1.0',
  licencia_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  cambios: null,
  fecha: '2026-11-06',
  plan: null,
  evidencia: null,
};

/** Ola 6: Quaternius quedó fuera por su licencia QAL; check-credits lo rechaza. */
const quaternius: Credito = {
  archivo: 'public/assets/salas/s3-gimnasio/graderia.glb',
  sala: 's3-gimnasio',
  tipo: 'modelo',
  titulo: 'Bleachers',
  autor: 'Quaternius',
  fuente: 'quaternius',
  url: 'https://quaternius.com/',
  licencia: 'CC0-1.0',
  licencia_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  cambios: 'escala a metros, colores a la paleta de la sala',
  fecha: '2026-11-17',
  plan: null,
  evidencia: null,
};

const meshyGratis: Credito = {
  archivo: 'public/assets/salas/s2-laboratorio/probeta.glb',
  sala: 's2-laboratorio',
  tipo: 'modelo',
  titulo: 'Probeta',
  autor: 'Meshy',
  fuente: 'meshy',
  url: 'https://www.meshy.ai/',
  licencia: 'CC-BY-4.0',
  licencia_url: 'https://creativecommons.org/licenses/by/4.0/',
  cambios: 'pivote en la base, escala a metros, simplificado a 4k',
  fecha: '2026-11-07',
  plan: 'gratis',
  prompt: 'probeta de vidrio de laboratorio escolar, estilo low poly',
  evidencia: 'art/evidencia/probeta.png',
};

const EVIDENCIAS = new Set(['art/evidencia/graderia.png', 'art/evidencia/probeta.png']);

/** Problemas de una entrada, sin el prefijo del archivo. */
const problemas = (c: Credito, evidencias = EVIDENCIAS): string[] =>
  problemasDeCredito(c, evidencias).map((p) => p.slice(c.archivo.length + 2));

describe('esquema de art/credits.json (T11g)', () => {
  it('acepta las entradas bien anotadas', () => {
    for (const c of [graderia, kenney, meshyGratis]) {
      expect(esquemaCredito.safeParse(c).success, c.archivo).toBe(true);
    }
  });

  it('acepta KayKit como fuente CC0 (T19i)', () => {
    const kaykit: Credito = {
      ...kenney,
      archivo: 'public/assets/salas/porteria/silla.glb',
      titulo: 'chair_A (Furniture Bits)',
      autor: 'Kay Lousberg',
      fuente: 'kaykit',
      url: 'https://kaylousberg.itch.io/furniture-bits',
    };
    expect(FUENTES).toContain('kaykit');
    expect(esquemaCredito.safeParse(kaykit).success).toBe(true);
    expect(problemas(kaykit)).toEqual([]);
  });

  it('rechaza Quaternius con un mensaje claro, aunque diga CC0 (ola 6)', () => {
    expect(FUENTES).toContain('quaternius');
    expect(esquemaCredito.safeParse(quaternius).success).toBe(true);
    expect(problemas(quaternius)).toEqual([
      'Quaternius no se usa (decisión del 16-11-2026): su licencia QAL prohíbe redistribuir los assets y el repositorio es público',
    ]);
  });

  it('el art/credits.json del repositorio cumple el esquema y las reglas', async () => {
    const r = revisarCreditos(
      await leerManifiestoCreditos(raizRepo),
      await listarPublicados(raizRepo),
      await listarEvidencias(raizRepo),
    );
    expect(r.problemas).toEqual([]);
  });

  it('rechaza rutas fuera de salas/ y audio/, con hash o con mayúsculas', () => {
    for (const archivo of [
      'public/assets/pruebas/cubo.glb',
      'public/assets/salas/s1-cooperativa/escena.1a2b3c4d.glb',
      'public/assets/salas/s1-cooperativa/Escena.glb',
      '../secretos/escena.glb',
    ]) {
      expect(esquemaCredito.safeParse({ ...kenney, archivo }).success, archivo).toBe(false);
    }
  });

  it('solo acepta enlaces https sin comillas ni espacios', () => {
    expect(esquemaCredito.safeParse({ ...kenney, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(esquemaCredito.safeParse({ ...kenney, url: 'https://a.b/"x' }).success).toBe(false);
    expect(esquemaCredito.safeParse({ ...kenney, url: 'http://kenney.nl' }).success).toBe(false);
  });

  it('rechaza campos desconocidos, fechas mal escritas y saltos de línea', () => {
    expect(esquemaCredito.safeParse({ ...kenney, nota: 'x' }).success).toBe(false);
    expect(esquemaCredito.safeParse({ ...kenney, fecha: '6/11/2026' }).success).toBe(false);
    expect(esquemaCredito.safeParse({ ...kenney, titulo: 'a\nb' }).success).toBe(false);
    expect(
      esquemaCredito.safeParse({ ...kenney, evidencia: 'C:/capturas/kenney.png' }).success,
    ).toBe(false);
  });
});

describe('reglas de licencia (T11h)', () => {
  it('una entrada bien anotada no tiene problemas', () => {
    expect(problemas(graderia)).toEqual([]);
    expect(problemas(kenney)).toEqual([]);
    expect(problemas(meshyGratis)).toEqual([]);
  });

  it('rechaza NC y ND', () => {
    expect(problemas({ ...graderia, licencia: 'CC-BY-NC-4.0' })).toEqual([
      'la licencia CC-BY-NC-4.0 es no comercial (NC)',
    ]);
    expect(problemas({ ...graderia, licencia: 'CC-BY-ND-4.0' })).toEqual([
      'la licencia CC-BY-ND-4.0 no permite modificar (ND)',
    ]);
    expect(problemas({ ...graderia, licencia: 'CC BY-NC-ND 4.0' })).toHaveLength(2);
  });

  it('rechaza Freesound con Sampling+ y licencias fuera de la lista', () => {
    const sonido: Credito = {
      ...kenney,
      archivo: 'public/assets/audio/es-CO/s3-gimnasio/balon.m4a',
      tipo: 'audio',
      fuente: 'freesound',
      licencia: 'Sampling+',
    };
    expect(problemas(sonido)).toEqual(['Sampling+ se trata como no comercial: solo CC0 o CC BY']);
    expect(problemas({ ...kenney, licencia: 'MIT' })[0]).toContain('no está en la lista');
    expect(problemas({ ...sonido, licencia: 'propio' })).toContain(
      'de Freesound solo se publica CC0 o CC BY',
    );
  });

  it('rechaza Tripo y ElevenLabs en plan gratis', () => {
    const voz: Credito = {
      ...kenney,
      archivo: 'public/assets/audio/es-CO/porteria/voz-intro-1.m4a',
      sala: 'porteria',
      tipo: 'voz',
      titulo: 'voz-intro-1',
      autor: null,
      fuente: 'elevenlabs',
      url: null,
      licencia: 'elevenlabs-pago',
      licencia_url: null,
      plan: 'gratis',
      prompt: 'Buenas noches. Llegas tarde, como siempre a lo importante.',
      evidencia: 'art/evidencia/probeta.png',
    };
    expect(problemas(voz)).toEqual([
      'elevenlabs en plan gratis no permite uso comercial: hay que regenerarlo con plan de pago',
    ]);
    expect(problemas({ ...voz, plan: 'pago' })).toEqual([]);
    const tripo: Credito = { ...meshyGratis, fuente: 'tripo', licencia: 'tripo-pago' };
    expect(problemas(tripo)).toContain(
      'tripo en plan gratis no permite uso comercial: hay que regenerarlo con plan de pago',
    );
  });

  it('exige el plan en Meshy, Tripo y ElevenLabs', () => {
    expect(problemas({ ...meshyGratis, plan: null })[0]).toContain('falta «plan»');
  });

  it('Meshy en plan gratis exige el crédito a Meshy', () => {
    expect(problemas({ ...meshyGratis, autor: 'Ana' })).toEqual([
      'Meshy en plan gratis exige el crédito: autor «Meshy»',
    ]);
    expect(problemas({ ...meshyGratis, plan: 'pago' })).toEqual([
      'Meshy en plan de pago se anota como meshy-pago',
    ]);
  });

  it('CC BY exige autor, URL, cambios y enlace a la licencia', () => {
    expect(
      problemas({ ...graderia, autor: null, url: null, cambios: null, licencia_url: null }),
    ).toEqual([
      'CC BY exige el autor',
      'CC BY exige la URL del original',
      'CC BY exige indicar los cambios',
      'CC BY exige el enlace a la licencia',
    ]);
  });

  it('exige la captura de la licencia en Sketchfab, Meshy y ElevenLabs, y que exista', () => {
    expect(problemas({ ...graderia, evidencia: null })).toEqual([
      'falta la captura de la licencia en art/evidencia/ (obligatoria para sketchfab)',
    ]);
    expect(problemas(graderia, new Set())).toEqual([
      'no existe la captura art/evidencia/graderia.png',
    ]);
  });

  it('exige el prompt en lo generado con IA', () => {
    const sinPrompt: Credito = { ...meshyGratis };
    delete sinPrompt.prompt;
    expect(problemas(sinPrompt)).toEqual(['falta el prompt con que se generó']);
  });

  it('las licencias de una herramienta solo valen con esa fuente', () => {
    expect(problemas({ ...kenney, licencia: 'openai' })).toEqual([
      'la licencia openai no corresponde a la fuente kenney',
    ]);
  });

  it('rechaza fechas que no existen', () => {
    expect(problemas({ ...kenney, fecha: '2026-13-40' })).toEqual([
      'la fecha 2026-13-40 no existe',
    ]);
  });
});

describe('revisarCreditos (T11h)', () => {
  it('cada archivo publicado necesita su entrada, con o sin hash en el nombre', () => {
    const r = revisarCreditos(
      [kenney],
      [
        'public/assets/salas/s1-cooperativa/estante.0a1b2c3d.glb',
        'public/assets/salas/s1-cooperativa/caja.9f8e7d6c.glb',
      ],
      EVIDENCIAS,
    );
    expect(r.problemas).toEqual([
      'public/assets/salas/s1-cooperativa/caja.9f8e7d6c.glb: no tiene entrada en art/credits.json',
    ]);
  });

  it('avisa, sin fallar, de entradas que todavía no se publican', () => {
    const r = revisarCreditos([kenney, graderia], [], EVIDENCIAS);
    expect(r.problemas).toEqual([]);
    expect(r.avisos).toHaveLength(2);
  });

  it('rechaza entradas repetidas y un manifiesto mal escrito', () => {
    expect(revisarCreditos([kenney, kenney], [], EVIDENCIAS).problemas).toEqual([
      `${kenney.archivo}: tiene dos entradas`,
    ]);
    expect(revisarCreditos({ creditos: [] }, [], EVIDENCIAS).problemas[0]).toContain(
      'art/credits.json',
    );
    expect(revisarCreditos([{ ...kenney, tipo: 'video' }], [], EVIDENCIAS).problemas[0]).toContain(
      '[0.tipo]',
    );
  });

  it('quita el hash de build-manifest del nombre', () => {
    expect(sinHash('public/assets/salas/s1-cooperativa/escena.1a2b3c4d.glb')).toBe(
      'public/assets/salas/s1-cooperativa/escena.glb',
    );
    expect(sinHash('public/assets/audio/es-CO/comun/voz-espera.m4a')).toBe(
      'public/assets/audio/es-CO/comun/voz-espera.m4a',
    );
    expect(creditoDe([kenney], 'public/assets/salas/s1-cooperativa/estante.0a1b2c3d.glb')).toBe(
      kenney,
    );
    expect(creditoDe([kenney], 'public/assets/salas/s1-cooperativa/otro.glb')).toBeNull();
  });
});

describe('asset.copyright (T11g)', () => {
  it('arma el crédito con título, autor, fuente, licencia y si se modificó', () => {
    expect(textoCopyright(graderia)).toBe(
      '“Bleachers”, nombre_del_autor, https://sketchfab.com/3d-models/bleachers, ' +
        'CC BY 4.0 https://creativecommons.org/licenses/by/4.0/, modificado',
    );
    expect(textoCopyright(kenney)).toBe(
      '“Furniture Kit”, Kenney, https://kenney.nl/assets/furniture-kit, ' +
        'CC0 1.0 https://creativecommons.org/publicdomain/zero/1.0/',
    );
  });

  it('la etapa común lo escribe en el GLB y se vuelve a leer', async () => {
    const documento = new Document();
    const escena = documento.createScene('sala');
    documento.getRoot().setDefaultScene(escena);
    escena.addChild(documento.createNode('vacio'));
    await aplicarEtapaComun(documento, { copyright: textoCopyright(kenney) });

    const io = await crearIO();
    const leido = await io.readBinary(await io.writeBinary(documento));
    expect(leido.getRoot().getAsset().copyright).toBe(textoCopyright(kenney));
  });

  it('sin crédito, la etapa común no inventa uno', async () => {
    const documento = new Document();
    documento.getRoot().setDefaultScene(documento.createScene('sala'));
    await aplicarEtapaComun(documento);
    expect(documento.getRoot().getAsset().copyright).toBeUndefined();
  });
});

// Cada caso lanza un proceso de Node: con el equipo ocupado tarda más de los 5 s por defecto.
describe('npm run check-credits (T11h)', { timeout: 30_000 }, () => {
  const ejecutar = promisify(execFile);
  let raiz = '';

  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), 'check-credits-'));
    await mkdir(path.join(raiz, 'art', 'evidencia'), { recursive: true });
    await mkdir(path.join(raiz, 'public', 'assets', 'salas', 's1-cooperativa'), {
      recursive: true,
    });
  });
  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  const correr = async (): Promise<{ codigo: number; salida: string }> => {
    const script = path.join(raizRepo, 'scripts', 'check-credits.ts');
    try {
      const { stdout, stderr } = await ejecutar(process.execPath, [script, '--raiz', raiz]);
      return { codigo: 0, salida: stdout + stderr };
    } catch (e) {
      const error = e as { code: number; stdout: string; stderr: string };
      return { codigo: error.code, salida: error.stdout + error.stderr };
    }
  };

  it('pasa con cada archivo anotado y falla si falta uno', async () => {
    const glb = path.join(
      raiz,
      'public',
      'assets',
      'salas',
      's1-cooperativa',
      'estante.0a1b2c3d.glb',
    );
    await writeFile(glb, 'x');
    await writeFile(path.join(raiz, 'art', 'credits.json'), JSON.stringify([kenney]));
    expect(await correr()).toMatchObject({ codigo: 0 });

    await writeFile(path.join(raiz, 'art', 'credits.json'), '[]');
    const r = await correr();
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain('estante.0a1b2c3d.glb: no tiene entrada');
  });

  it('falla si no hay manifiesto', async () => {
    const r = await correr();
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain('no pude leer art/credits.json');
  });

  it('el build corre check-credits antes de astro build', async () => {
    const paquete = JSON.parse(await readFile(path.join(raizRepo, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    for (const nombre of ['build', 'verify']) {
      const comando = paquete.scripts[nombre] ?? '';
      expect(comando, nombre).toContain('npm run check-credits');
      expect(comando.indexOf('check-credits'), nombre).toBeLessThan(comando.indexOf('astro build'));
    }
  });
});
