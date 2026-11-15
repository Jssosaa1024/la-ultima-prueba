import { describe, expect, it } from 'vitest';
import type { ClienteCoop } from '../../src/net/cliente';
import { jugadorDelNavegador } from '../../src/net/identidad';
import type { ClienteMemoria } from '../../src/net/memoria';
import { empezarYEntrar, etapa, mesa, S1, sinTiempo, type Mesa } from './coop-mesa';

/** T89 · Reconexión con rol y objetos (reserva de 60 s). T90 · Migración de anfitrión a los 5 s. */

const red = (c: ClienteCoop) => c.t as ClienteMemoria;

/** El cliente que hoy corre el anfitrión. */
function anfitrionActual(m: Mesa): ClienteCoop {
  const c = m.clientes.find((x) => x.anfitrion && red(x).conectado);
  if (!c) throw new Error('nadie es anfitrión');
  return c;
}

async function proponerTodos(m: Mesa, d: ClienteCoop, k: number) {
  await m.hacer(d, { t: 'proponer', p: { puzzle: S1.id, etapa: k, estado: etapa(k).solucion } });
  const id = d.foto?.propuesta?.id;
  for (const c of m.clientes) {
    if (c !== d && id !== undefined)
      await c.enviar({ t: 'confirmar', p: { propuesta: id, acepta: true } });
  }
  m.red.vaciar();
}

describe('T89 · reconexión del mismo jugador', () => {
  it('antes de 60 s vuelve con sus objetos y recibe la foto', async () => {
    const m = await mesa(3);
    await empezarYEntrar(m);
    const b = m.con('B');
    if (b !== m.host)
      await m.hacer(m.host, { t: 'pasar', p: { objeto: 'porteria-linterna', a: b.yo } });
    if (b === m.host) return; // con 3 jugadores B es el segundo; nunca el anfitrión
    red(b).desconectar();
    m.red.vaciar();
    m.avanzar(30_000);
    expect(m.host.foto?.objetos[0]?.portador).toBe(b.yo);
    await b.reconectar();
    m.red.vaciar();
    expect(b.foto?.ausentes).toEqual([]);
    await m.hacer(b, {
      t: 'usar',
      p: { herramienta: 'porteria-linterna', objetivo: 's1-pizarra' },
    });
    expect(m.host.foto?.revelados).toContain('s1-pizarra');
  });

  it('a los 60 s sus objetos quedan en el piso y D pasa al siguiente; al volver recupera D', async () => {
    const m = await mesa(3);
    await empezarYEntrar(m);
    // Con 3 jugadores en la sala 1, D es el tercero.
    const d = m.con('D');
    expect(d).toBe(m.clientes[2]);
    await m.hacer(m.host, { t: 'pasar', p: { objeto: 'porteria-linterna', a: d.yo } });
    red(d).desconectar();
    m.red.vaciar();

    // Mientras se espera a D, nadie acciona la máquina.
    const otro = m.clientes[1] as ClienteCoop;
    await m.hacer(otro, {
      t: 'proponer',
      p: { puzzle: S1.id, etapa: 0, estado: etapa(0).solucion },
    });
    expect(m.host.foto?.propuesta).toBeNull();

    m.avanzar(61_000);
    expect(m.host.foto?.objetos).toEqual([
      { objeto: 'porteria-linterna', portador: null, sala: 's1-cooperativa' },
    ]);
    // D pasa al siguiente conectado en el orden: el primero (el anfitrión).
    expect(m.host.roles?.D).toBe(m.host.yo);
    await proponerTodos(m, m.host, 0);
    expect(m.host.foto?.etapas[0]).toBe(1);
    // Lo del piso lo puede recoger cualquiera.
    await m.hacer(otro, { t: 'recoger', p: { objeto: 'porteria-linterna' } });
    expect(m.host.foto?.objetos[0]?.portador).toBe(otro.yo);

    await d.reconectar();
    m.red.vaciar();
    expect(m.host.roles?.D).toBe(d.yo);
    expect(d.roles?.D).toBe(d.yo);
    expect(sinTiempo(d.foto)).toEqual(sinTiempo(m.host.foto));
  });

  it('el id de jugador se guarda en el navegador y se valida al leerlo', () => {
    const datos = new Map<string, string>();
    const almacen = {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
    } as unknown as Storage;
    const id = jugadorDelNavegador(almacen);
    expect(jugadorDelNavegador(almacen)).toBe(id);
    datos.set('la-ultima-prueba:jugador', '<script>');
    expect(jugadorDelNavegador(almacen)).not.toBe('<script>');
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    } as unknown as Storage;
    expect(jugadorDelNavegador(roto)).toMatch(/^j_[a-z0-9]{8}$/);
  });
});

describe('T90 · migración de anfitrión', () => {
  it('si el anfitrión falta 5 s asume el siguiente, pausa el reloj 3 s y el juego sigue', async () => {
    const m = await mesa(3);
    await empezarYEntrar(m);
    const [viejo, sucesor, tercero] = m.clientes as [ClienteCoop, ClienteCoop, ClienteCoop];
    red(viejo).desconectar();
    m.red.vaciar();
    m.avanzar(4000);
    expect(sucesor.anfitrion).toBeNull();
    m.avanzar(2000);
    expect(anfitrionActual(m)).toBe(sucesor);
    for (const c of [sucesor, tercero]) {
      expect(c.foto?.anfitrion).toBe(sucesor.yo);
      expect(c.foto?.reloj.pausado).toBe(true);
    }
    m.avanzar(4000);
    expect(tercero.foto?.reloj.pausado).toBe(false);

    // El juego sigue con el nuevo anfitrión: D (el tercero) propone y el otro confirma.
    await proponerTodos(m, tercero, 0);
    expect(tercero.foto?.etapas[0]).toBe(1);
    expect(sinTiempo(tercero.foto)).toEqual(sinTiempo(sucesor.foto));

    // El viejo anfitrión vuelve como jugador: deja de ser anfitrión y se pone al día.
    await viejo.reconectar();
    m.red.vaciar();
    m.avanzar(3000);
    expect(viejo.anfitrion).toBeNull();
    expect(anfitrionActual(m)).toBe(sucesor);
    expect(viejo.foto?.anfitrion).toBe(sucesor.yo);
    expect(viejo.foto?.etapas[0]).toBe(1);
    await m.hacer(viejo, { t: 'usar', p: { herramienta: null, objetivo: 's1-productos' } });
    expect(tercero.foto?.revelados).toContain('s1-productos');
  });

  it('si vuelve antes de 5 s, nadie migra y sigue siendo el anfitrión', async () => {
    const m = await mesa(2);
    await empezarYEntrar(m);
    const [host, otro] = m.clientes as [ClienteCoop, ClienteCoop];
    red(host).desconectar();
    m.red.vaciar();
    m.avanzar(2000);
    await host.reconectar();
    m.red.vaciar();
    m.avanzar(4000);
    expect(otro.anfitrion).toBeNull();
    expect(anfitrionActual(m)).toBe(host);
    await m.hacer(otro, { t: 'usar', p: { herramienta: null, objetivo: 's1-productos' } });
    expect(otro.foto?.revelados).toContain('s1-productos');
    expect(sinTiempo(otro.foto)).toEqual(sinTiempo(host.foto));
  });

  it('la migración también funciona en la sala de espera', async () => {
    const m = await mesa(3);
    const [viejo, sucesor, tercero] = m.clientes as [ClienteCoop, ClienteCoop, ClienteCoop];
    red(viejo).desconectar();
    m.red.vaciar();
    m.avanzar(6000);
    expect(anfitrionActual(m)).toBe(sucesor);
    await m.hacer(sucesor, { t: 'listo', p: { listo: true } });
    await m.hacer(tercero, { t: 'listo', p: { listo: true } });
    expect(tercero.foto?.fase).toBe('jugando');
    expect(tercero.foto?.orden).toEqual([sucesor.yo, tercero.yo]);
  });
});
