import type { Evento, Foto, Intencion, MotivoRechazo } from '../game/coop/mensajes';
import { aplicarEvento } from '../game/coop/replica';
import type { Reparto } from '../game/reparto';
import { Anfitrion } from './anfitrion';
import { intencion, type Identidad, type SobreEvt } from './protocolo';
import type { Transporte } from './transporte';

/**
 * Un jugador del cooperativo (T84–T90): envía intenciones con su `cid` y mantiene la copia
 * local de la partida con los eventos del anfitrión. La interfaz lee `foto`, `roles` y
 * `rechazo` y se suscribe con `alCambiar`.
 */
export class ClienteCoop {
  foto: Foto | null = null;
  /** Último reparto recibido (`roles`), con su sala. */
  roles: ({ sala: number } & Reparto) | null = null;
  rechazo: MotivoRechazo | null = null;
  /** Último número de secuencia aplicado. */
  ultimoN = 0;
  /** El anfitrión, si este cliente creó la partida. */
  anfitrion: Anfitrion | null = null;
  private k = 0;
  private readonly oyentes = new Set<(e: Evento) => void>();
  private readonly quitar: (() => void)[] = [];

  constructor(
    readonly t: Transporte,
    readonly identidad: Identidad,
    protected readonly ahora: () => number = () => Date.now(),
  ) {}

  get yo(): string {
    return this.identidad.jugador;
  }

  /** Crea la partida: este cliente será el anfitrión. */
  async crear(codigo: string): Promise<void> {
    this.anfitrion = new Anfitrion(this.t, this.yo, this.ahora);
    this.anfitrion.iniciar();
    await this.unirse(codigo);
  }

  async unirse(codigo: string): Promise<void> {
    this.quitar.push(this.t.escuchar('evt', (m) => this.alEvento(m)));
    await this.t.unirse(codigo, this.identidad);
  }

  async salir(): Promise<void> {
    this.anfitrion?.detener();
    for (const q of this.quitar.splice(0)) q();
    await this.t.salir();
  }

  /** Envía una intención al anfitrión. */
  enviar(i: Intencion): Promise<boolean> {
    this.k++;
    return this.t.enviar('int', intencion(this.yo, `${this.yo}-${this.k}`, i));
  }

  /** Avisa de cada evento aplicado. Devuelve la función para dejar de escuchar. */
  alCambiar(fn: (e: Evento) => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  protected alEvento(m: SobreEvt): void {
    const e = { t: m.t, p: m.p } as Evento;
    // Solo cuenta lo que manda el anfitrión de la copia (antes de tenerla, solo su foto).
    if (this.foto ? m.de !== this.foto.anfitrion : e.t !== 'estado' && e.t !== 'rechazo') return;
    if (e.t === 'rechazo') {
      if (e.p.a === this.yo) this.rechazo = e.p.motivo;
    } else {
      if (e.t === 'roles') this.roles = e.p;
      this.foto = this.foto ? aplicarEvento(this.foto, e) : e.t === 'estado' ? e.p : null;
      this.ultimoN = m.n;
    }
    for (const fn of [...this.oyentes]) fn(e);
  }
}
