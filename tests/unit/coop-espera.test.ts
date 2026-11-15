import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Foto } from '../../src/game/coop/mensajes';
import { ClienteCoop } from '../../src/net/cliente';
import { RedEnMemoria } from '../../src/net/memoria';
import { VERSION_CONTENIDO, type Identidad } from '../../src/net/protocolo';
import { iniciarControladorCoop } from '../../src/signals/controlador-coop';
import { coop, jugadoresDeFoto, puedeIniciar, type JugadorCoop } from '../../src/signals/coop';
import { fase, modo, sala } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';

// T32 y T81: crear, unirse, sala de espera e inicio del cooperativo.

const id = (jugador: string, alias: Identidad['alias'], unido_en: number): Identidad => ({
  jugador,
  alias,
  color: 'turquesa',
  unido_en,
  version_contenido: VERSION_CONTENIDO,
});

describe('jugadores de la sala de espera', () => {
  const foto = { orden: ['j_aaaa', 'j_bbbb'], listos: ['j_bbbb'], anfitrion: 'j_aaaa' } as Foto;

  it('junta el orden de la partida con el alias de Presence y marca quién falta', () => {
    const a = id('j_aaaa', 'zorro', 1);
    const b = id('j_bbbb', 'buho', 2);
    const lista = jugadoresDeFoto(foto, [a], new Map([['j_bbbb', b]]), 'j_bbbb');
    expect(lista).toEqual([
      { ...pick(a), listo: false, conectado: true, anfitrion: true, yo: false },
      { ...pick(b), listo: true, conectado: false, anfitrion: false, yo: true },
    ]);
  });

  it('el anfitrión inicia con dos o más conectados y todos los demás listos', () => {
    const j = (listo: boolean, anfitrion = false, conectado = true): JugadorCoop => ({
      jugador: 'j_x',
      alias: 'oso',
      color: 'coral',
      listo,
      conectado,
      anfitrion,
      yo: false,
    });
    expect(puedeIniciar([j(false, true)])).toBe(false);
    expect(puedeIniciar([j(false, true), j(false)])).toBe(false);
    expect(puedeIniciar([j(false, true), j(true)])).toBe(true);
    // Quien se desconectó no detiene el inicio.
    expect(puedeIniciar([j(false, true), j(true), j(false, false, false)])).toBe(true);
  });
});

function pick(i: Identidad) {
  return { jugador: i.jugador, alias: i.alias, color: i.color };
}

describe('controlador cooperativo', () => {
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

  /** Deja correr promesas y entrega lo pendiente en la red. */
  async function asentar(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(0);
      red.vaciar();
    }
  }

  it('crea la partida, recibe a otro jugador y empieza cuando el anfitrión inicia', async () => {
    enviar({ t: 'crear_partida', alias: 'zorro', color: 'ambar' });
    await asentar();
    const codigo = coop.value.codigo;
    expect(coop.value).toMatchObject({ estado: 'espera', soyAnfitrion: true, soloPestanas: true });
    expect(codigo).toMatch(/^[A-Z2-9]{4}$/);

    const otro = new ClienteCoop(red.cliente(), id('j_otro1', 'buho', Date.now()), () => red.ahora);
    await otro.unirse(codigo ?? '');
    await asentar();
    expect(coop.value.jugadores.map((j) => [j.alias, j.yo, j.listo])).toEqual([
      ['zorro', true, false],
      ['buho', false, false],
    ]);
    expect(puedeIniciar(coop.value.jugadores)).toBe(false);

    await otro.enviar({ t: 'listo', p: { listo: true } });
    await asentar();
    expect(puedeIniciar(coop.value.jugadores)).toBe(true);

    enviar({ t: 'listo', listo: true });
    await asentar();
    expect(coop.value.estado).toBe('jugando');
    expect(fase.value).toBe('jugando');
    expect(modo.value).toBe('cooperativo');
    expect(sala.value).toBe('porteria');

    enviar({ t: 'salir' });
    await asentar();
    expect(coop.value.estado).toBe('inactivo');
    expect(fase.value).toBe('inicio');
  });

  it('un código que nadie creó termina en «no encontrada»', async () => {
    enviar({ t: 'unirse', codigo: 'zzzz', alias: 'rana', color: 'violeta' });
    await asentar();
    expect(coop.value).toMatchObject({ estado: 'conectando', codigo: 'ZZZZ' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(coop.value).toMatchObject({ estado: 'error', error: 'no_encontrada' });
  });

  it('un código con letras que no existen en el alfabeto no se intenta', async () => {
    enviar({ t: 'unirse', codigo: 'K0MP', alias: 'rana', color: 'violeta' });
    await asentar();
    expect(coop.value.estado).toBe('inactivo');
  });

  it('el quinto jugador recibe «llena»', async () => {
    const anfitrion = new ClienteCoop(red.cliente(), id('j_host1', 'oso', 1), () => red.ahora);
    await anfitrion.crear('K7MP');
    for (let k = 2; k <= 4; k++) {
      const c = new ClienteCoop(red.cliente(), id(`j_otro${k}`, 'mono', k), () => red.ahora);
      await c.unirse('K7MP');
      red.vaciar();
    }
    enviar({ t: 'unirse', codigo: 'K7MP', alias: 'rana', color: 'violeta' });
    await asentar();
    expect(coop.value).toMatchObject({ estado: 'error', error: 'llena' });
  });
});
