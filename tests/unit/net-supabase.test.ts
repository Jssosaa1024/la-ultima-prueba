import { describe, expect, it } from 'vitest';
import { crearTransporte } from '../../src/net';
import { TransportePestanas } from '../../src/net/pestanas';
import { intencion, directo, VERSION_CONTENIDO, type Identidad } from '../../src/net/protocolo';
import {
  TransporteSupabase,
  type CanalRealtime,
  type ClienteRealtime,
} from '../../src/net/supabase';

/**
 * T79 · Transporte con Supabase Realtime, probado con un cliente falso (no hay proyecto real
 * para probar: ver docs/supabase.md).
 */

const yo: Identidad = {
  jugador: 'j_supa0001',
  alias: 'buho',
  color: 'turquesa',
  unido_en: 5,
  version_contenido: VERSION_CONTENIDO,
};

interface Falso {
  cliente: ClienteRealtime;
  nombre: string;
  opciones: Record<string, unknown>;
  enviados: { event: string; payload: unknown }[];
  seguidos: unknown[];
  anonimos: number;
  emitir(event: string, payload: unknown): void;
  presencia(estado: Record<string, unknown[]>): void;
  estado(s: string): void;
}

function falso(opciones: { conSesion?: boolean; respuesta?: string; unir?: string } = {}): Falso {
  const broadcast = new Map<string, (m: { payload?: unknown }) => void>();
  let sync = () => {};
  let alEstado: (s: string) => void = () => {};
  let estadoPresencia: Record<string, unknown[]> = {};
  const f: Falso = {
    nombre: '',
    opciones: {},
    enviados: [],
    seguidos: [],
    anonimos: 0,
    emitir: (event, payload) => broadcast.get(event)?.({ payload }),
    presencia: (estado) => {
      estadoPresencia = estado;
      sync();
    },
    estado: (s) => alEstado(s),
    cliente: {
      auth: {
        getSession: async () => ({ data: { session: opciones.conSesion ? {} : null } }),
        signInAnonymously: async () => {
          f.anonimos++;
          return { error: null };
        },
      },
      realtime: { setAuth: async () => {} },
      channel: (nombre, opts) => {
        f.nombre = nombre;
        f.opciones = opts;
        const canal: CanalRealtime = {
          on: ((
            tipo: string,
            filtro: { event: string },
            fn: (m: { payload?: unknown }) => void,
          ) => {
            if (tipo === 'broadcast') broadcast.set(filtro.event, fn);
            else sync = fn as () => void;
            return canal;
          }) as CanalRealtime['on'],
          subscribe: (fn) => {
            alEstado = fn;
            queueMicrotask(() => fn(opciones.unir ?? 'SUBSCRIBED'));
            return canal;
          },
          track: async (d) => void f.seguidos.push(d),
          send: async (a) => {
            f.enviados.push({ event: a.event, payload: a.payload });
            return opciones.respuesta ?? 'ok';
          },
          presenceState: () => estadoPresencia,
          unsubscribe: async () => 'ok',
        };
        return canal;
      },
      removeChannel: async () => 'ok',
    },
  };
  return f;
}

const nuevo = (f: Falso) =>
  new TransporteSupabase({ url: 'u', clave: 'c', crearCliente: () => f.cliente, esperaMs: 200 });

describe('T79 · transporte de Supabase', () => {
  it('inicia sesión anónima, une el canal privado partida:{codigo} y publica la identidad', async () => {
    const f = falso();
    const t = nuevo(f);
    await t.unirse('K7MP', yo);
    expect(f.anonimos).toBe(1);
    expect(f.nombre).toBe('partida:K7MP');
    expect(f.opciones).toEqual({
      config: {
        private: true,
        broadcast: { self: false, ack: true },
        presence: { key: 'j_supa0001', enabled: true },
      },
    });
    expect(f.seguidos).toEqual([yo]);
  });

  it('con sesión guardada no crea otro usuario anónimo', async () => {
    const f = falso({ conSesion: true });
    await nuevo(f).unirse('K7MP', yo);
    expect(f.anonimos).toBe(0);
  });

  it('envía por Broadcast con el nombre del canal y espera el ack (salvo dir)', async () => {
    const f = falso();
    const t = nuevo(f);
    await t.unirse('K7MP', yo);
    const m = intencion(yo.jugador, `${yo.jugador}-1`, { t: 'listo', p: { listo: true } });
    expect(await t.enviar('int', m)).toBe(true);
    expect(
      await t.enviar(
        'dir',
        directo(yo.jugador, { t: 'pose', p: { s: 1, x: 0, y: 0, z: 0, yaw: 0 } }),
      ),
    ).toBe(true);
    expect(f.enviados.map((e) => e.event)).toEqual(['int', 'dir']);
    // Un mensaje inválido nunca sale.
    expect(await t.enviar('int', { ...m, cid: 'otro-1' })).toBe(false);
    expect(f.enviados).toHaveLength(2);
  });

  it('T92b: int y evt vuelven a quien los envía al confirmarse; dir no vuelve', async () => {
    const f = falso();
    const t = nuevo(f);
    await t.unirse('K7MP', yo);
    const propios: string[] = [];
    t.escuchar('int', (m) => propios.push(`int:${m.cid}`));
    t.escuchar('dir', (m) => propios.push(`dir:${m.de}`));
    const m = intencion(yo.jugador, `${yo.jugador}-1`, { t: 'listo', p: { listo: true } });
    expect(await t.enviar('int', m)).toBe(true);
    await t.enviar(
      'dir',
      directo(yo.jugador, { t: 'pose', p: { s: 1, x: 0, y: 0, z: 0, yaw: 0 } }),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(propios).toEqual([`int:${yo.jugador}-1`]);
  });

  it('T92b: si el servidor no confirma, la intención propia no vuelve', async () => {
    const f = falso({ respuesta: 'timed out' });
    const t = nuevo(f);
    await t.unirse('K7MP', yo);
    let n = 0;
    t.escuchar('int', () => n++);
    const m = intencion(yo.jugador, `${yo.jugador}-1`, { t: 'listo', p: { listo: true } });
    await t.enviar('int', m);
    expect(n).toBe(0);
  });

  it('si el servidor no confirma, enviar devuelve falso', async () => {
    const f = falso({ respuesta: 'timed out' });
    const t = nuevo(f);
    await t.unirse('K7MP', yo);
    const m = intencion(yo.jugador, `${yo.jugador}-1`, { t: 'listo', p: { listo: true } });
    expect(await t.enviar('int', m)).toBe(false);
  });

  it('valida lo que llega y arma Presence sin presence_ref', async () => {
    const f = falso();
    const t = nuevo(f);
    const recibidos: string[] = [];
    let presentes: string[] = [];
    t.escuchar('int', (m) => recibidos.push(m.cid));
    t.presencia((p) => (presentes = p.map((x) => x.jugador)));
    await t.unirse('K7MP', yo);
    f.emitir('int', intencion('j_otro0001', 'j_otro0001-4', { t: 'listo', p: { listo: false } }));
    f.emitir('int', { t: 'listo', texto: '<script>' });
    expect(recibidos).toEqual(['j_otro0001-4']);
    f.presencia({
      j_supa0001: [{ ...yo, presence_ref: 'abc' }],
      intruso: [{ jugador: 'j_x', alias: 'Pedro', presence_ref: 'def' }],
    });
    expect(presentes).toEqual(['j_supa0001']);
  });

  it('si no logra unirse, falla con un error claro', async () => {
    const f = falso({ unir: 'CHANNEL_ERROR' });
    await expect(nuevo(f).unirse('K7MP', yo)).rejects.toThrow('No se pudo unir al canal');
  });

  it('avisa cuando el canal se vuelve a unir tras una caída y vuelve a publicar la identidad', async () => {
    const f = falso();
    const t = nuevo(f);
    let avisos = 0;
    t.alReconectar(() => avisos++);
    await t.unirse('K7MP', yo);
    expect(avisos).toBe(0);
    f.estado('CHANNEL_ERROR');
    f.estado('SUBSCRIBED');
    expect(avisos).toBe(1);
    expect(f.seguidos).toHaveLength(2);
  });

  it('sin variables válidas se usa el transporte de pestañas', async () => {
    expect(await crearTransporte('supabase', {})).toBeInstanceOf(TransportePestanas);
    expect(await crearTransporte('pestanas', {})).toBeInstanceOf(TransportePestanas);
  });
});

describe('T78 · políticas del canal privado', () => {
  it('las políticas aceptan exactamente los códigos del juego y solo Broadcast y Presence', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { ALFABETO_CODIGO } = await import('../../src/net/protocolo');
    const dir = 'supabase/migrations';
    const sql = readdirSync(dir)
      .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
      .join('\n');
    const patrones = [...sql.matchAll(/~ '(\^partida:\[([^\]]+)\]\{4\}\$)'/g)];
    expect(patrones).toHaveLength(2);
    for (const [, , clase] of patrones) {
      const letras = (clase ?? '').replace('2-9', '23456789');
      expect([...letras].sort().join('')).toBe([...ALFABETO_CODIGO].sort().join(''));
    }
    expect(sql).toContain("extension in ('broadcast', 'presence')");
    expect(sql).not.toMatch(/to\s+anon\b/);
    expect(sql).not.toMatch(/create table/i);
  });

  it('el repositorio no guarda claves: solo el ejemplo vacío', async () => {
    const { readFileSync } = await import('node:fs');
    const ejemplo = readFileSync('.env.example', 'utf8');
    expect(ejemplo).toMatch(/^PUBLIC_SUPABASE_URL=$/m);
    expect(ejemplo).toMatch(/^PUBLIC_SUPABASE_ANON_KEY=$/m);
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/^\.env$/m);
  });
});
