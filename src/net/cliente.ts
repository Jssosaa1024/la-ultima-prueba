import type { Evento, Foto, Intencion, MotivoRechazo } from '../game/coop/mensajes';
import { aplicarEvento, repartoDeFoto } from '../game/coop/replica';
import { sesionDesdeFoto } from '../game/coop/sesion';
import { SALAS, type SalaId } from '../game/partida';
import type { Reparto } from '../game/reparto';
import { Anfitrion } from './anfitrion';
import { intencion, type Identidad, type SobreEvt } from './protocolo';
import type { Transporte } from './transporte';

/** Si la foto pedida no llega en este tiempo, se vuelve a pedir (T88). */
export const REPETIR_PEDIDO_MS = 2000;
/** Si el anfitrión falta este tiempo de Presence, asume el siguiente (T90). */
export const MIGRAR_TRAS_MS = 5000;
/** El nuevo anfitrión reanuda el reloj tras esta pausa (T90). */
export const REANUDAR_TRAS_MS = 3000;
/**
 * Un anfitrión que vuelve tras caerse espera este tiempo a que otro reclame el puesto antes
 * de retomarlo (T90): si nadie migró, sigue siendo el anfitrión.
 */
export const ESPERA_RECLAMO_MS = 2000;

/**
 * Un jugador del cooperativo (T84–T90): envía intenciones con su `cid` y mantiene la copia
 * local de la partida con los eventos del anfitrión. La interfaz lee `foto`, `roles` y
 * `rechazo` y se suscribe con `alCambiar`. Hay que llamar a `tick()` cada segundo.
 */
export class ClienteCoop {
  foto: Foto | null = null;
  /** Último reparto recibido (`roles`), con su sala. */
  roles: ({ sala: number } & Reparto) | null = null;
  rechazo: MotivoRechazo | null = null;
  /** Último número de secuencia aplicado. */
  ultimoN = 0;
  /** El anfitrión, si este cliente lo es (creó la partida o migró). */
  anfitrion: Anfitrion | null = null;
  /** Desde cuándo espera la foto tras un hueco de secuencia, o null. */
  esperandoFoto: number | null = null;
  /** Jugadores en Presence, por orden de llegada. */
  presentes: readonly Identidad[] = [];
  private codigo: string | null = null;
  /** Número del próximo `cid`. Empieza al azar para no repetir cid tras recargar la página. */
  private k: number;
  private anfitrionFaltaDesde: number | null = null;
  private reanudarEn: number | null = null;
  private anfitrionEnPausa: Anfitrion | null = null;
  private esperandoReclamo: number | null = null;
  private readonly oyentes = new Set<(e: Evento) => void>();
  private readonly quitar: (() => void)[] = [];

  constructor(
    readonly t: Transporte,
    readonly identidad: Identidad,
    protected readonly ahora: () => number = () => Date.now(),
    azar: () => number = Math.random,
  ) {
    this.k = Math.floor(azar() * 100_000_000);
  }

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
    this.codigo = codigo;
    this.quitar.push(
      this.t.escuchar('evt', (m) => this.alEvento(m)),
      this.t.presencia((p) => (this.presentes = p)),
    );
    // Supabase se vuelve a unir solo tras una caída: se hace lo mismo que al reconectar.
    const quitarReconexion = this.t.alReconectar?.(() => this.alVolver());
    if (quitarReconexion) this.quitar.push(quitarReconexion);
    await this.t.unirse(codigo, this.identidad);
  }

  /**
   * T89: vuelve a la misma partida con la misma identidad (el `jugador` guardado en el
   * navegador). El anfitrión le devuelve su rol y sus objetos si no pasaron 60 s, y la foto.
   */
  async reconectar(): Promise<void> {
    if (!this.codigo) return;
    this.alVolver();
    await this.t.unirse(this.codigo, this.identidad);
  }

  /** Al volver tras una caída. */
  private alVolver(): void {
    if (!this.anfitrion) return;
    // T90: mientras estuvo fuera, otro pudo asumir. Espera un momento antes de retomar.
    this.anfitrion.detener();
    this.anfitrionEnPausa = this.anfitrion;
    this.anfitrion = null;
    this.esperandoReclamo = this.ahora();
  }

  async salir(): Promise<void> {
    this.anfitrion?.detener();
    for (const q of this.quitar.splice(0)) q();
    await this.t.salir();
  }

  /** Envía una intención al anfitrión. */
  enviar(i: Intencion): Promise<boolean> {
    this.k = (this.k + 1) % 1_000_000_000;
    return this.t.enviar('int', intencion(this.yo, `${this.yo}-${this.k}`, i));
  }

  /** Avisa de cada evento aplicado. Devuelve la función para dejar de escuchar. */
  alCambiar(fn: (e: Evento) => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  /** Llamar cada segundo: anfitrión, pedido de foto y migración. */
  tick(): void {
    const ahora = this.ahora();
    this.anfitrion?.tick();
    if (this.reanudarEn !== null && ahora >= this.reanudarEn) {
      this.reanudarEn = null;
      this.anfitrion?.reanudarReloj();
    }
    if (this.esperandoReclamo !== null && ahora - this.esperandoReclamo >= ESPERA_RECLAMO_MS) {
      // Nadie reclamó el puesto: sigue siendo el anfitrión.
      this.esperandoReclamo = null;
      this.anfitrion = this.anfitrionEnPausa;
      this.anfitrionEnPausa = null;
      this.anfitrion?.iniciar();
      this.anfitrion?.emitirFoto();
    }
    if (this.esperandoFoto !== null && ahora - this.esperandoFoto >= REPETIR_PEDIDO_MS) {
      this.pedirEstado();
    }
    this.revisarAnfitrion(ahora);
  }

  /** Pide la foto completa al anfitrión (T88). */
  pedirEstado(): void {
    this.esperandoFoto = this.ahora();
    void this.enviar({ t: 'pedir_estado', p: { desde_n: this.ultimoN } });
  }

  /** Quién asumiría si falta el anfitrión: el conectado de la partida que llegó primero. */
  sucesor(): string | null {
    const f = this.foto;
    if (!f) return null;
    const candidato = this.presentes.find(
      (id) => id.jugador !== f.anfitrion && f.orden.includes(id.jugador),
    );
    return candidato?.jugador ?? null;
  }

  private anfitrionPresente(): boolean {
    return this.presentes.some((id) => id.jugador === this.foto?.anfitrion);
  }

  /** T90: si el anfitrión falta 5 s y este cliente es el sucesor, asume. */
  private revisarAnfitrion(ahora: number): void {
    const f = this.foto;
    if (!f || this.anfitrion || this.esperandoReclamo !== null || f.fase === 'final') return;
    if (f.anfitrion === this.yo || this.anfitrionPresente()) {
      this.anfitrionFaltaDesde = null;
      return;
    }
    this.anfitrionFaltaDesde ??= ahora;
    if (ahora - this.anfitrionFaltaDesde < MIGRAR_TRAS_MS || this.sucesor() !== this.yo) return;
    this.migrar(f, ahora);
  }

  private migrar(f: Foto, ahora: number): void {
    const conectados = this.presentes.map((id) => id.jugador);
    const sesion = sesionDesdeFoto(f, this.yo, conectados, ahora);
    this.anfitrion = new Anfitrion(this.t, this.yo, this.ahora, { sesion, n: this.ultimoN });
    this.anfitrionFaltaDesde = null;
    this.anfitrion.emitir({ t: 'anfitrion', p: { jugador: this.yo } });
    this.anfitrion.emitirFoto();
    this.anfitrion.iniciar();
    if (!f.reloj.pausado) this.reanudarEn = ahora + REANUDAR_TRAS_MS;
  }

  /**
   * Acepta que `de` es el nuevo anfitrión: lo anunció (`anfitrion`) o manda una foto que lo
   * dice, y quien era anfitrión para este cliente ya no está (o es este mismo, que volvió).
   */
  private aceptaReclamo(de: string, e: Evento): boolean {
    const f = this.foto;
    if (!f || de === f.anfitrion || !f.orden.includes(de)) return false;
    const reclama =
      (e.t === 'anfitrion' && e.p.jugador === de) || (e.t === 'estado' && e.p.anfitrion === de);
    if (!reclama) return false;
    return this.esperandoReclamo !== null || !this.anfitrionPresente();
  }

  protected alEvento(m: SobreEvt): void {
    const e = { t: m.t, p: m.p } as Evento;
    if (this.foto && m.de !== this.foto.anfitrion) {
      if (!this.aceptaReclamo(m.de, e)) return;
      if (m.de !== this.yo) {
        // Otro asumió: si este cliente era o iba a volver a ser anfitrión, deja de serlo.
        this.anfitrion?.detener();
        this.anfitrion = null;
        this.anfitrionEnPausa = null;
        this.esperandoReclamo = null;
        this.reanudarEn = null;
      }
      this.foto = { ...this.foto, anfitrion: m.de };
      this.ultimoN = m.n - 1;
      this.esperandoFoto = null;
    } else if (!this.foto && e.t !== 'estado' && e.t !== 'rechazo') {
      return;
    }
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
