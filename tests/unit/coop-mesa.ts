import { expect } from 'vitest';
import { PUZZLES } from '../../src/content/puzzles';
import type { Evento, Foto, Intencion } from '../../src/game/coop/mensajes';
import { fotoEn } from '../../src/game/coop/sesion';
import type { Rol } from '../../src/game/reparto';
import { ClienteCoop } from '../../src/net/cliente';
import { RedEnMemoria, type OpcionesRed } from '../../src/net/memoria';
import { VERSION_CONTENIDO, type Identidad } from '../../src/net/protocolo';

/** Ayudas comunes de las pruebas del cooperativo: una mesa de N clientes en la red en memoria. */

function puzzleSala1() {
  const p = PUZZLES[0];
  if (!p) throw new Error('falta el puzzle de la sala 1');
  return p;
}
export const S1 = puzzleSala1();

export const identidad = (
  jugador: string,
  unido_en: number,
  version = VERSION_CONTENIDO,
): Identidad => ({
  jugador,
  alias: 'zorro',
  color: 'ambar',
  unido_en,
  version_contenido: version,
});

export interface Mesa {
  red: RedEnMemoria;
  clientes: ClienteCoop[];
  eventos: Evento[];
  host: ClienteCoop;
  /** Envía y entrega todo lo que eso provoque. */
  hacer(c: ClienteCoop, i: Intencion): Promise<void>;
  /** Cliente que tiene ese encargo en la sala actual. */
  con(rol: Rol): ClienteCoop;
  /** Todos votan lo mismo. */
  votarTodos(i: Intencion): Promise<void>;
  avanzar(ms: number): void;
}

export async function mesa(n: number, opciones: OpcionesRed = { retrasoMs: 40 }): Promise<Mesa> {
  const red = new RedEnMemoria(opciones);
  const clientes = Array.from(
    { length: n },
    (_, i) =>
      new ClienteCoop(red.cliente(), identidad(`j_jugador${i + 1}`, 1000 + i), () => red.ahora),
  );
  const [host, ...otros] = clientes;
  if (!host) throw new Error('sin anfitrión');
  const eventos: Evento[] = [];
  host.alCambiar((e) => eventos.push(e));
  await host.crear('K7MP');
  red.vaciar();
  for (const c of otros) {
    await c.unirse('K7MP');
    red.vaciar();
  }
  const m: Mesa = {
    red,
    clientes,
    eventos,
    host,
    async hacer(c, i) {
      expect(await c.enviar(i)).toBe(true);
      red.vaciar();
    },
    con(rol) {
      const roles = host.roles;
      const c = clientes.find((x) => roles?.[rol] === x.yo);
      if (!c) throw new Error(`nadie tiene ${rol}`);
      return c;
    },
    async votarTodos(i) {
      for (const c of clientes) await c.enviar(i);
      red.vaciar();
    },
    avanzar(ms) {
      for (let t = 0; t < ms; t += 1000) {
        red.avanzar(Math.min(1000, ms - t));
        for (const c of clientes) c.tick();
        red.vaciar();
      }
    },
  };
  return m;
}

/** Lo que todas las copias deben tener igual al anfitrión (sin los campos de tiempo). */
export function sinTiempo(f: Foto | null) {
  if (!f) return null;
  return {
    ...f,
    reloj: { pausado: f.reloj.pausado },
    pistas: f.pistas.map((p) => ({
      ofrecidas: p.ofrecidas,
      vistas: p.vistas,
      intentos: p.intentos,
    })),
    ausentes: f.ausentes.map((a) => a.jugador),
  };
}

export function copiasIguales(m: Mesa) {
  const s = m.host.anfitrion?.sesion;
  if (!s) throw new Error('sin sesión');
  const esperada = sinTiempo(fotoEn(s, m.red.ahora));
  for (const c of m.clientes) expect(sinTiempo(c.foto), c.yo).toEqual(esperada);
}

export const etapa = (k: number) => {
  const e = S1.etapas[k];
  if (!e) throw new Error('etapa');
  return e;
};

export async function empezarYEntrar(m: Mesa) {
  for (const c of m.clientes) await m.hacer(c, { t: 'listo', p: { listo: true } });
  expect(m.clientes.every((c) => c.foto?.fase === 'jugando')).toBe(true);
  // Alguien recoge la linterna en la portería antes de entrar.
  await m.hacer(m.host, { t: 'recoger', p: { objeto: 'porteria-linterna' } });
  await m.votarTodos({ t: 'votar', p: { asunto: 'sala', opcion: 's1-cooperativa', acepta: true } });
  expect(m.clientes.every((c) => c.foto?.lugar === 's1-cooperativa')).toBe(true);
  expect(m.clientes.every((c) => c.roles?.sala === 1)).toBe(true);
}

export async function proponerYConfirmar(m: Mesa, k: number, estado: unknown) {
  const d = m.con('D');
  await m.hacer(d, { t: 'proponer', p: { puzzle: S1.id, etapa: k, estado } });
  const id = m.host.foto?.propuesta?.id;
  for (const c of m.clientes) {
    if (c !== d && id !== undefined)
      await c.enviar({ t: 'confirmar', p: { propuesta: id, acepta: true } });
  }
  m.red.vaciar();
}
