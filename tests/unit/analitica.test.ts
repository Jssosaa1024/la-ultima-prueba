import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  esConteo,
  EVENTOS_ANALITICA,
  RANGOS_DURACION,
  rangoDuracion,
  salaCorta,
  SALAS_ANALITICA,
  type Conteo,
} from '../../src/game/analitica';
import { crearContador } from '../../src/net/analitica';
import { iniciarAnalitica } from '../../src/signals/analitica';
import { coop, COOP_INICIAL } from '../../src/signals/coop';
import {
  DURACION_MS,
  fase,
  modo,
  reiniciarPartida,
  reloj,
  sellos,
} from '../../src/signals/partida';

/** T98 · Analítica sin cookies ni datos personales: contadores agregados de una lista cerrada. */

const SQL = readFileSync('supabase/migrations/20261116120000_analitica.sql', 'utf8');
const ENTORNO = { url: 'https://abcdefghijkl.supabase.co', clave: 'eyJ'.padEnd(40, 'x') };

describe('T98 · qué se cuenta (lista cerrada)', () => {
  it('rangos de duración en minutos de reloj', () => {
    expect(rangoDuracion(0)).toBe('0-10');
    expect(rangoDuracion(9 * 60_000 + 59_999)).toBe('0-10');
    expect(rangoDuracion(10 * 60_000)).toBe('10-20');
    expect(rangoDuracion(25 * 60_000)).toBe('20-30');
    expect(rangoDuracion(DURACION_MS)).toBe('30-40');
    expect(rangoDuracion(-5)).toBe('0-10');
    expect(rangoDuracion(Number.NaN)).toBe('0-10');
  });

  it('la sala corta sale del id de la sala', () => {
    expect(salaCorta('s1-cooperativa')).toBe('s1');
    expect(salaCorta('s5-rectoria')).toBe('s5');
    expect(salaCorta('porteria')).toBeNull();
    expect(salaCorta('s9-x')).toBeNull();
  });

  it('solo pasan conteos de la lista, sin campos de más', () => {
    expect(esConteo({ evento: 'partida_iniciada', modo: 'solo', detalle: '' })).toBe(true);
    expect(esConteo({ evento: 'sala_resuelta', modo: 'grupo', detalle: 's3' })).toBe(true);
    expect(esConteo({ evento: 'partida_terminada', modo: 'solo', detalle: '20-30' })).toBe(true);
    expect(esConteo({ evento: 'sala_resuelta', modo: 'solo', detalle: 's6' })).toBe(false);
    expect(esConteo({ evento: 'partida_iniciada', modo: 'solo', detalle: 'hola' })).toBe(false);
    expect(esConteo({ evento: 'otro', modo: 'solo', detalle: '' })).toBe(false);
    expect(esConteo({ evento: 'partida_iniciada', modo: 'pareja', detalle: '' })).toBe(false);
    expect(
      esConteo({ evento: 'partida_iniciada', modo: 'solo', detalle: '', jugador: 'j_1' }),
    ).toBe(false);
  });

  it('la función SQL acepta exactamente las mismas listas', () => {
    for (const e of EVENTOS_ANALITICA) expect(SQL).toContain(`'${e}'`);
    for (const s of SALAS_ANALITICA) expect(SQL).toContain(`'${s}'`);
    for (const r of RANGOS_DURACION) expect(SQL).toContain(`'${r}'`);
    expect(SQL).toContain("modo not in ('solo', 'grupo')");
  });

  it('el SQL no guarda nada personal y la tabla no se lee desde la API', () => {
    const tabla = SQL.match(/create table[\s\S]*?\);/)?.[0] ?? '';
    expect(tabla).not.toMatch(/\b(jugador|codigo|ip|agente|user_?agent|alias)\b/i);
    expect(SQL).toContain(
      'revoke all on table public.analitica_contadores from anon, authenticated',
    );
    expect(SQL).toContain('enable row level security');
    expect(SQL).toMatch(
      /grant execute on function public\.contar_evento\(text, text, text\) to anon/,
    );
  });
});

describe('T98 · envío a Supabase', () => {
  it('sin variables de Supabase no hace nada', () => {
    const llamadas: unknown[] = [];
    const contar = crearContador({}, async (...a) => void llamadas.push(a));
    contar({ evento: 'partida_iniciada', modo: 'solo', detalle: '' });
    expect(llamadas).toEqual([]);
  });

  it('llama a contar_evento con la clave pública, sin cookies ni referer', () => {
    const llamadas: [string, RequestInit][] = [];
    const contar = crearContador(ENTORNO, async (url, init) => void llamadas.push([url, init]));
    contar({ evento: 'sala_resuelta', modo: 'grupo', detalle: 's2' });
    expect(llamadas).toHaveLength(1);
    const [url, init] = llamadas[0] ?? ['', {}];
    expect(url).toBe('https://abcdefghijkl.supabase.co/rest/v1/rpc/contar_evento');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual({
      evento: 'sala_resuelta',
      modo: 'grupo',
      detalle: 's2',
    });
    const cabeceras = init.headers as Record<string, string>;
    expect(Object.keys(cabeceras).sort()).toEqual(['Authorization', 'Content-Type', 'apikey']);
  });

  it('con una clave publishable no la manda como Authorization', () => {
    const llamadas: RequestInit[] = [];
    const contar = crearContador(
      { url: ENTORNO.url, clave: 'sb_publishable_'.padEnd(40, 'x') },
      async (_u, init) => void llamadas.push(init),
    );
    contar({ evento: 'partida_iniciada', modo: 'solo', detalle: '' });
    expect(Object.keys(llamadas[0]?.headers ?? {})).not.toContain('Authorization');
  });

  it('descarta lo que no es de la lista y no se cae si la red falla', async () => {
    let n = 0;
    const contar = crearContador(ENTORNO, async () => {
      n++;
      throw new Error('sin red');
    });
    contar({ evento: 'sala_resuelta', modo: 'solo', detalle: '<b>' } as Conteo);
    expect(n).toBe(0);
    contar({ evento: 'partida_iniciada', modo: 'solo', detalle: '' });
    await new Promise((r) => setTimeout(r, 0));
    expect(n).toBe(1);
  });
});

describe('T98 · cuándo se cuenta', () => {
  let t = 0;
  let detener: () => void = () => {};
  afterEach(() => {
    detener();
    reiniciarPartida();
    coop.value = COOP_INICIAL;
  });

  function mirar(): Conteo[] {
    const contados: Conteo[] = [];
    t = 0;
    detener = iniciarAnalitica({
      contar: (c) => contados.push(c),
      ahora: () => t,
      despues: (fn) => fn(),
    });
    return contados;
  }

  const empezar = (m: 'individual' | 'cooperativo', restanteMs = DURACION_MS) => {
    modo.value = m;
    reloj.value = { restanteMs, pausado: false, desde: t };
    fase.value = 'jugando';
  };

  it('solo: inicio, cada sello una vez y el final con el rango de minutos', () => {
    const contados = mirar();
    empezar('individual');
    sellos.value = ['s1-cooperativa'];
    sellos.value = ['s1-cooperativa'];
    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    t = 23 * 60_000;
    fase.value = 'final';
    expect(contados).toEqual([
      { evento: 'partida_iniciada', modo: 'solo', detalle: '' },
      { evento: 'sala_resuelta', modo: 'solo', detalle: 's1' },
      { evento: 'sala_resuelta', modo: 'solo', detalle: 's2' },
      { evento: 'partida_terminada', modo: 'solo', detalle: '20-30' },
    ]);
  });

  it('continuar una partida guardada no cuenta otro inicio ni los sellos que ya tenía', () => {
    const contados = mirar();
    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    empezar('individual', 20 * 60_000);
    sellos.value = ['s1-cooperativa', 's2-laboratorio', 's3-gimnasio'];
    expect(contados).toEqual([{ evento: 'sala_resuelta', modo: 'solo', detalle: 's3' }]);
  });

  it('en grupo cuenta solo el anfitrión', () => {
    const delAnfitrion = mirar();
    coop.value = { ...COOP_INICIAL, estado: 'jugando', soyAnfitrion: true };
    empezar('cooperativo', DURACION_MS - 2000);
    sellos.value = ['s1-cooperativa'];
    expect(delAnfitrion.map((c) => c.modo)).toEqual(['grupo', 'grupo']);
    detener();
    reiniciarPartida();

    const deOtro = mirar();
    coop.value = { ...COOP_INICIAL, estado: 'jugando', soyAnfitrion: false };
    empezar('cooperativo', DURACION_MS - 2000);
    sellos.value = ['s1-cooperativa'];
    fase.value = 'final';
    expect(deOtro).toEqual([]);
  });

  it('volver al menú y empezar otra partida cuenta un inicio nuevo', () => {
    const contados = mirar();
    empezar('individual');
    reiniciarPartida();
    empezar('individual');
    expect(contados.filter((c) => c.evento === 'partida_iniciada')).toHaveLength(2);
  });
});
