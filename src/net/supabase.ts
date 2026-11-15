import { createClient } from '@supabase/supabase-js';
import { esObjeto } from '../game/puzzles/tipos';
import { CANALES, validar, type Canal, type Identidad, type SobreDe } from './protocolo';
import { Oyentes, revisarUnion, type Transporte } from './transporte';

/**
 * Transporte real con Supabase Realtime (T79). Se carga con `import()` solo en el
 * cooperativo, así que la librería no pesa en el modo individual.
 *
 * - Sesión anónima (Auth): sin correo ni nombre. La sesión queda en el navegador, así que
 *   recargar no crea otro usuario.
 * - Canal privado `partida:{codigo}`: lo protegen las políticas RLS de
 *   `supabase/migrations/` (T78).
 * - Broadcast con `self: true` (el anfitrión recibe sus propias intenciones) y `ack: true`
 *   (para `int` y `evt` se espera la confirmación del servidor; `dir` no la espera).
 * - Presence guarda solo la identidad, una vez al unirse.
 *
 * Usa solo la URL y la clave pública (anon) de `PUBLIC_*`. Nunca la `service_role`.
 */

/** Lo poco que se usa del canal de Supabase (así se puede probar sin red). */
export interface CanalRealtime {
  on(
    tipo: 'broadcast',
    filtro: { event: string },
    fn: (m: { payload?: unknown }) => void,
  ): CanalRealtime;
  on(tipo: 'presence', filtro: { event: 'sync' }, fn: () => void): CanalRealtime;
  subscribe(fn: (estado: string, error?: Error) => void): CanalRealtime;
  track(datos: Record<string, unknown>): Promise<unknown>;
  send(args: { type: 'broadcast'; event: string; payload: unknown }): Promise<string>;
  presenceState(): Record<string, unknown[]>;
  unsubscribe(): Promise<unknown>;
}

/** Lo poco que se usa del cliente de Supabase. */
export interface ClienteRealtime {
  auth: {
    getSession(): Promise<{ data: { session: unknown } }>;
    signInAnonymously(): Promise<{ error: unknown }>;
  };
  realtime: { setAuth(token?: string | null): Promise<void> | void };
  channel(nombre: string, opciones: Record<string, unknown>): CanalRealtime;
  removeChannel(canal: CanalRealtime): Promise<unknown>;
}

export interface OpcionesSupabase {
  url: string;
  clave: string;
  /** Fábrica del cliente (las pruebas pasan uno falso). */
  crearCliente?: (url: string, clave: string) => ClienteRealtime;
  /** Cuánto esperar la unión al canal antes de rendirse. */
  esperaMs?: number;
}

const crearClienteReal = (url: string, clave: string): ClienteRealtime =>
  createClient(url, clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }) as unknown as ClienteRealtime;

export class TransporteSupabase implements Transporte {
  private readonly oyentes = new Oyentes();
  private readonly cliente: ClienteRealtime;
  private canal: CanalRealtime | null = null;
  private unido = false;
  private readonly reconexiones = new Set<() => void>();
  private readonly esperaMs: number;

  constructor(opciones: OpcionesSupabase) {
    this.cliente = (opciones.crearCliente ?? crearClienteReal)(opciones.url, opciones.clave);
    this.esperaMs = opciones.esperaMs ?? 10_000;
  }

  async unirse(codigo: string, identidad: Identidad): Promise<void> {
    revisarUnion(codigo, identidad);
    await this.salir();
    await this.sesionAnonima();
    // Los canales privados autorizan con el token de la sesión.
    await this.cliente.realtime.setAuth();
    const canal = this.cliente.channel(`partida:${codigo}`, {
      config: {
        private: true,
        broadcast: { self: true, ack: true },
        presence: { key: identidad.jugador, enabled: true },
      },
    });
    this.canal = canal;
    for (const c of CANALES) {
      canal.on('broadcast', { event: c }, (m) => this.oyentes.recibir(c, m.payload));
    }
    canal.on('presence', { event: 'sync' }, () => this.alPresencia());

    await new Promise<void>((resolver, rechazar) => {
      const plazo = setTimeout(
        () => rechazar(new Error('No se pudo unir al canal')),
        this.esperaMs,
      );
      canal.subscribe((estado) => {
        if (estado === 'SUBSCRIBED') {
          clearTimeout(plazo);
          const volvio = this.unido;
          this.unido = true;
          // Presence se escribe una vez por unión (Supabase permite 5 llamadas cada 30 s).
          void canal.track({ ...identidad });
          if (volvio) for (const fn of [...this.reconexiones]) fn();
          resolver();
        } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
          if (!this.unido) {
            clearTimeout(plazo);
            rechazar(new Error('No se pudo unir al canal'));
          }
        }
      });
    });
  }

  async enviar<C extends Canal>(canal: C, mensaje: SobreDe<C>): Promise<boolean> {
    if (!this.canal || !this.unido || !validar(canal, mensaje).ok) return false;
    const envio = this.canal.send({ type: 'broadcast', event: canal, payload: mensaje });
    // Las poses no esperan confirmación: van a 4 Hz y una perdida no importa.
    if (canal === 'dir') {
      void envio.catch(() => undefined);
      return true;
    }
    try {
      return (await envio) === 'ok';
    } catch {
      return false;
    }
  }

  escuchar<C extends Canal>(canal: C, fn: (m: SobreDe<C>) => void): () => void {
    return this.oyentes.escuchar(canal, fn);
  }

  presencia(fn: (p: readonly Identidad[]) => void): () => void {
    return this.oyentes.presencia(fn);
  }

  /** Avisa cuando el canal se vuelve a unir tras una caída (para `ClienteCoop`, T89/T90). */
  alReconectar(fn: () => void): () => void {
    this.reconexiones.add(fn);
    return () => this.reconexiones.delete(fn);
  }

  async salir(): Promise<void> {
    const canal = this.canal;
    this.canal = null;
    this.unido = false;
    if (canal) {
      try {
        await this.cliente.removeChannel(canal);
      } catch {
        // Si ya no hay conexión, no hay nada que cerrar.
      }
    }
  }

  private async sesionAnonima(): Promise<void> {
    const { data } = await this.cliente.auth.getSession();
    if (data.session) return;
    const { error } = await this.cliente.auth.signInAnonymously();
    if (error) throw new Error('No se pudo iniciar la sesión anónima');
  }

  private alPresencia(): void {
    if (!this.canal) return;
    const lista: unknown[] = [];
    for (const entradas of Object.values(this.canal.presenceState())) {
      for (const e of entradas) {
        if (!esObjeto(e)) continue;
        // Supabase agrega `presence_ref`; lo demás es la identidad, que se valida entera.
        lista.push(Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'presence_ref')));
      }
    }
    this.oyentes.cambioPresencia(lista);
  }
}
