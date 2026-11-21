import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completa,
  elegir,
  ocupados,
  resultadoDeEleccion,
  type Apariencia,
} from '../../src/game/coop/apariencia';
import { alIntencion, alPresencia, crearSesion } from '../../src/game/coop/sesion';
import { ClienteCoop } from '../../src/net/cliente';
import { RedEnMemoria } from '../../src/net/memoria';
import { validar, VERSION_CONTENIDO, type Identidad } from '../../src/net/protocolo';
import { iniciarControladorCoop } from '../../src/signals/controlador-coop';
import { coop } from '../../src/signals/coop';
import { enviar } from '../../src/signals/puente';

// T81b: en la sala de espera nadie repite alias ni color. Si dos piden lo mismo a la vez, se lo
// queda el primero que llega al anfitrión y al otro se le pide elegir de nuevo.

const A = 'j_aaaa';
const B = 'j_bbbb';
const C = 'j_cccc';

describe('regla de alias y color', () => {
  const lista: Apariencia[] = [{ jugador: A, alias: 'jaguar', color: 'turquesa' }];

  it('acepta lo libre y deja vacío lo que ya tiene otro', () => {
    expect(elegir(lista, B, { alias: 'buho', color: 'coral' })).toEqual([
      ...lista,
      { jugador: B, alias: 'buho', color: 'coral' },
    ]);
    // Mismo alias que A: el alias queda vacío; el color sí se acepta.
    const choque = elegir(lista, B, { alias: 'jaguar', color: 'coral' });
    expect(choque[1]).toEqual({ jugador: B, alias: null, color: 'coral' });
    expect(completa(choque, B)).toBe(false);
    expect(completa(choque, A)).toBe(true);
  });

  it('al cambiar a algo ocupado, se queda con lo que tenía', () => {
    const dos = elegir(lista, B, { alias: 'buho', color: 'coral' });
    expect(elegir(dos, B, { alias: 'jaguar', color: 'turquesa' })).toBe(dos);
    expect(elegir(dos, B, { alias: 'oso', color: 'turquesa' })[1]).toEqual({
      jugador: B,
      alias: 'oso',
      color: 'coral',
    });
    // Volver a pedir lo propio no cambia nada.
    expect(elegir(dos, A, { alias: 'jaguar', color: 'turquesa' })).toBe(dos);
  });

  it('dice qué tienen los demás', () => {
    const tres = [...lista, { jugador: B, alias: null, color: 'coral' } as const];
    expect(ocupados(tres, A)).toEqual({ alias: [], colores: ['coral'] });
    expect(ocupados(tres, B)).toEqual({ alias: ['jaguar'], colores: ['turquesa'] });
    expect(ocupados(tres, null)).toEqual({ alias: ['jaguar'], colores: ['turquesa', 'coral'] });
  });

  it('quien pidió sabe si ganó, perdió o sigue esperando', () => {
    const dos = elegir(lista, B, { alias: 'buho', color: 'coral' });
    const pedido = { alias: 'oso', color: 'coral' } as const;
    // El anfitrión todavía no lo atiende: B sigue siendo Búho.
    expect(resultadoDeEleccion(dos, B, pedido)).toEqual({ estado: 'esperando' });
    expect(resultadoDeEleccion(lista, B, pedido)).toEqual({ estado: 'esperando' });
    // Lo atendió y lo aceptó.
    const ok = elegir(dos, B, pedido);
    expect(resultadoDeEleccion(ok, B, pedido)).toEqual({ estado: 'listo', ocupado: null });
    // Otro llegó primero con Oso.
    const gano = elegir(elegir(dos, A, { alias: 'oso', color: 'turquesa' }), B, pedido);
    expect(resultadoDeEleccion(gano, B, pedido)).toEqual({
      estado: 'listo',
      ocupado: { alias: 'oso', color: null },
    });
  });
});

describe('el pedido con que se une', () => {
  it('si quien tenía el alias ya se fue, el campo vacío también cuenta como respuesta', () => {
    const lista: Apariencia[] = [{ jugador: B, alias: null, color: 'coral' }];
    const pedido = { alias: 'jaguar', color: 'coral' } as const;
    expect(resultadoDeEleccion(lista, B, pedido)).toEqual({ estado: 'esperando' });
    expect(resultadoDeEleccion(lista, B, pedido, true)).toEqual({ estado: 'listo', ocupado: null });
  });
});

describe('protocolo de la elección', () => {
  const sobre = (p: unknown) => ({ v: 3, t: 'elegir', de: A, cid: `${A}-1`, n: null, p });
  it('solo viajan ids de las listas', () => {
    expect(validar('int', sobre({ alias: 'oso', color: 'coral' })).ok).toBe(true);
    expect(validar('int', sobre({ alias: 'Pedro', color: 'coral' })).ok).toBe(false);
    expect(validar('int', sobre({ alias: 'oso', color: '#ff0000' })).ok).toBe(false);
    expect(validar('int', sobre({ alias: 'oso', color: 'coral', nombre: 'x' })).ok).toBe(false);
  });
});

describe('el anfitrión atiende por orden de llegada', () => {
  const pedido = (alias: Identidad['alias'], color: Identidad['color']) => ({ alias, color });

  it('quien se une con el alias del anfitrión queda eligiendo y no se puede empezar', () => {
    let s = crearSesion(A, 0);
    const elecciones = new Map([
      [A, pedido('jaguar', 'ambar')],
      [B, pedido('jaguar', 'coral')],
    ]);
    s = alPresencia(s, [A, B], 0, elecciones).s;
    expect(s.apariencias).toEqual([
      { jugador: A, alias: 'jaguar', color: 'ambar' },
      { jugador: B, alias: null, color: 'coral' },
    ]);
    s = alIntencion(s, B, { t: 'listo', p: { listo: true } }, 0).s;
    s = alIntencion(s, A, { t: 'listo', p: { listo: true } }, 0).s;
    expect(s.fase).toBe('espera');
    // Elige otro: ya tiene todo y, como los dos estaban listos, empieza.
    const paso = alIntencion(s, B, { t: 'elegir', p: pedido('buho', 'coral') }, 0);
    expect(paso.s.fase).toBe('jugando');
    expect(paso.eventos.map((e) => e.t)).toEqual(['inicio']);
  });

  it('si dos piden lo mismo a la vez, gana la primera intención que llega', () => {
    let s = crearSesion(A, 0);
    const elecciones = new Map([
      [A, pedido('jaguar', 'ambar')],
      [B, pedido('buho', 'coral')],
      [C, pedido('rana', 'violeta')],
    ]);
    s = alPresencia(s, [A, B, C], 0, elecciones).s;
    const primero = alIntencion(s, C, { t: 'elegir', p: pedido('oso', 'turquesa') }, 0);
    const segundo = alIntencion(primero.s, B, { t: 'elegir', p: pedido('oso', 'turquesa') }, 0);
    expect(segundo.s.apariencias).toEqual([
      { jugador: A, alias: 'jaguar', color: 'ambar' },
      { jugador: B, alias: 'buho', color: 'coral' },
      { jugador: C, alias: 'oso', color: 'turquesa' },
    ]);
    // Al que perdió también se le responde con la foto, para que vea que ya está ocupado.
    expect(segundo.eventos.map((e) => e.t)).toEqual(['estado']);
  });

  it('quien sale de la sala de espera suelta su alias y su color', () => {
    let s = crearSesion(A, 0);
    const elecciones = new Map([
      [A, pedido('jaguar', 'ambar')],
      [B, pedido('buho', 'coral')],
    ]);
    s = alPresencia(s, [A, B], 0, elecciones).s;
    s = alPresencia(s, [A], 0, elecciones).s;
    expect(s.apariencias).toEqual([{ jugador: A, alias: 'jaguar', color: 'ambar' }]);
    s = alPresencia(s, [A, C], 0, new Map([[C, pedido('buho', 'coral')]])).s;
    expect(completa(s.apariencias, C)).toBe(true);
  });

  it('con la partida empezada ya no se cambia', () => {
    let s = crearSesion(A, 0);
    const elecciones = new Map([
      [A, pedido('jaguar', 'ambar')],
      [B, pedido('buho', 'coral')],
    ]);
    s = alPresencia(s, [A, B], 0, elecciones).s;
    s = alIntencion(s, B, { t: 'listo', p: { listo: true } }, 0).s;
    s = alIntencion(s, A, { t: 'listo', p: { listo: true } }, 0).s;
    expect(s.fase).toBe('jugando');
    const paso = alIntencion(s, B, { t: 'elegir', p: pedido('oso', 'coral') }, 0);
    expect(paso.s).toBe(s);
    expect(paso.eventos).toEqual([]);
  });
});

const id = (jugador: string, alias: Identidad['alias'], color: Identidad['color']) =>
  ({ jugador, alias, color, unido_en: Date.now(), version_contenido: VERSION_CONTENIDO }) as const;

describe('controlador: pedir de nuevo en la sala de espera', () => {
  let red: RedEnMemoria;
  let detener: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    red = new RedEnMemoria({ retrasoMs: 20 });
    detener = iniciarControladorCoop({
      crearTransporte: async () => red.cliente(),
      almacen: null,
      busqueda: '?red=pestanas',
      ahora: () => red.ahora,
    });
  });
  afterEach(() => {
    detener();
    vi.useRealTimers();
  });

  async function asentar(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(0);
      red.vaciar();
    }
  }

  it('al unirse con lo que ya tiene otro, marca ocupado y pide elegir de nuevo', async () => {
    const anfitrion = new ClienteCoop(
      red.cliente(),
      id('j_host1', 'jaguar', 'turquesa'),
      () => red.ahora,
    );
    await anfitrion.crear('K7MP');
    red.vaciar();
    enviar({ t: 'unirse', codigo: 'K7MP', alias: 'jaguar', color: 'turquesa' });
    await asentar();
    expect(coop.value.estado).toBe('espera');
    expect(coop.value.ocupados).toEqual({ alias: ['jaguar'], colores: ['turquesa'] });
    expect(coop.value.eleccion).toEqual({
      estado: 'elige',
      ocupado: { alias: 'jaguar', color: 'turquesa' },
    });
    expect(coop.value.jugadores.find((j) => j.yo)?.eligiendo).toBe(true);

    enviar({ t: 'elegir', alias: 'buho', color: 'coral' });
    expect(coop.value.eleccion.estado).toBe('esperando');
    await asentar();
    expect(coop.value.eleccion).toEqual({ estado: 'ok', ocupado: null });
    expect(coop.value.jugadores.map((j) => [j.alias, j.color, j.eligiendo])).toEqual([
      ['jaguar', 'turquesa', false],
      ['buho', 'coral', false],
    ]);
  });

  it('si otro pide lo mismo y llega primero, este se queda con lo suyo y elige de nuevo', async () => {
    const anfitrion = new ClienteCoop(
      red.cliente(),
      id('j_host1', 'jaguar', 'turquesa'),
      () => red.ahora,
    );
    await anfitrion.crear('K7MP');
    red.vaciar();
    enviar({ t: 'unirse', codigo: 'K7MP', alias: 'buho', color: 'coral' });
    await asentar();
    expect(coop.value.eleccion).toEqual({ estado: 'ok', ocupado: null });

    // Los dos piden Oso y Violeta; la intención del anfitrión sale primero.
    await anfitrion.enviar({ t: 'elegir', p: { alias: 'oso', color: 'violeta' } });
    enviar({ t: 'elegir', alias: 'oso', color: 'violeta' });
    await asentar();
    expect(coop.value.eleccion).toEqual({
      estado: 'ok',
      ocupado: { alias: 'oso', color: 'violeta' },
    });
    expect(coop.value.jugadores.map((j) => [j.alias, j.color])).toEqual([
      ['oso', 'violeta'],
      ['buho', 'coral'],
    ]);
    // Pedir otra vez borra el aviso.
    enviar({ t: 'elegir', alias: 'rana', color: 'violeta' });
    await asentar();
    expect(coop.value.eleccion).toEqual({
      estado: 'ok',
      ocupado: { alias: null, color: 'violeta' },
    });
    expect(coop.value.jugadores.find((j) => j.yo)).toMatchObject({ alias: 'rana', color: 'coral' });
  });
});
