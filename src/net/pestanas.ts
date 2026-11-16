import {
  esJugador,
  esIdentidad,
  validar,
  CANALES,
  type Canal,
  type Identidad,
  type SobreDe,
} from './protocolo';
import { esObjeto } from '../game/puzzles/tipos';
import { Oyentes, revisarUnion, type Transporte } from './transporte';

/**
 * Transporte de prueba entre pestañas del mismo navegador con BroadcastChannel (T80). Sirve
 * para las pruebas e2e y para probar el cooperativo sin Supabase. Solo se activa si no hay
 * variables de Supabase o con `?red=pestanas` (ver `elegirRed` en `index.ts`).
 *
 * Presence se imita con latidos: cada pestaña anuncia su identidad cada segundo y se da por
 * ida si deja de latir 3,5 s. Lo que llega de otra pestaña se valida igual que lo de Supabase.
 */

const LATIDO_MS = 1000;
const CADUCA_MS = 3500;

type Paquete =
  | { k: 'msg'; canal: Canal; m: unknown }
  | { k: 'latido'; id: Identidad; responder: boolean }
  | { k: 'adios'; jugador: string };

export interface OpcionesPestanas {
  /** Fábrica del canal (en pruebas se puede cambiar). */
  crearCanal?: (nombre: string) => BroadcastChannel;
  ahora?: () => number;
}

export class TransportePestanas implements Transporte {
  private readonly oyentes = new Oyentes();
  private canal: BroadcastChannel | null = null;
  private identidad: Identidad | null = null;
  private readonly vistos = new Map<string, { id: Identidad; visto: number }>();
  private reloj: ReturnType<typeof setInterval> | null = null;
  private readonly crearCanal: (nombre: string) => BroadcastChannel;
  private readonly ahora: () => number;

  constructor(opciones: OpcionesPestanas = {}) {
    this.crearCanal = opciones.crearCanal ?? ((n) => new BroadcastChannel(n));
    this.ahora = opciones.ahora ?? (() => Date.now());
  }

  async unirse(codigo: string, identidad: Identidad): Promise<void> {
    revisarUnion(codigo, identidad);
    await this.salir();
    this.identidad = identidad;
    const canal = this.crearCanal(`la-ultima-prueba:partida:${codigo}`);
    this.canal = canal;
    canal.onmessage = (e: MessageEvent) => this.alRecibir(e.data);
    this.vistos.set(identidad.jugador, { id: identidad, visto: this.ahora() });
    this.publicarPresencia();
    this.latir(true);
    this.reloj = setInterval(() => {
      this.latir(false);
      this.caducar();
    }, LATIDO_MS);
  }

  async enviar<C extends Canal>(canal: C, mensaje: SobreDe<C>): Promise<boolean> {
    if (!this.canal || !validar(canal, mensaje).ok) return false;
    const paquete: Paquete = { k: 'msg', canal, m: mensaje };
    this.canal.postMessage(paquete);
    // BroadcastChannel no entrega a quien envía: se imita la entrega propia de `int` y `evt`.
    // `dir` no vuelve (T92b), igual que en Supabase.
    if (canal !== 'dir') {
      const copia = structuredClone(mensaje);
      queueMicrotask(() => this.oyentes.recibir(canal, copia));
    }
    return true;
  }

  escuchar<C extends Canal>(canal: C, fn: (m: SobreDe<C>) => void): () => void {
    return this.oyentes.escuchar(canal, fn);
  }

  presencia(fn: (p: readonly Identidad[]) => void): () => void {
    return this.oyentes.presencia(fn);
  }

  async salir(): Promise<void> {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
    if (this.canal && this.identidad) {
      const adios: Paquete = { k: 'adios', jugador: this.identidad.jugador };
      this.canal.postMessage(adios);
    }
    this.canal?.close();
    this.canal = null;
    this.vistos.clear();
  }

  private latir(responder: boolean): void {
    if (!this.canal || !this.identidad) return;
    this.vistos.set(this.identidad.jugador, { id: this.identidad, visto: this.ahora() });
    const latido: Paquete = { k: 'latido', id: this.identidad, responder };
    this.canal.postMessage(latido);
  }

  private caducar(): void {
    const limite = this.ahora() - CADUCA_MS;
    let cambio = false;
    for (const [jugador, v] of this.vistos) {
      if (jugador !== this.identidad?.jugador && v.visto < limite) {
        this.vistos.delete(jugador);
        cambio = true;
      }
    }
    if (cambio) this.publicarPresencia();
  }

  private publicarPresencia(): void {
    this.oyentes.cambioPresencia([...this.vistos.values()].map((v) => v.id));
  }

  /** Todo lo que llega de otra pestaña es dato no confiable. */
  private alRecibir(x: unknown): void {
    if (!esObjeto(x)) return;
    if (x['k'] === 'msg') {
      const canal = x['canal'];
      if (typeof canal === 'string' && (CANALES as readonly string[]).includes(canal)) {
        this.oyentes.recibir(canal as Canal, x['m']);
      }
    } else if (x['k'] === 'latido' && esIdentidad(x['id'])) {
      const id = x['id'];
      const nuevo = !this.vistos.has(id.jugador);
      this.vistos.set(id.jugador, { id, visto: this.ahora() });
      if (nuevo) this.publicarPresencia();
      // A quien acaba de llegar se le responde para que conozca a todos sin esperar.
      if (x['responder'] === true) this.latir(false);
    } else if (x['k'] === 'adios' && esJugador(x['jugador'])) {
      if (this.vistos.delete(x['jugador'])) this.publicarPresencia();
    }
  }
}
