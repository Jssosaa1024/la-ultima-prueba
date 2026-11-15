import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { partidaDeFoto, puedeIrA } from '../../src/signals/juego-coop';
import { ClienteCoop } from '../../src/net/cliente';
import { RedEnMemoria } from '../../src/net/memoria';
import { directo, VERSION_CONTENIDO, type Identidad } from '../../src/net/protocolo';
import { iniciarControladorCoop } from '../../src/signals/controlador-coop';
import {
  coop,
  misRoles,
  objetosFuera,
  propuestaCoop,
  senales,
  votosCoop,
} from '../../src/signals/coop';
import { datosEncontrados, notas } from '../../src/signals/cuaderno';
import { aviso, enfocado, panel, type AccionObjeto } from '../../src/signals/interfaz';
import { etapa, mecanismo, pistas, pistasVistas, resultado } from '../../src/signals/mecanismo';
import { avance, fase, inventario, modo, reloj, sala } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';
import type { Foto } from '../../src/game/coop/mensajes';

// T84b: en cooperativo el cliente copia lo que decide el anfitrión y solo envía intenciones.

const id = (jugador: string, unido_en: number): Identidad => ({
  jugador,
  alias: 'oso',
  color: 'coral',
  unido_en,
  version_contenido: VERSION_CONTENIDO,
});

describe('puertas en grupo', () => {
  const base = partidaDeFoto({
    fase: 'jugando',
    lugar: 'porteria',
    etapas: [0, 0, 0, 0, 0],
    final: null,
    grabaciones: [],
  } as unknown as Foto);

  it('solo se vota ir a una sala abierta o volver a la portería', () => {
    expect(puedeIrA(base, 's1-cooperativa')).toBe(true);
    expect(puedeIrA(base, 's2-laboratorio')).toBe(false);
    expect(puedeIrA(base, 'porteria')).toBe(false);
    expect(puedeIrA({ ...base, lugar: 's1-cooperativa' }, 'porteria')).toBe(true);
  });
});

describe('partida cooperativa en este navegador', () => {
  let red: RedEnMemoria;
  let otro: ClienteCoop;
  let detener: () => void;

  async function asentar(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(0);
      red.vaciar();
    }
  }

  /** Lo que haría el motor y el HUD: enfocar el objeto y tocar su botón. */
  async function tocar(objeto: string, nombre: string, accion: AccionObjeto): Promise<void> {
    enfocado.value = { id: objeto, nombre, accion };
    enviar({ t: 'accion', objeto, accion });
    await asentar();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    red = new RedEnMemoria({ retrasoMs: 10 });
    detener = iniciarControladorCoop({
      crearTransporte: async () => red.cliente(),
      almacen: null,
      busqueda: '?red=pestanas',
      ahora: () => red.ahora,
    });
    // El otro navegador crea la partida; este se une y queda segundo en el orden.
    otro = new ClienteCoop(red.cliente(), id('j_anfitrion', 1), () => red.ahora);
    await otro.crear('K7MP');
    enviar({ t: 'unirse', codigo: 'K7MP', alias: 'rana', color: 'violeta' });
    await asentar();
    await otro.enviar({ t: 'listo', p: { listo: true } });
    enviar({ t: 'listo', listo: true });
    await asentar();
  });
  afterEach(() => {
    detener();
    vi.useRealTimers();
  });

  it('empieza en la portería con el cuaderno de cada uno y el reloj del anfitrión', () => {
    expect(coop.value.estado).toBe('jugando');
    expect(modo.value).toBe('cooperativo');
    expect(fase.value).toBe('jugando');
    expect(sala.value).toBe('porteria');
    expect(reloj.value.pausado).toBe(false);
  });

  it('el reloj corre solo entre fotos del anfitrión', async () => {
    const antes = reloj.value;
    expect(antes.pausado).toBe(false);
    // Pasa un segundo: el controlador vuelve a publicar sin evento nuevo.
    await vi.advanceTimersByTimeAsync(1000);
    expect(reloj.value).toBe(antes);
  });

  it('examinar anota el dato para todos; recoger va al inventario de quien recoge', async () => {
    await tocar('porteria-reloj', 'Reloj de pared', 'examinar');
    expect(panel.value).toBe('inspeccion');
    expect(datosEncontrados.value).toContain('porteria-reloj');
    expect(otro.foto?.revelados).toContain('porteria-reloj');

    await tocar('porteria-linterna', 'Linterna', 'recoger');
    expect(inventario.value.map((o) => o.id)).toEqual(['porteria-linterna']);
  });

  it('lo que lleva otro no se ve en la escena; si me lo pasa, va a mi inventario (T84c)', async () => {
    expect(objetosFuera.value).toEqual([]);
    await otro.enviar({ t: 'recoger', p: { objeto: 'porteria-linterna' } });
    await asentar();
    expect(objetosFuera.value).toEqual(['porteria-linterna']);
    expect(inventario.value).toEqual([]);

    const yo = coop.value.jugadores.find((j) => j.yo)?.jugador ?? '';
    await otro.enviar({ t: 'pasar', p: { objeto: 'porteria-linterna', a: yo } });
    await asentar();
    expect(objetosFuera.value).toEqual(['porteria-linterna']);
    expect(inventario.value.map((o) => o.id)).toEqual(['porteria-linterna']);
  });

  it('la pizarra en penumbra pide la linterna', async () => {
    await otro.enviar({
      t: 'votar',
      p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true },
    });
    enviar({ t: 'votar', asunto: 'sala', opcion: 's1-cooperativa', acepta: true });
    await asentar();
    expect(sala.value).toBe('s1-cooperativa');
    await tocar('s1-pizarra', 'Pizarra de precios', 'examinar');
    expect(aviso.value).toMatchObject({ t: 'necesita_herramienta', objeto: 's1-pizarra' });
    expect(datosEncontrados.value).not.toContain('s1-pizarra');
  });

  it('una puerta abre el voto de sala; con todos de acuerdo el grupo entra', async () => {
    await tocar('porteria-puerta-1', 'Puerta 1', 'usar');
    expect(votosCoop.value).toEqual([
      { asunto: 'sala', opcion: 's1-cooperativa', votos: [coop.value.jugadores[1]?.jugador] },
    ]);
    expect(sala.value).toBe('porteria');
    await otro.enviar({
      t: 'votar',
      p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true },
    });
    await asentar();
    expect(sala.value).toBe('s1-cooperativa');
    // Con 2 jugadores, en la sala 1 el segundo tiene C y D.
    expect(misRoles.value).toEqual(['C', 'D']);
  });

  it('D prueba en su panel, propone, el otro acepta y la máquina responde', async () => {
    await otro.enviar({
      t: 'votar',
      p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true },
    });
    enviar({ t: 'votar', asunto: 'sala', opcion: 's1-cooperativa', acepta: true });
    await asentar();
    expect(etapa.value).toMatchObject({ puzzle: 's1-etiquetadora', etapa: 0 });

    // Probar en el panel no viaja: el anfitrión no ve nada todavía.
    const prueba = { producto: 'jugo', precio: 2000, rodillos: [-20] };
    enviar({ t: 'ajustar', estado: prueba });
    await asentar();
    expect(mecanismo.value).toEqual(prueba);
    expect(otro.foto?.propuesta).toBeNull();

    // La palanca, en grupo, propone esos ajustes.
    enviar({ t: 'accionar', objeto: 's1-palanca' });
    await asentar();
    expect(propuestaCoop.value).toMatchObject({ etapa: 0, estado: prueba });
    expect(avance.value['s1-cooperativa']).toBe(0);

    const propuesta = otro.foto?.propuesta?.id ?? 0;
    await otro.enviar({ t: 'confirmar', p: { propuesta, acepta: true } });
    await asentar();
    expect(resultado.value).toMatchObject({ etapa: 0, resuelta: true, estado: prueba });
    expect(avance.value['s1-cooperativa']).toBe(1);
    expect(etapa.value).toMatchObject({ etapa: 1 });
    expect(propuestaCoop.value).toBeNull();
  });

  it('una pista que abre uno queda en el cuaderno de todos (T86)', async () => {
    await otro.enviar({
      t: 'votar',
      p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true },
    });
    enviar({ t: 'votar', asunto: 'sala', opcion: 's1-cooperativa', acepta: true });
    await asentar();
    // Pasa el tiempo de la primera pista; el anfitrión la ofrece y lo cuenta en su foto.
    red.avanzar(200_000);
    otro.tick();
    await asentar();
    expect(pistas.value.ofrecidas).toBeGreaterThan(0);
    await otro.enviar({ t: 'pedir_pista', p: { puzzle: 's1-etiquetadora' } });
    await asentar();
    expect(pistasVistas.value).toEqual({ 's1-cooperativa': 1 });
    expect(pistas.value.vistas).toBe(1);
  });

  it('señales y frases rápidas: viaja el id y el punto del objeto enfocado (T91)', async () => {
    const recibidas: unknown[] = [];
    otro.t.escuchar('dir', (m) => recibidas.push(m.p));
    enfocado.value = { id: 'porteria-reloj', nombre: 'Reloj de pared', accion: 'examinar' };
    enviar({ t: 'senal', frase: 'mira' });
    // Una por segundo: la segunda se ignora.
    enviar({ t: 'senal', frase: 'ven' });
    await asentar();
    expect(recibidas).toEqual([
      { s: 0, x: expect.any(Number), y: expect.any(Number), z: expect.any(Number), frase: 'mira' },
    ]);
    expect(senales.value.map((x) => x.frase)).toEqual(['mira']);

    await otro.t.enviar(
      'dir',
      directo(otro.yo, { t: 'senal', p: { s: 0, x: 0, y: 0, z: 0, frase: 'aqui' } }),
    );
    await asentar();
    expect(senales.value.at(-1)).toMatchObject({ jugador: otro.yo, frase: 'aqui' });
  });

  it('las notas del cuaderno se quedan en este navegador', async () => {
    const antes = red.enviados.int;
    enviar({ t: 'nota', op: 'agregar', texto: '  la empanada sube  ' });
    await asentar();
    expect(notas.value).toEqual([{ id: 'n1', texto: 'la empanada sube' }]);
    expect(red.enviados.int).toBe(antes);
  });
});
