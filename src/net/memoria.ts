import { validar, type Canal, type Identidad, type SobreDe } from './protocolo';
import { Oyentes, revisarUnion, type Transporte } from './transporte';

/**
 * Red en memoria para Vitest (T80): varios clientes en el mismo proceso, con retraso y
 * pérdida configurables y un reloj propio que avanza solo cuando la prueba lo pide
 * (`avanzar`). Así las pruebas no esperan de verdad y siempre dan lo mismo.
 */

export interface OpcionesRed {
  /** Milisegundos que tarda cada mensaje (fijo o por par emisor → receptor). */
  retrasoMs?: number | ((de: string, a: string) => number);
  /** Probabilidad de perder cada entrega, de 0 a 1 (fija o por canal y par emisor → receptor). */
  perdida?: number | ((canal: Canal, de: string, a: string) => number);
  /** Semilla del azar de la pérdida, para que las pruebas se repitan igual. */
  semilla?: number;
}

interface Entrega {
  cuando: number;
  orden: number;
  a: ClienteMemoria;
  canal: Canal;
  dato: unknown;
}

/** Azar con semilla (mulberry32). */
function azarConSemilla(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RedEnMemoria {
  /** Reloj de la red, en ms. */
  ahora = 0;
  /** Mensajes enviados por canal (para medir eventos por segundo, T92). */
  readonly enviados: Record<Canal, number> = { int: 0, evt: 0, dir: 0 };
  private readonly cola: Entrega[] = [];
  private readonly salas = new Map<string, Set<ClienteMemoria>>();
  private orden = 0;
  private readonly azar: () => number;

  constructor(private readonly opciones: OpcionesRed = {}) {
    this.azar = azarConSemilla(opciones.semilla ?? 1);
  }

  /** Cliente nuevo de esta red (un navegador). */
  cliente(): ClienteMemoria {
    return new ClienteMemoria(this);
  }

  /** Cambia la pérdida o el retraso en medio de una prueba. */
  configurar(opciones: OpcionesRed): void {
    Object.assign(this.opciones, opciones);
  }

  /** Avanza el reloj y entrega lo que toque, en orden de llegada. */
  avanzar(ms: number): void {
    const hasta = this.ahora + Math.max(0, ms);
    for (;;) {
      this.cola.sort((a, b) => a.cuando - b.cuando || a.orden - b.orden);
      const sig = this.cola[0];
      if (!sig || sig.cuando > hasta) break;
      this.cola.shift();
      this.ahora = Math.max(this.ahora, sig.cuando);
      sig.a.entregar(sig.canal, sig.dato);
    }
    this.ahora = hasta;
  }

  /** Entrega todo lo pendiente (y lo que eso genere) sin límite de tiempo. */
  vaciar(maxRondas = 1000): void {
    for (let i = 0; i < maxRondas && this.cola.length > 0; i++) {
      const ultimo = Math.max(...this.cola.map((e) => e.cuando));
      this.avanzar(Math.max(0, ultimo - this.ahora));
    }
  }

  /** @internal */
  unir(codigo: string, c: ClienteMemoria): void {
    let sala = this.salas.get(codigo);
    if (!sala) this.salas.set(codigo, (sala = new Set()));
    sala.add(c);
    this.avisarPresencia(codigo);
  }

  /** @internal */
  separar(codigo: string, c: ClienteMemoria): void {
    this.salas.get(codigo)?.delete(c);
    this.avisarPresencia(codigo);
  }

  /** @internal */
  difundir(codigo: string, de: ClienteMemoria, canal: Canal, dato: unknown): void {
    this.enviados[canal]++;
    for (const a of this.salas.get(codigo) ?? []) {
      const propio = a === de;
      // T92b: las poses y señales no vuelven a quien las envía (como en Supabase).
      if (propio && canal === 'dir') continue;
      // Las entregas a uno mismo no se pierden ni se retrasan (no pasan por la red).
      const p = this.opciones.perdida ?? 0;
      const perdida = typeof p === 'number' ? p : p(canal, de.yo, a.yo);
      if (!propio && this.azar() < perdida) continue;
      const r = this.opciones.retrasoMs ?? 0;
      const retraso = propio ? 0 : typeof r === 'number' ? r : r(de.yo, a.yo);
      this.cola.push({
        cuando: this.ahora + Math.max(0, retraso),
        orden: this.orden++,
        a,
        canal,
        dato: structuredClone(dato),
      });
    }
  }

  private avisarPresencia(codigo: string): void {
    const sala = [...(this.salas.get(codigo) ?? [])];
    const lista = sala.flatMap((c) => (c.identidad ? [c.identidad] : []));
    for (const c of sala) c.oyentes.cambioPresencia(lista);
  }
}

export class ClienteMemoria implements Transporte {
  readonly oyentes = new Oyentes();
  identidad: Identidad | null = null;
  private codigo: string | null = null;

  constructor(private readonly red: RedEnMemoria) {}

  get yo(): string {
    return this.identidad?.jugador ?? '';
  }

  get conectado(): boolean {
    return this.codigo !== null;
  }

  async unirse(codigo: string, identidad: Identidad): Promise<void> {
    revisarUnion(codigo, identidad);
    this.identidad = identidad;
    this.codigo = codigo;
    this.red.unir(codigo, this);
  }

  async enviar<C extends Canal>(canal: C, mensaje: SobreDe<C>): Promise<boolean> {
    if (!this.codigo || !validar(canal, mensaje).ok) return false;
    this.red.difundir(this.codigo, this, canal, mensaje);
    return true;
  }

  escuchar<C extends Canal>(canal: C, fn: (m: SobreDe<C>) => void): () => void {
    return this.oyentes.escuchar(canal, fn);
  }

  presencia(fn: (p: readonly Identidad[]) => void): () => void {
    return this.oyentes.presencia(fn);
  }

  /** Simula que se cae la conexión: sale de Presence y deja de recibir, sin despedirse. */
  desconectar(): void {
    if (!this.codigo) return;
    this.red.separar(this.codigo, this);
    this.codigo = null;
  }

  /** Vuelve al mismo canal con la misma identidad (T89). */
  async reconectar(codigo: string): Promise<void> {
    if (this.identidad) await this.unirse(codigo, this.identidad);
  }

  async salir(): Promise<void> {
    this.desconectar();
    this.oyentes.limpiar();
  }

  /** @internal */
  entregar(canal: Canal, dato: unknown): void {
    if (this.codigo) this.oyentes.recibir(canal, dato);
  }
}
