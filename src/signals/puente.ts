import type { AccionObjeto } from './interfaz';
import type { FinalId, Modo } from './partida';

/**
 * Puente de órdenes entre capas (T31).
 *
 * Los signals cuentan cómo está el juego; las órdenes piden que algo cambie. `ui/` y
 * `engine/` llaman a `enviar()`, y quien tenga la autoridad (la lógica del juego, o el
 * anfitrión en cooperativo) se suscribe con `escuchar()` y actualiza los signals.
 * Así ninguna capa importa a otra: todas importan de `signals/`.
 *
 * Las órdenes llevan ids y valores de listas cerradas. La única excepción es la nota del
 * cuaderno, que el jugador escribe y se limita a 280 caracteres.
 */
export type Comando =
  /** Empezar una partida desde el menú de inicio. */
  | { t: 'iniciar'; modo: Modo }
  /** Abandonar la partida y volver al menú. */
  | { t: 'salir' }
  /** Botón contextual sobre el objeto enfocado. */
  | { t: 'accion'; objeto: string; accion: AccionObjeto }
  /** Pausar el reloj (el cuaderno lo pausa en modo individual). */
  | { t: 'pausar' }
  | { t: 'reanudar' }
  | { t: 'elegir_final'; final: FinalId }
  /** Notas del cuaderno: texto escrito por el propio jugador, de 280 caracteres o menos. */
  | { t: 'nota'; op: 'agregar'; texto: string }
  | { t: 'nota'; op: 'borrar'; id: string };

export type Oyente = (comando: Comando) => void;

const oyentes = new Set<Oyente>();

/**
 * Entrega la orden a cada oyente, en el orden en que se suscribieron. Si uno falla, los demás
 * la reciben igual y el error se relanza aparte para que se vea en la consola.
 */
export function enviar(comando: Comando): void {
  for (const oyente of [...oyentes]) {
    try {
      oyente(comando);
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

/** Se suscribe a las órdenes. Devuelve la función para dejar de escuchar. */
export function escuchar(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}
