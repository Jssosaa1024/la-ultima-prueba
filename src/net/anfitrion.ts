import type { Evento, Intencion } from '../game/coop/mensajes';
import {
  alIntencion,
  alPresencia,
  alTick,
  crearSesion,
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
export class Anfitrion {
  private s: Sesion;
  private n: number;
  private readonly quitar: (() => void)[] = [];
  private readonly rechazados = new Set<string>();

  constructor(
    private readonly t: Transporte,
    readonly yo: string,
    private readonly ahora: () => number,
    desde?: { sesion: Sesion; n: number },
  ) {
    this.s = desde?.sesion ?? crearSesion(yo, ahora());
    this.n = desde?.n ?? 0;
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
  }

  /** Difunde un evento con el siguiente número de secuencia. */
  emitir(e: Evento): void {
    this.n++;
    void this.t.enviar('evt', evento(this.yo, this.n, e));
  }

  protected aplicar(paso: Paso): void {
    this.s = paso.s;
    for (const e of paso.eventos) this.emitir(e);
  }

  protected alIntencion(m: SobreInt): void {
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
