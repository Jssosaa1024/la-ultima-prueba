import { describe, expect, it } from 'vitest';
import type { Evento } from '../../src/game/coop/mensajes';
import { FOTO_CADA_MS } from '../../src/net/anfitrion';
import { intencion } from '../../src/net/protocolo';
import { copiasIguales, empezarYEntrar, etapa, mesa, proponerYConfirmar } from './coop-mesa';

/** T88 · Secuencia `n`, foto al unirse y cada 15 s, `pedir_estado` tras un hueco y cid repetidos. */

describe('T88 · secuencia y resincronización', () => {
  it('los eventos llevan n creciente sin saltos', async () => {
    const m = await mesa(2);
    const ns: number[] = [];
    m.clientes[1]?.t.escuchar('evt', (e) => ns.push(e.n));
    await empezarYEntrar(m);
    expect(ns.length).toBeGreaterThan(3);
    expect(ns).toEqual(ns.map((_, i) => (ns[0] ?? 0) + i));
  });

  it('quien llega recibe la foto al unirse', async () => {
    const m = await mesa(3);
    for (const c of m.clientes) expect(c.foto?.orden).toHaveLength(3);
  });

  it('un cliente que pierde eventos detecta el hueco, pide la foto y queda igual', async () => {
    const m = await mesa(3);
    await empezarYEntrar(m);
    const sordo = m.clientes[2];
    if (!sordo) throw new Error('falta el tercero');
    // Al tercero se le pierde la mitad de los eventos del anfitrión.
    m.red.configurar({
      perdida: (canal, _de, a) => (canal === 'evt' && a === sordo.yo ? 0.5 : 0),
    });
    let pedidos = 0;
    m.host.t.escuchar('int', (x) => {
      if (x.t === 'pedir_estado' && x.de === sordo.yo) pedidos++;
    });
    for (const k of [0, 1, 2]) await proponerYConfirmar(m, k, etapa(k).solucion);
    m.red.configurar({ perdida: 0 });
    // Los pedidos que se perdieron se repiten a los 2 s.
    m.avanzar(3000);
    expect(pedidos).toBeGreaterThan(0);
    expect(sordo.esperandoFoto).toBeNull();
    copiasIguales(m);
  });

  it('el último evento perdido se corrige con la foto de cada 15 s', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const otro = m.clientes[1];
    if (!otro) throw new Error('falta el segundo');
    m.red.configurar({ perdida: (canal, _de, a) => (canal === 'evt' && a === otro.yo ? 1 : 0) });
    await m.hacer(m.con('A'), { t: 'usar', p: { herramienta: null, objetivo: 's1-productos' } });
    m.red.configurar({ perdida: 0 });
    expect(otro.foto?.revelados).toEqual([]);
    const fotos: Evento[] = [];
    otro.alCambiar((e) => e.t === 'estado' && fotos.push(e));
    m.avanzar(FOTO_CADA_MS + 1000);
    expect(fotos.length).toBeGreaterThanOrEqual(1);
    expect(otro.foto?.revelados).toEqual(['s1-productos']);
    copiasIguales(m);
  });

  it('T88b: una pista ofrecida por tiempo llega a todos en ese momento, no con la foto de 15 s', async () => {
    const m = await mesa(3);
    await empezarYEntrar(m);
    // Lo que decidió el anfitrión (su sesión) y lo que ve cada copia, incluida la suya.
    const enSesion = () => m.host.anfitrion?.sesion.pistas[0]?.ofrecidas ?? 0;
    const enCopia = (c: (typeof m.clientes)[number]) => c.foto?.pistas[0]?.ofrecidas ?? 0;
    // Una foto a los 7 s corre la de cada 15 s, para que no coincida con la oferta de la pista.
    m.avanzar(7000);
    m.host.anfitrion?.emitirFoto();
    m.red.vaciar();
    // Segundo a segundo hasta que el anfitrión ofrece la primera pista (120 s en la sala 1).
    let segundos = 7;
    while (enSesion() === 0 && segundos < 200) {
      m.avanzar(1000);
      segundos++;
      // En el mismo segundo en que el anfitrión la ofrece, todas las copias ya la tienen.
      for (const c of m.clientes) expect(enCopia(c), c.yo).toBe(enSesion());
    }
    expect(enSesion()).toBe(1);
    expect(segundos).toBeGreaterThanOrEqual(120);
    copiasIguales(m);
  });

  it('T88b: la pista ofrecida por intentos llega con el resultado que la abrió', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const otro = m.clientes[1];
    if (!otro) throw new Error('falta el segundo');
    const mal = { ...etapa(0).solucion, rodillos: [20] };
    // tras_intentos: 3 en la sala 1. Sin avanzar el reloj, solo los intentos la abren.
    for (let k = 0; k < 3; k++) await proponerYConfirmar(m, 0, mal);
    expect(m.host.foto?.pistas[0]?.ofrecidas).toBe(1);
    expect(otro.foto?.pistas[0]?.ofrecidas).toBe(1);
    copiasIguales(m);
  });

  it('T88b: sin pista nueva no se difunde ninguna foto extra', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const antes = m.eventos.filter((e) => e.t === 'estado').length;
    m.avanzar(10_000);
    expect(m.eventos.filter((e) => e.t === 'estado').length).toBe(antes);
  });

  it('un evento repetido o viejo no se aplica dos veces', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const otro = m.clientes[1];
    if (!otro) throw new Error('falta el segundo');
    const vistos: unknown[] = [];
    otro.t.escuchar('evt', (e) => vistos.push(e));
    await m.hacer(m.con('A'), { t: 'usar', p: { herramienta: null, objetivo: 's1-productos' } });
    const n = otro.ultimoN;
    // Se reenvía el mismo evento: el cliente lo ignora porque su n ya pasó.
    const ultimo = vistos.at(-1) as Parameters<typeof m.host.t.enviar<'evt'>>[1];
    await m.host.t.enviar('evt', ultimo);
    m.red.vaciar();
    expect(otro.ultimoN).toBe(n);
  });

  it('una intención con el mismo cid se procesa una sola vez', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const d = m.con('D');
    const proponer = intencion(d.yo, `${d.yo}-900`, {
      t: 'proponer',
      p: {
        puzzle: 's1-etiquetadora',
        etapa: 0,
        estado: { producto: 'jugo', precio: 2000, rodillos: [20] },
      },
    });
    await d.t.enviar('int', proponer);
    await d.t.enviar('int', proponer);
    m.red.vaciar();
    expect(m.eventos.filter((e) => e.t === 'propuesta')).toHaveLength(1);
  });

  it('pedir_estado se limita a uno por segundo por jugador', async () => {
    const m = await mesa(2);
    const otro = m.clientes[1];
    if (!otro) throw new Error('falta el segundo');
    const antes = m.eventos.filter((e) => e.t === 'estado').length;
    for (let i = 0; i < 5; i++) await otro.enviar({ t: 'pedir_estado', p: { desde_n: 0 } });
    m.red.vaciar();
    expect(m.eventos.filter((e) => e.t === 'estado').length - antes).toBe(1);
  });
});
