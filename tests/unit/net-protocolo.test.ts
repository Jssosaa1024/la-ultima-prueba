import { describe, expect, it } from 'vitest';
import {
  ALFABETO_CODIGO,
  bytes,
  crearCodigo,
  crearJugador,
  directo,
  esCodigo,
  esIdentidad,
  evento,
  intencion,
  leerCodigo,
  MAX_BYTES,
  MAX_BYTES_ESTADO,
  validar,
  VERSION_CONTENIDO,
  VERSION_PROTOCOLO,
} from '../../src/net/protocolo';
import type { Foto } from '../../src/game/coop/mensajes';

/** T80 · Sobre de mensajes y validación estricta de lo que llega por la red. */

const J1 = 'j_aaaa1111';
const J2 = 'j_bbbb2222';

const fotoBase = (): Foto => ({
  fase: 'jugando',
  anfitrion: J1,
  orden: [J1, J2],
  listos: [J1, J2],
  lugar: 's1-cooperativa',
  etapas: [1, 0, 0, 0, 0],
  grabaciones: [],
  final: null,
  reloj: { restante_ms: 2_000_000, pausado: false },
  objetos: [{ objeto: 'porteria-linterna', portador: J2, sala: 'porteria' }],
  revelados: ['s1-pizarra'],
  propuesta: {
    id: 3,
    puzzle: 's1-etiquetadora',
    etapa: 1,
    por: J2,
    estado: { producto: 'empanada', precio: 1600, rodillos: [25] },
    votos: [{ jugador: J1, acepta: true }],
  },
  pistas: Array.from({ length: 5 }, () => ({ ofrecidas: 0, vistas: 0, ms: 0, intentos: 0 })),
  votos: [{ asunto: 'sala', opcion: 'porteria', votos: [J1] }],
  ausentes: [],
});

describe('código de partida', () => {
  it('el alfabeto no tiene 0, O, 1, I ni L', () => {
    for (const c of '0O1IL') expect(ALFABETO_CODIGO).not.toContain(c);
    expect(ALFABETO_CODIGO).toHaveLength(31);
  });

  it('acepta 4 caracteres del alfabeto y nada más', () => {
    expect(esCodigo('K7MP')).toBe(true);
    for (const malo of ['K7M', 'K7MPX', 'k7mp', 'K0MP', 'KOMP', 'K1MP', 'KIMP', 'KLMP', 'K7M ', 12])
      expect(esCodigo(malo), String(malo)).toBe(false);
  });

  it('leerCodigo pasa a mayúsculas y rechaza lo raro', () => {
    expect(leerCodigo(' k7mp ')).toBe('K7MP');
    expect(leerCodigo('<b>')).toBeNull();
    expect(leerCodigo('K7MP"onload=')).toBeNull();
    expect(leerCodigo(null)).toBeNull();
  });

  it('crearCodigo siempre da un código válido', () => {
    let s = 0;
    const azar = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 500; i++) expect(esCodigo(crearCodigo(azar))).toBe(true);
    expect(esCodigo(crearCodigo(() => 0.9999999))).toBe(true);
  });
});

describe('identidad de Presence', () => {
  const id = {
    jugador: crearJugador(),
    alias: 'zorro',
    color: 'ambar',
    unido_en: 1_700_000_000_000,
    version_contenido: VERSION_CONTENIDO,
  };

  it('acepta solo alias y colores de la lista, sin campos de más', () => {
    expect(esIdentidad(id)).toBe(true);
    expect(esIdentidad({ ...id, alias: 'Pedro Pérez' })).toBe(false);
    expect(esIdentidad({ ...id, color: '#ff0000' })).toBe(false);
    expect(esIdentidad({ ...id, nombre: 'Ana' })).toBe(false);
    expect(esIdentidad({ ...id, jugador: 'admin' })).toBe(false);
  });
});

describe('sobre de intenciones (int)', () => {
  const ok = (t: object) => validar('int', { v: 1, de: J1, cid: `${J1}-1`, n: null, ...t });

  it('acepta cada tipo de la especificación con contenido válido', () => {
    const validas = [
      { t: 'listo', p: { listo: true } },
      { t: 'recoger', p: { objeto: 'porteria-linterna' } },
      { t: 'pasar', p: { objeto: 'porteria-linterna', a: J2 } },
      { t: 'usar', p: { herramienta: 'porteria-linterna', objetivo: 's1-pizarra' } },
      { t: 'usar', p: { herramienta: null, objetivo: 's2-gabinete' } },
      {
        t: 'proponer',
        p: {
          puzzle: 's1-etiquetadora',
          etapa: 0,
          estado: { producto: 'jugo', precio: 2000, rodillos: [-20] },
        },
      },
      { t: 'confirmar', p: { propuesta: 1, acepta: false } },
      { t: 'pedir_pista', p: { puzzle: 's3-reflector' } },
      { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } },
      { t: 'votar', p: { asunto: 'sala', opcion: 's2-laboratorio', acepta: true } },
      { t: 'votar', p: { asunto: 'final', opcion: 'restaurar', acepta: true } },
      { t: 'pedir_estado', p: { desde_n: 41 } },
    ];
    for (const m of validas) expect(ok(m), JSON.stringify(m)).toMatchObject({ ok: true });
  });

  it('no existe la intención nota: las notas del cuaderno no viajan', () => {
    expect(ok({ t: 'nota', p: { op: 'agregar', id: 1, texto: 'hola' } })).toEqual({
      ok: false,
      motivo: 'tipo',
    });
  });

  it('rechaza ids que no están en las listas', () => {
    expect(ok({ t: 'recoger', p: { objeto: 's9-cosa' } })).toMatchObject({ ok: false });
    expect(ok({ t: 'recoger', p: { objeto: '<img src=x>' } })).toMatchObject({ ok: false });
    expect(ok({ t: 'pedir_pista', p: { puzzle: 's6-nada' } })).toMatchObject({ ok: false });
    expect(ok({ t: 'pasar', p: { objeto: 'porteria-linterna', a: 'todos' } })).toMatchObject({
      ok: false,
    });
    expect(ok({ t: 'votar', p: { asunto: 'sala', opcion: 'patio', acepta: true } })).toMatchObject({
      ok: false,
    });
    expect(ok({ t: 'votar', p: { asunto: 'pausa', opcion: 'salir', acepta: true } })).toMatchObject(
      { ok: false },
    );
  });

  it('el estado de proponer debe tener la forma exacta de los controles de la etapa', () => {
    const p = (estado: unknown, etapa = 0) =>
      ok({ t: 'proponer', p: { puzzle: 's1-etiquetadora', etapa, estado } });
    expect(p({ producto: 'jugo', precio: 2000, rodillos: [33] })).toMatchObject({ ok: false });
    expect(p({ producto: 'jugo', precio: 1, rodillos: [] })).toMatchObject({ ok: false });
    expect(p({ producto: 'jugo', precio: 2000, rodillos: [], texto: 'x' })).toMatchObject({
      ok: false,
    });
    expect(p({ producto: 'jugo', precio: 2000, rodillos: [] }, 3)).toMatchObject({ ok: false });
  });

  it('rechaza versión, campos de más o de menos, y cid de otro jugador', () => {
    const base = { v: 1, t: 'listo', de: J1, cid: `${J1}-1`, n: null, p: { listo: true } };
    expect(validar('int', base)).toMatchObject({ ok: true });
    expect(validar('int', { ...base, v: 2 })).toEqual({ ok: false, motivo: 'version' });
    expect(validar('int', { ...base, extra: 1 })).toEqual({ ok: false, motivo: 'forma' });
    expect(validar('int', { ...base, p: { listo: true, x: 1 } })).toEqual({
      ok: false,
      motivo: 'contenido',
    });
    expect(validar('int', { ...base, cid: `${J2}-1` })).toEqual({ ok: false, motivo: 'cid' });
    expect(validar('int', { ...base, cid: `${J1}-x` })).toEqual({ ok: false, motivo: 'cid' });
    expect(validar('int', { ...base, n: 4 })).toEqual({ ok: false, motivo: 'sobre' });
    expect(validar('int', { ...base, de: 'j_' })).toEqual({ ok: false, motivo: 'de' });
    expect(validar('int', null)).toEqual({ ok: false, motivo: 'forma' });
    expect(validar('int', [base])).toEqual({ ok: false, motivo: 'forma' });
  });

  it('una intención no puede viajar por evt ni por dir', () => {
    const m = intencion(J1, `${J1}-1`, { t: 'listo', p: { listo: true } });
    expect(validar('evt', m)).toMatchObject({ ok: false });
    expect(validar('dir', m)).toMatchObject({ ok: false });
  });
});

describe('sobre de eventos (evt)', () => {
  it('acepta cada tipo y exige n creciente sin cid', () => {
    const eventos = [
      evento(J1, 1, { t: 'inicio', p: { orden: [J1, J2], restante_ms: 2_400_000 } }),
      evento(J1, 2, { t: 'roles', p: { sala: 1, A: J1, B: J1, C: J2, D: J2 } }),
      evento(J1, 3, {
        t: 'objeto',
        p: { objeto: 'porteria-linterna', portador: null, sala: 'porteria' },
      }),
      evento(J1, 4, { t: 'revelado', p: { objeto: 's1-pizarra', por: J2 } }),
      evento(J1, 5, {
        t: 'propuesta',
        p: {
          id: 1,
          puzzle: 's1-etiquetadora',
          etapa: 0,
          por: J2,
          estado: { producto: 'jugo', precio: 2000, rodillos: [-20] },
        },
      }),
      evento(J1, 6, { t: 'confirmacion', p: { propuesta: 1, jugador: J1, acepta: true } }),
      evento(J1, 7, {
        t: 'resultado',
        p: {
          puzzle: 's1-etiquetadora',
          etapa: 0,
          condiciones: { precio: true },
          resuelta: true,
          sello: false,
        },
      }),
      evento(J1, 8, { t: 'pista', p: { puzzle: 's1-etiquetadora', nivel: 1 } }),
      evento(J1, 9, {
        t: 'voto',
        p: { asunto: 'ayuda', opcion: null, votos: [J1], resuelto: false },
      }),
      evento(J1, 10, { t: 'reloj', p: { restante_ms: 100, pausado: true } }),
      evento(J1, 11, { t: 'grabacion', p: { fragmento: 'grab-2', por: J2 } }),
      evento(J1, 12, { t: 'final', p: { final: 'el_legado' } }),
      evento(J1, 13, { t: 'anfitrion', p: { jugador: J2 } }),
      evento(J1, 14, { t: 'rechazo', p: { a: J2, motivo: 'llena' } }),
      evento(J1, 15, { t: 'estado', p: fotoBase() }),
    ];
    for (const e of eventos) expect(validar('evt', e), e.t).toMatchObject({ ok: true });
    expect(validar('evt', { ...eventos[0], n: 0 })).toMatchObject({ ok: false });
    expect(validar('evt', { ...eventos[0], n: null })).toMatchObject({ ok: false });
    expect(validar('evt', { ...eventos[0], cid: 'x' })).toMatchObject({ ok: false });
  });

  it('no existe el evento nota', () => {
    expect(validar('evt', { v: 1, t: 'nota', de: J1, cid: null, n: 1, p: {} })).toEqual({
      ok: false,
      motivo: 'tipo',
    });
  });

  it('las condiciones del resultado solo admiten ids cortos con booleanos', () => {
    const r = (condiciones: unknown) =>
      validar(
        'evt',
        evento(J1, 1, {
          t: 'resultado',
          p: {
            puzzle: 's1-etiquetadora',
            etapa: 0,
            condiciones: condiciones as Record<string, boolean>,
            resuelta: false,
            sello: false,
          },
        }),
      );
    expect(r({ precio: false })).toMatchObject({ ok: true });
    expect(r({ 'Hola mundo': true })).toMatchObject({ ok: false });
    expect(r({ precio: 'sí' })).toMatchObject({ ok: false });
    expect(r({})).toMatchObject({ ok: false });
  });

  it('la foto revisa cada campo', () => {
    const f = (cambio: Partial<Foto>) =>
      validar('evt', evento(J1, 1, { t: 'estado', p: { ...fotoBase(), ...cambio } }));
    expect(f({})).toMatchObject({ ok: true });
    expect(f({ etapas: [4, 0, 0, 0, 0] })).toMatchObject({ ok: false });
    expect(f({ etapas: [0, 0, 0, 0] })).toMatchObject({ ok: false });
    expect(f({ orden: [J1, J1] })).toMatchObject({ ok: false });
    expect(f({ grabaciones: ['grab-9' as 'grab-1'] })).toMatchObject({ ok: false });
    expect(f({ revelados: ['javascript:alert(1)'] })).toMatchObject({ ok: false });
  });
});

describe('sobre de directos (dir)', () => {
  it('acepta pose y señal en cm enteros y frases de la lista', () => {
    expect(
      validar('dir', directo(J1, { t: 'pose', p: { s: 1, x: 120, y: 0, z: -340, yaw: 9000 } })),
    ).toMatchObject({ ok: true });
    expect(
      validar('dir', directo(J1, { t: 'senal', p: { s: 1, x: 0, y: 0, z: 0, frase: 'mira' } })),
    ).toMatchObject({ ok: true });
    expect(
      validar('dir', directo(J1, { t: 'pose', p: { s: 1, x: 1.5, y: 0, z: 0, yaw: 0 } })),
    ).toMatchObject({ ok: false });
    expect(
      validar(
        'dir',
        directo(J1, { t: 'senal', p: { s: 1, x: 0, y: 0, z: 0, frase: 'texto libre' as 'mira' } }),
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('tamaño', () => {
  it('rechaza mensajes de más de 1 KB y fotos de más de 8 KB', () => {
    expect(VERSION_PROTOCOLO).toBe(1);
    const grande = {
      v: 1,
      t: 'listo',
      de: J1,
      cid: `${J1}-1`,
      n: null,
      p: { listo: true, relleno: 'x'.repeat(MAX_BYTES) },
    };
    expect(validar('int', grande)).toEqual({ ok: false, motivo: 'tamano' });
    const foto = evento(J1, 1, { t: 'estado', p: fotoBase() });
    expect(bytes(foto)).toBeGreaterThan(0);
    expect(bytes(foto)).toBeLessThan(MAX_BYTES_ESTADO);
    const enorme = { ...foto, p: { ...fotoBase(), relleno: 'x'.repeat(MAX_BYTES_ESTADO) } };
    expect(validar('evt', enorme)).toEqual({ ok: false, motivo: 'tamano' });
  });

  it('cuenta bytes en UTF-8, no caracteres', () => {
    expect(bytes('ñ')).toBe(4);
    const circular: Record<string, unknown> = {};
    circular['a'] = circular;
    expect(bytes(circular)).toBe(Number.POSITIVE_INFINITY);
  });
});
