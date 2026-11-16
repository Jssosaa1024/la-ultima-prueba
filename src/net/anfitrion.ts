import type { Evento, Intencion } from '../game/coop/mensajes';
import {
  alIntencion,
  alPresencia,
  alTick,
  crearSesion,
  fotoEn,
  reanudarReloj,
  type Paso,
  type Sesion,
} from '../game/coop/sesion';
import { evento, VERSION_CONTENIDO, type Identidad, type SobreInt } from './protocolo';
import type { Transporte } from './transporte';

/**
 * Anfitrión autoritativo sobre un transporte (T84, T85, T87). Las reglas están en
 * `game/coop/sesion.ts`; aquí solo se escuchan las intenciones y Presence, se numeran los
 * eventos (`n`) y se difunden por `evt`.
 *
 * Quien crea la partida corre un `Anfitrion` además de su `ClienteCoop`; como el transporte
 * entrega también a quien envía, sus propias intenciones llegan por la misma ruta que las de
 * los demás.
 */
/** Cada cuánto se difunde la foto completa, aunque nadie la pida (T88). */
export const FOTO_CADA_MS = 15_000;
/** Un `pedir_estado` por jugador como máximo en este tiempo: la foto pesa hasta 8 KB. */
export const PEDIR_ESTADO_CADA_MS = 1000;
/** Cuántos `cid` recientes se recuerdan para descartar intenciones repetidas. */
const MAX_CIDS = 512;

export class Anfitrion {
  private s: Sesion;
  private n: number;
  private readonly quitar: (() => void)[] = [];
  private readonly rechazados = new Set<string>();
  private readonly cids = new Set<string>();
  private readonly pidioEstado = new Map<string, number>();
  private ultimaFoto: number;

  constructor(
    private readonly t: Transporte,
    readonly yo: string,
    private readonly ahora: () => number,
    desde?: { sesion: Sesion; n: number },
  ) {
    this.s = desde?.sesion ?? crearSesion(yo, ahora());
    this.n = desde?.n ?? 0;
    this.ultimaFoto = ahora();
  }

  get sesion(): Sesion {
    return this.s;
  }

  /** Último número de secuencia emitido. */
  get ultimoN(): number {
    return this.n;
  }

  iniciar(): void {
    this.quitar.push(
      this.t.escuchar('int', (m) => this.alIntencion(m)),
      this.t.presencia((p) => this.alPresencia(p)),
    );
  }

  detener(): void {
    for (const q of this.quitar.splice(0)) q();
  }

  /** Llamar cada segundo: reloj, pistas por tiempo y espera de D. */
  tick(): void {
    this.aplicar(alTick(this.s, this.ahora()));
    // T88: la foto periódica corrige a quien perdió eventos sin notarlo (por ejemplo, el último).
    if (this.ahora() - this.ultimaFoto >= FOTO_CADA_MS) this.emitirFoto();
  }

  /** T90: reanuda el reloj tras la migración (si corría antes). */
  reanudarReloj(): void {
    this.aplicar(reanudarReloj(this.s, this.ahora()));
  }

  /** Difunde la foto completa (`estado`). */
  emitirFoto(): void {
    this.emitir({ t: 'estado', p: fotoEn(this.s, this.ahora()) });
  }

  /** Difunde un evento con el siguiente número de secuencia. */
  emitir(e: Evento): void {
    if (e.t === 'estado') this.ultimaFoto = this.ahora();
    this.n++;
    void this.t.enviar('evt', evento(this.yo, this.n, e));
  }

  protected aplicar(paso: Paso): void {
    const antes = this.s.pistas;
    this.s = paso.s;
    for (const e of paso.eventos) this.emitir(e);
    // T88b: una pista nueva (por tiempo o por intentos) se difunde en ese momento con la foto,
    // sin esperar la de cada 15 s. Así todos ven el aviso a la vez que el anfitrión.
    if (this.s.pistas.some((p, k) => p.ofrecidas > (antes[k]?.ofrecidas ?? 0))) {
      this.emitirFoto();
    }
  }

  protected alIntencion(m: SobreInt): void {
    // T88: una intención repetida (mismo cid) se ignora.
    if (this.cids.has(m.cid)) return;
    this.cids.add(m.cid);
    if (this.cids.size > MAX_CIDS) {
      const viejo = this.cids.values().next().value;
      if (viejo !== undefined) this.cids.delete(viejo);
    }
    if (m.t === 'pedir_estado') {
      const antes = this.pidioEstado.get(m.de);
      if (antes !== undefined && this.ahora() - antes < PEDIR_ESTADO_CADA_MS) return;
      this.pidioEstado.set(m.de, this.ahora());
    }
    this.aplicar(alIntencion(this.s, m.de, { t: m.t, p: m.p } as Intencion, this.ahora()));
  }

  protected alPresencia(presentes: readonly Identidad[]): void {
    const conectados: string[] = [];
    for (const id of presentes) {
      if (id.version_contenido === VERSION_CONTENIDO) {
        conectados.push(id.jugador);
      } else if (!this.rechazados.has(id.jugador)) {
        this.rechazados.add(id.jugador);
        this.emitir({ t: 'rechazo', p: { a: id.jugador, motivo: 'version' } });
      }
    }
    this.aplicar(alPresencia(this.s, conectados, this.ahora()));
  }
}
