import type { Evento, Foto, Intencion, MotivoRechazo } from '../game/coop/mensajes';
import { aplicarEvento, repartoDeFoto } from '../game/coop/replica';
import { SALAS, type SalaId } from '../game/partida';
import type { Reparto } from '../game/reparto';
import { Anfitrion } from './anfitrion';
import { intencion, type Identidad, type SobreEvt } from './protocolo';
import type { Transporte } from './transporte';

/**
 * Un jugador del cooperativo (T84–T90): envía intenciones con su `cid` y mantiene la copia
 * local de la partida con los eventos del anfitrión. La interfaz lee `foto`, `roles` y
 * `rechazo` y se suscribe con `alCambiar`.
 */
/** Si la foto pedida no llega en este tiempo, se vuelve a pedir (T88). */
export const REPETIR_PEDIDO_MS = 2000;

export class ClienteCoop {
  foto: Foto | null = null;
  /** Último reparto recibido (`roles`), con su sala. */
  roles: ({ sala: number } & Reparto) | null = null;
  rechazo: MotivoRechazo | null = null;
  /** Último número de secuencia aplicado. */
  ultimoN = 0;
  /** El anfitrión, si este cliente creó la partida. */
  anfitrion: Anfitrion | null = null;
  /** Desde cuándo espera la foto tras un hueco de secuencia, o null. */
  esperandoFoto: number | null = null;
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

  /** Llamar cada segundo: corre el anfitrión (si lo es) y repite el pedido de foto. */
  tick(): void {
    this.anfitrion?.tick();
    if (this.esperandoFoto !== null && this.ahora() - this.esperandoFoto >= REPETIR_PEDIDO_MS) {
      this.pedirEstado();
    }
  }

  /** Pide la foto completa al anfitrión (T88). */
  pedirEstado(): void {
    this.esperandoFoto = this.ahora();
    void this.enviar({ t: 'pedir_estado', p: { desde_n: this.ultimoN } });
  }

  protected alEvento(m: SobreEvt): void {
    const e = { t: m.t, p: m.p } as Evento;
    // Solo cuenta lo que manda el anfitrión de la copia (antes de tenerla, solo su foto).
    if (this.foto ? m.de !== this.foto.anfitrion : e.t !== 'estado' && e.t !== 'rechazo') return;
    if (e.t === 'rechazo') {
      if (e.p.a === this.yo) this.rechazo = e.p.motivo;
      for (const fn of [...this.oyentes]) fn(e);
      return;
    }
    if (e.t === 'estado') {
      // La foto reemplaza la copia entera, salvo que sea más vieja que lo ya aplicado.
      if (this.foto && m.n < this.ultimoN) return;
      this.foto = e.p;
      this.ultimoN = m.n;
      this.esperandoFoto = null;
      // El reparto no viaja en la foto: se recalcula con el orden, el lugar y los ausentes.
      const r = repartoDeFoto(e.p);
      const sala = SALAS.indexOf(e.p.lugar as SalaId) + 1;
      this.roles = r && sala > 0 ? { sala, ...r.reparto } : null;
    } else {
      // T88: un evento viejo o repetido se ignora; un hueco pide la foto y, mientras llega,
      // no se aplica nada (la foto ya lo trae).
      if (!this.foto || m.n <= this.ultimoN) return;
      if (this.esperandoFoto !== null) return;
      if (m.n > this.ultimoN + 1) {
        this.pedirEstado();
        return;
      }
      if (e.t === 'roles') this.roles = e.p;
      this.foto = aplicarEvento(this.foto, e);
      this.ultimoN = m.n;
    }
    for (const fn of [...this.oyentes]) fn(e);
  }
}
