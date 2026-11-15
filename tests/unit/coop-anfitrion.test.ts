import { describe, expect, it } from 'vitest';
import { ClienteCoop } from '../../src/net/cliente';
import type { ClienteMemoria } from '../../src/net/memoria';
import {
  copiasIguales,
  empezarYEntrar,
  etapa,
  identidad,
  mesa,
  proponerYConfirmar,
  S1,
} from './coop-mesa';

/**
 * Anfitrión autoritativo (T84, T85, T87, pedir_pista) con clientes simulados sobre la red en
 * memoria, con retraso. Los jugadores juegan la sala 1 completa.
 */

describe.each([2, 3, 4])('sala 1 completa con %i jugadores', (n) => {
  it('listo, inicio, objetos, datos, propuestas, pistas y sello; todas las copias iguales', async () => {
    const m = await mesa(n);
    expect(m.host.foto?.orden).toHaveLength(n);
    await empezarYEntrar(m);
    const inicio = m.eventos.find((e) => e.t === 'inicio');
    expect(inicio?.p).toMatchObject({ orden: m.clientes.map((c) => c.yo) });

    // T84 · B necesita la linterna para leer la pizarra en penumbra.
    const b = m.con('B');
    if (b !== m.host) {
      await m.hacer(b, { t: 'usar', p: { herramienta: null, objetivo: 's1-pizarra' } });
      expect(m.host.foto?.revelados).not.toContain('s1-pizarra');
      await m.hacer(m.host, { t: 'pasar', p: { objeto: 'porteria-linterna', a: b.yo } });
    }
    await m.hacer(b, {
      t: 'usar',
      p: { herramienta: 'porteria-linterna', objetivo: 's1-pizarra' },
    });
    await m.hacer(m.con('A'), { t: 'usar', p: { herramienta: null, objetivo: 's1-productos' } });
    await m.hacer(m.con('C'), {
      t: 'usar',
      p: { herramienta: null, objetivo: 's1-caja-rodillos' },
    });
    for (const c of m.clientes) {
      expect(c.foto?.revelados).toEqual(['s1-pizarra', 's1-productos', 's1-caja-rodillos']);
      expect(c.foto?.objetos).toEqual([
        { objeto: 'porteria-linterna', portador: b.yo, sala: 's1-cooperativa' },
      ]);
    }

    // T85 · Solo D propone. Un intento fallido cuenta para las pistas.
    const noD = m.clientes.find((c) => c !== m.con('D'));
    if (noD) {
      await m.hacer(noD, {
        t: 'proponer',
        p: { puzzle: S1.id, etapa: 0, estado: etapa(0).solucion },
      });
      expect(m.host.foto?.propuesta).toBeNull();
    }
    await proponerYConfirmar(m, 0, { ...etapa(0).estado_inicial, rodillos: [20] });
    expect(m.eventos.filter((e) => e.t === 'resultado').at(-1)?.p).toMatchObject({
      resuelta: false,
      condiciones: { precio: false },
    });
    expect(m.host.foto?.etapas[0]).toBe(0);
    expect(m.host.foto?.pistas[0]?.intentos).toBe(1);

    // Un rechazo anula la propuesta.
    if (n > 1) {
      const d = m.con('D');
      await m.hacer(d, {
        t: 'proponer',
        p: { puzzle: S1.id, etapa: 0, estado: etapa(0).solucion },
      });
      const otro = m.clientes.find((c) => c !== d);
      const id = m.host.foto?.propuesta?.id ?? 0;
      if (otro) await m.hacer(otro, { t: 'confirmar', p: { propuesta: id, acepta: false } });
      expect(m.host.foto?.propuesta).toBeNull();
      expect(m.host.foto?.etapas[0]).toBe(0);
    }

    // Pista: se ofrece por tiempo (120 s activos) y cualquiera la abre para todos.
    await m.hacer(m.host, { t: 'pedir_pista', p: { puzzle: S1.id } });
    expect(m.eventos.some((e) => e.t === 'pista')).toBe(false);
    m.avanzar(121_000);
    await m.hacer(m.clientes.at(-1) ?? m.host, { t: 'pedir_pista', p: { puzzle: S1.id } });
    expect(m.eventos.filter((e) => e.t === 'pista').map((e) => e.p)).toEqual([
      { puzzle: S1.id, nivel: 1 },
    ]);

    for (const k of [0, 1, 2]) await proponerYConfirmar(m, k, etapa(k).solucion);
    const resultados = m.eventos.filter((e) => e.t === 'resultado').map((e) => e.p);
    expect(resultados.slice(-3).map((r) => [r.etapa, r.resuelta, r.sello])).toEqual([
      [0, true, false],
      [1, true, false],
      [2, true, true],
    ]);
    expect(m.host.foto?.etapas).toEqual([3, 0, 0, 0, 0]);

    // Se vuelve a la portería y se entra a la sala 2: rotan los encargos.
    await m.votarTodos({
      t: 'votar',
      p: { asunto: 'sala', opcion: 's2-laboratorio', acepta: true },
    });
    expect(m.host.foto?.lugar).toBe('s2-laboratorio');
    expect(m.host.roles?.sala).toBe(2);
    copiasIguales(m);
  });
});

describe('espera y unión', () => {
  it('no empieza con un solo jugador ni hasta que todos estén listos', async () => {
    const m = await mesa(3);
    await m.hacer(m.host, { t: 'listo', p: { listo: true } });
    await m.hacer(m.clientes[1] as ClienteCoop, { t: 'listo', p: { listo: true } });
    expect(m.host.foto?.fase).toBe('espera');
    expect(m.host.foto?.listos).toHaveLength(2);
    await m.hacer(m.clientes[1] as ClienteCoop, { t: 'listo', p: { listo: false } });
    expect(m.host.foto?.listos).toEqual([m.host.yo]);
  });

  it('el quinto recibe «llena» y otra versión del contenido, «version»', async () => {
    const m = await mesa(4);
    const quinto = new ClienteCoop(
      m.red.cliente(),
      identidad('j_jugador5', 9000),
      () => m.red.ahora,
    );
    await quinto.unirse('K7MP');
    const viejo = new ClienteCoop(
      m.red.cliente(),
      identidad('j_viejo01', 9001, '0'),
      () => m.red.ahora,
    );
    await viejo.unirse('K7MP');
    m.red.vaciar();
    expect(quinto.rechazo).toBe('llena');
    expect(viejo.rechazo).toBe('version');
    expect(m.host.foto?.orden).toHaveLength(4);
  });

  it('a una partida empezada no entra alguien nuevo', async () => {
    const m = await mesa(2);
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    const tarde = new ClienteCoop(
      m.red.cliente(),
      identidad('j_tarde001', 9000),
      () => m.red.ahora,
    );
    await tarde.unirse('K7MP');
    m.red.vaciar();
    expect(tarde.rechazo).toBe('empezada');
  });

  it('las intenciones de alguien que no es de la partida se ignoran', async () => {
    const m = await mesa(2);
    const ajeno = m.red.cliente();
    await ajeno.unirse('K7MP', identidad('j_ajeno001', 9000, '0'));
    m.red.vaciar();
    const antes = m.eventos.length;
    await ajeno.enviar('int', {
      v: 1,
      t: 'listo',
      de: 'j_ajeno001',
      cid: 'j_ajeno001-1',
      n: null,
      p: { listo: true },
    });
    m.red.vaciar();
    expect(m.eventos.length).toBe(antes);
  });
});

describe('T84 · objetos', () => {
  it('no se recoge algo de otra sala, ni algo que otro lleva, ni algo fijo', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const otro = m.clientes[1] as ClienteCoop;
    await m.hacer(otro, { t: 'recoger', p: { objeto: 'porteria-cuaderno' } });
    await m.hacer(otro, { t: 'recoger', p: { objeto: 'porteria-linterna' } });
    await m.hacer(otro, { t: 'recoger', p: { objeto: 's1-palanca' } });
    expect(m.host.foto?.objetos).toEqual([
      { objeto: 'porteria-linterna', portador: m.host.yo, sala: 's1-cooperativa' },
    ]);
    // Pasar algo que no se tiene tampoco.
    await m.hacer(otro, { t: 'pasar', p: { objeto: 'porteria-linterna', a: otro.yo } });
    expect(m.host.foto?.objetos[0]?.portador).toBe(m.host.yo);
  });
});

describe('T87 · votos y reloj', () => {
  it('la pausa exige a todos, se puede retirar el voto y reanudar', async () => {
    const m = await mesa(3);
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    const [a, b, c] = m.clientes as [ClienteCoop, ClienteCoop, ClienteCoop];
    await m.hacer(a, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } });
    await m.hacer(b, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } });
    await m.hacer(b, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: false } });
    expect(m.host.foto?.votos).toEqual([{ asunto: 'pausa', opcion: null, votos: [a.yo] }]);
    await m.hacer(b, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } });
    expect(m.host.foto?.reloj.pausado).toBe(false);
    await m.hacer(c, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } });
    expect(m.clientes.every((x) => x.foto?.reloj.pausado === true)).toBe(true);
    expect(m.clientes.every((x) => x.foto?.votos.length === 0)).toBe(true);

    // En pausa el tiempo no corre.
    const antes = m.host.anfitrion?.sesion.reloj.restanteMs;
    m.avanzar(10_000);
    expect(m.host.anfitrion?.sesion.reloj.restanteMs).toBe(antes);
    await m.votarTodos({ t: 'votar', p: { asunto: 'reanudar', opcion: null, acepta: true } });
    expect(m.host.foto?.reloj.pausado).toBe(false);
  });

  it('cambiar de opción reinicia la cuenta; no se vota una sala cerrada', async () => {
    const m = await mesa(2);
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    const [a, b] = m.clientes as [ClienteCoop, ClienteCoop];
    await m.hacer(a, { t: 'votar', p: { asunto: 'sala', opcion: 's3-gimnasio', acepta: true } });
    expect(m.host.foto?.votos).toEqual([]);
    await m.hacer(a, { t: 'votar', p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true } });
    await m.hacer(b, { t: 'votar', p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true } });
    expect(m.host.foto?.lugar).toBe('s1-cooperativa');
  });

  it('pedir ayuda por unanimidad termina en «pedir_ayuda» y para el reloj', async () => {
    const m = await mesa(2);
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    await m.votarTodos({ t: 'votar', p: { asunto: 'ayuda', opcion: null, acepta: true } });
    expect(
      m.clientes.every((c) => c.foto?.fase === 'final' && c.foto.final === 'pedir_ayuda'),
    ).toBe(true);
    expect(m.host.anfitrion?.sesion.reloj.pausado).toBe(true);
  });

  it('el final por voto solo vale con los cinco sellos en la portería', async () => {
    const m = await mesa(2);
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    await m.votarTodos({ t: 'votar', p: { asunto: 'final', opcion: 'salir', acepta: true } });
    expect(m.host.foto?.fase).toBe('jugando');
  });

  it('al agotarse el reloj, «tiempo_cumplido»', async () => {
    const m = await mesa(2, { retrasoMs: 0 });
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    m.avanzar(40 * 60 * 1000 + 1000);
    expect(m.clientes.every((c) => c.foto?.final === 'tiempo_cumplido')).toBe(true);
  });

  it('si alguien se va, lo que esperaba su voto se resuelve con los que quedan', async () => {
    const m = await mesa(3);
    for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
    const [a, b, c] = m.clientes as [ClienteCoop, ClienteCoop, ClienteCoop];
    await m.hacer(a, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } });
    await m.hacer(b, { t: 'votar', p: { asunto: 'pausa', opcion: null, acepta: true } });
    (c.t as ClienteMemoria).desconectar();
    m.red.vaciar();
    expect(m.host.foto?.reloj.pausado).toBe(true);
  });
});

describe('qué pasa al usar un objeto (mundo)', () => {
  it('escondites dan grabación, datos se revelan, la pizarra pide la linterna', async () => {
    const { efectoDeUsar, esRecogible } = await import('../../src/game/coop/mundo');
    expect(efectoDeUsar(null, 's2-gabinete')).toEqual({ t: 'grabacion', grabacion: 'grab-1' });
    expect(efectoDeUsar(null, 's1-productos')).toEqual({ t: 'revelado' });
    expect(efectoDeUsar(null, 's1-pizarra')).toBeNull();
    expect(efectoDeUsar('porteria-linterna', 's1-pizarra')).toEqual({ t: 'revelado' });
    expect(efectoDeUsar('porteria-linterna', 's1-productos')).toBeNull();
    expect(efectoDeUsar(null, 's1-palanca')).toBeNull();
    expect(
      ['porteria-linterna', 'porteria-cuaderno', 's2-hoja-ayer', 's4-ficha-rota'].every(
        esRecogible,
      ),
    ).toBe(true);
    expect(esRecogible('s1-palanca')).toBe(false);
  });
});
