/**
 * Desbloqueo del audio (T43). Safari en iPhone, y también Chrome, no dejan sonar nada hasta
 * que el jugador toca la pantalla. En el primer toque (o tecla) se crea el `AudioContext`, se
 * reanuda y se reproduce un búfer en silencio, que es lo que iOS pide para soltarlo.
 *
 * iOS puede volver a dormir el audio (una llamada, otra app con sonido: estado `interrupted`
 * o `suspended`). Por eso se sigue escuchando el toque mientras el contexto no esté sonando,
 * y al ocultar la pestaña se suspende para no gastar batería.
 */

/** Lo mínimo del `AudioContext` que se usa aquí (en los tests, uno falso). */
export interface ContextoDesbloqueable {
  readonly state: string;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createBuffer(canales: number, largo: number, frecuencia: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  readonly destination: AudioNode;
}

export interface DocumentoAudio {
  readonly hidden: boolean;
  addEventListener(tipo: string, oyente: () => void, opciones?: AddEventListenerOptions): void;
  removeEventListener(tipo: string, oyente: () => void, opciones?: EventListenerOptions): void;
}

/** Los gestos que iOS acepta para soltar el audio (`touchstart` ya no sirve desde iOS 13). */
export const GESTOS = ['touchend', 'click', 'keydown', 'pointerup'] as const;

export interface OpcionesDesbloqueo<C extends ContextoDesbloqueable> {
  /** Crea el contexto. Se llama una sola vez, dentro del primer gesto. */
  crear: () => C;
  /** Se llama una vez, cuando el contexto suena por primera vez. */
  alDesbloquear: (contexto: C) => void;
  documento?: DocumentoAudio;
}

export interface Desbloqueo<C> {
  readonly contexto: C | null;
  readonly desbloqueado: boolean;
  detener(): void;
}

/** Un búfer de una muestra en silencio: tocarlo dentro del gesto despierta el audio en iOS. */
function tocarSilencio(contexto: ContextoDesbloqueable): void {
  const fuente = contexto.createBufferSource();
  fuente.buffer = contexto.createBuffer(1, 1, 22_050);
  fuente.connect(contexto.destination);
  fuente.start(0);
}

export function desbloquearAlPrimerToque<C extends ContextoDesbloqueable>({
  crear,
  alDesbloquear,
  documento = document,
}: OpcionesDesbloqueo<C>): Desbloqueo<C> {
  let contexto: C | null = null;
  let desbloqueado = false;
  let detenido = false;

  const revisar = (): void => {
    if (detenido || !contexto || contexto.state !== 'running') return;
    if (!desbloqueado) {
      desbloqueado = true;
      alDesbloquear(contexto);
    }
  };

  const alGesto = (): void => {
    if (detenido || documento.hidden) return;
    try {
      contexto ??= crear();
    } catch {
      // Sin Web Audio (equipos muy viejos): el juego sigue en silencio.
      quitarGestos();
      return;
    }
    if (contexto.state === 'running') {
      revisar();
      return;
    }
    tocarSilencio(contexto);
    contexto.resume().then(revisar, () => undefined);
  };

  const quitarGestos = (): void => {
    for (const g of GESTOS) documento.removeEventListener(g, alGesto, { capture: true });
  };

  const alCambiarVisibilidad = (): void => {
    if (!contexto) return;
    if (documento.hidden) void contexto.suspend().catch(() => undefined);
    // Al volver se intenta reanudar; si iOS no deja, el próximo toque lo hace.
    else if (desbloqueado) void contexto.resume().catch(() => undefined);
  };

  for (const g of GESTOS) {
    documento.addEventListener(g, alGesto, { capture: true, passive: true });
  }
  documento.addEventListener('visibilitychange', alCambiarVisibilidad);

  return {
    get contexto() {
      return contexto;
    },
    get desbloqueado() {
      return desbloqueado;
    },
    detener() {
      detenido = true;
      quitarGestos();
      documento.removeEventListener('visibilitychange', alCambiarVisibilidad);
    },
  };
}
