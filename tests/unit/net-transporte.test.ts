import { afterEach, describe, expect, it } from 'vitest';
import { elegirRed } from '../../src/net';
import { RedEnMemoria, type ClienteMemoria } from '../../src/net/memoria';
import { TransportePestanas } from '../../src/net/pestanas';
import {
  directo,
  intencion,
  VERSION_CONTENIDO,
  type Identidad,
  type SobreInt,
} from '../../src/net/protocolo';

/** T80 · Transportes de prueba: red en memoria (Vitest) y BroadcastChannel (e2e). */

const identidad = (jugador: string, unido_en: number): Identidad => ({
  jugador,
  alias: 'zorro',
  color: 'ambar',
  unido_en,
  version_contenido: VERSION_CONTENIDO,
});

const listo = (de: string, k: number): SobreInt =>
  intencion(de, `${de}-${k}`, { t: 'listo', p: { listo: true } });

async function tres(red: RedEnMemoria): Promise<ClienteMemoria[]> {
  const cs = [red.cliente(), red.cliente(), red.cliente()];
  await Promise.all(cs.map((c, i) => c.unirse('K7MP', identidad(`j_cliente${i}`, 100 + i))));
  return cs;
}

describe('red en memoria', () => {
  it('entrega a todos, también a quien envía, y Presence ordena por unido_en', async () => {
    const red = new RedEnMemoria();
    const cs = await tres(red);
    const recibidos = cs.map(() => [] as string[]);
    cs.forEach((c, i) => c.escuchar('int', (m) => recibidos[i]?.push(m.cid)));
    let presentes: string[] = [];
    cs[2]?.presencia((p) => (presentes = p.map((x) => x.jugador)));
    expect(presentes).toEqual(['j_cliente0', 'j_cliente1', 'j_cliente2']);
    expect(await cs[0]?.enviar('int', listo('j_cliente0', 1))).toBe(true);
    red.vaciar();
    expect(recibidos).toEqual([['j_cliente0-1'], ['j_cliente0-1'], ['j_cliente0-1']]);
  });

  it('no envía mensajes inválidos y descarta los que llegan mal', async () => {
    const red = new RedEnMemoria();
    const [a, b] = await tres(red);
    let n = 0;
    b?.escuchar('int', () => n++);
    // Un cid ajeno: el emisor no puede hacerse pasar por otro.
    expect(await a?.enviar('int', { ...listo('j_cliente0', 1), cid: 'j_cliente1-1' })).toBe(false);
    b?.oyentes.recibir('int', { basura: true });
    red.vaciar();
    expect(n).toBe(0);
    expect(b?.oyentes.descartes).toEqual({ forma: 1 });
  });

  it('respeta el retraso y no entrega antes de tiempo', async () => {
    const red = new RedEnMemoria({ retrasoMs: 150 });
    const [a, b] = await tres(red);
    const llegadas: number[] = [];
    b?.escuchar('dir', () => llegadas.push(red.ahora));
    await a?.enviar(
      'dir',
      directo('j_cliente0', { t: 'pose', p: { s: 1, x: 0, y: 0, z: 0, yaw: 0 } }),
    );
    red.avanzar(100);
    expect(llegadas).toEqual([]);
    red.avanzar(100);
    expect(llegadas).toEqual([150]);
  });

  it('pierde mensajes con la probabilidad pedida, siempre igual con la misma semilla', async () => {
    const contar = async () => {
      const red = new RedEnMemoria({ perdida: 0.3, semilla: 7 });
      const [a, b] = await tres(red);
      let n = 0;
      b?.escuchar('int', () => n++);
      for (let k = 1; k <= 200; k++) await a?.enviar('int', listo('j_cliente0', k));
      red.vaciar();
      return n;
    };
    const n = await contar();
    expect(n).toBeGreaterThan(110);
    expect(n).toBeLessThan(170);
    expect(await contar()).toBe(n);
  });

  it('desconectar saca de Presence y deja de recibir; reconectar vuelve con la misma identidad', async () => {
    const red = new RedEnMemoria();
    const [a, b, c] = await tres(red);
    let presentes: string[] = [];
    a?.presencia((p) => (presentes = p.map((x) => x.jugador)));
    let recibe = 0;
    b?.escuchar('int', () => recibe++);
    b?.desconectar();
    expect(presentes).toEqual(['j_cliente0', 'j_cliente2']);
    await c?.enviar('int', listo('j_cliente2', 1));
    red.vaciar();
    expect(recibe).toBe(0);
    await b?.reconectar('K7MP');
    expect(presentes).toEqual(['j_cliente0', 'j_cliente1', 'j_cliente2']);
  });

  it('cuenta los mensajes enviados por canal', async () => {
    const red = new RedEnMemoria();
    const [a] = await tres(red);
    await a?.enviar('int', listo('j_cliente0', 1));
    expect(red.enviados).toEqual({ int: 1, evt: 0, dir: 0 });
  });

  it('unirse rechaza un código o una identidad inválidos', async () => {
    const red = new RedEnMemoria();
    await expect(red.cliente().unirse('K0MP', identidad('j_cliente0', 1))).rejects.toThrow();
    await expect(
      red
        .cliente()
        .unirse('K7MP', { ...identidad('j_cliente0', 1), alias: 'Ana' } as unknown as Identidad),
    ).rejects.toThrow();
  });
});

describe('transporte entre pestañas (BroadcastChannel)', () => {
  const abiertos: TransportePestanas[] = [];
  afterEach(async () => {
    await Promise.all(abiertos.splice(0).map((t) => t.salir()));
  });

  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('entrega entre pestañas y a sí mismo, y arma Presence con latidos', async () => {
    const a = new TransportePestanas();
    const b = new TransportePestanas();
    abiertos.push(a, b);
    let presentesA: string[] = [];
    a.presencia((p) => (presentesA = p.map((x) => x.jugador)));
    await a.unirse('K7MP', identidad('j_pestana1', 1));
    await b.unirse('K7MP', identidad('j_pestana2', 2));
    const enA: string[] = [];
    const enB: string[] = [];
    a.escuchar('int', (m) => enA.push(m.cid));
    b.escuchar('int', (m) => enB.push(m.cid));
    await esperar(50);
    expect(presentesA).toEqual(['j_pestana1', 'j_pestana2']);
    await b.enviar('int', listo('j_pestana2', 1));
    await esperar(50);
    expect(enA).toEqual(['j_pestana2-1']);
    expect(enB).toEqual(['j_pestana2-1']);
    await b.salir();
    await esperar(50);
    expect(presentesA).toEqual(['j_pestana1']);
  });

  it('otra partida (otro código) no se escucha', async () => {
    const a = new TransportePestanas();
    const b = new TransportePestanas();
    abiertos.push(a, b);
    await a.unirse('K7MP', identidad('j_pestana1', 1));
    await b.unirse('ABCD', identidad('j_pestana2', 2));
    let n = 0;
    a.escuchar('int', () => n++);
    await b.enviar('int', listo('j_pestana2', 1));
    await esperar(50);
    expect(n).toBe(0);
  });

  it('descarta paquetes mal formados de otra pestaña', async () => {
    const a = new TransportePestanas();
    abiertos.push(a);
    await a.unirse('K7MP', identidad('j_pestana1', 1));
    let n = 0;
    a.escuchar('int', () => n++);
    const intruso = new BroadcastChannel('la-ultima-prueba:partida:K7MP');
    intruso.postMessage({ k: 'msg', canal: 'int', m: { t: 'nota', texto: '<script>' } });
    intruso.postMessage({ k: 'latido', id: { jugador: 'x' }, responder: true });
    await esperar(50);
    intruso.close();
    expect(n).toBe(0);
  });
});

describe('elegir la red', () => {
  const env = {
    url: 'https://abcdefghij.supabase.co',
    clave: 'eyJhbGciOiJIUzI1NiJ9.e30.firma-de-prueba',
  };
  it('usa Supabase si hay variables y pestañas si faltan', () => {
    expect(elegirRed(env, '')).toBe('supabase');
    expect(elegirRed({}, '')).toBe('pestanas');
    expect(elegirRed({ url: 'https://abcdefghij.supabase.co' }, '')).toBe('pestanas');
    expect(elegirRed({ ...env, url: 'http://abcdefghij.supabase.co' }, '')).toBe('pestanas');
    expect(elegirRed({ ...env, url: 'https://evil.example.com' }, '')).toBe('pestanas');
    expect(elegirRed({ ...env, clave: 'corta' }, '')).toBe('pestanas');
  });
  it('el parámetro de prueba solo vale con el valor exacto', () => {
    expect(elegirRed(env, '?red=pestanas')).toBe('pestanas');
    expect(elegirRed(env, '?red=Pestanas')).toBe('supabase');
    expect(elegirRed(env, '?red=pestanas%00')).toBe('supabase');
  });
});
