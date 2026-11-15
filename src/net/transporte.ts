import {
  esCodigo,
  esIdentidad,
  validar,
  type Canal,
  type Identidad,
  type SobreDe,
} from './protocolo';

/**
 * Interfaz propia del transporte (T80). El juego solo conoce esto; detrás puede estar
 * Supabase Realtime (T79), BroadcastChannel entre pestañas (e2e) o la red en memoria
 * (Vitest). Cambiar de servicio no toca el juego.
 *
 * Reglas comunes a todos los transportes:
 * - Lo que llega se valida con `validar()` antes de entregarlo; lo inválido se descarta.
 * - Lo que se envía también se valida: nunca sale un mensaje mal formado.
 * - Los mensajes llegan también a quien los envió (`self: true` de Supabase), para que el
 *   anfitrión procese sus propias intenciones por la misma ruta. Quien escucha `dir` ignora
 *   los suyos.
 */
export interface Transporte {
  /** Se une al canal de la partida y publica su identidad en Presence (una sola vez). */
  unirse(codigo: string, identidad: Identidad): Promise<void>;
  /** Envía un mensaje. Devuelve falso si no es válido o no se pudo enviar. */
  enviar<C extends Canal>(canal: C, mensaje: SobreDe<C>): Promise<boolean>;
  /** Escucha un canal. Devuelve la función para dejar de escuchar. */
  escuchar<C extends Canal>(canal: C, fn: (m: SobreDe<C>) => void): () => void;
  /** Escucha quiénes están conectados (solo identidades válidas). */
  presencia(fn: (presentes: readonly Identidad[]) => void): () => void;
  /** Sale del canal y deja de escuchar. */
  salir(): Promise<void>;
}

type Oyente = (m: never) => void;

/**
 * Oyentes y validación compartidos por los transportes. Cada transporte llama a `recibir()`
 * con lo que llega de la red y a `cambioPresencia()` cuando cambia la lista.
 */
export class Oyentes {
  private readonly canales = new Map<Canal, Set<Oyente>>();
  private readonly presentes = new Set<(p: readonly Identidad[]) => void>();
  private ultima: readonly Identidad[] = [];
  /** Descartes por motivo, para el panel de depuración y las pruebas. */
  readonly descartes: Record<string, number> = {};

  escuchar<C extends Canal>(canal: C, fn: (m: SobreDe<C>) => void): () => void {
    let set = this.canales.get(canal);
    if (!set) this.canales.set(canal, (set = new Set()));
    const f = fn as Oyente;
    set.add(f);
    return () => set.delete(f);
  }

  presencia(fn: (p: readonly Identidad[]) => void): () => void {
    this.presentes.add(fn);
    fn(this.ultima);
    return () => this.presentes.delete(fn);
  }

  recibir(canal: Canal, x: unknown): void {
    const r = validar(canal, x);
    if (!r.ok) {
      this.descartes[r.motivo] = (this.descartes[r.motivo] ?? 0) + 1;
      return;
    }
    for (const fn of [...(this.canales.get(canal) ?? [])]) (fn as (m: unknown) => void)(r.mensaje);
  }

  cambioPresencia(lista: readonly unknown[]): void {
    const vistos = new Set<string>();
    const validas: Identidad[] = [];
    for (const x of lista) {
      if (esIdentidad(x) && !vistos.has(x.jugador)) {
        vistos.add(x.jugador);
        validas.push(x);
      }
    }
    validas.sort((a, b) => a.unido_en - b.unido_en || (a.jugador < b.jugador ? -1 : 1));
    this.ultima = validas;
    for (const fn of [...this.presentes]) fn(validas);
  }

  limpiar(): void {
    this.canales.clear();
    this.presentes.clear();
  }
}

/** Revisa los datos de `unirse` antes de tocar la red. */
export function revisarUnion(codigo: string, identidad: Identidad): void {
  if (!esCodigo(codigo)) throw new Error('Código de partida no válido');
  if (!esIdentidad(identidad)) throw new Error('Identidad no válida');
}
