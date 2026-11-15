/**
 * Pedidos de sonido desde las animaciones del motor (T43). Una animación llama a
 * `sonar('mano')` cuando empieza algo que debe sonar; si el módulo de audio está activo y el
 * jugador ya tocó la pantalla, suena. Si no, no pasa nada. No importa Web Audio: las
 * animaciones y sus tests no lo necesitan.
 */
import type { NombreEfecto } from './sintesis';

type Oyente = (efecto: NombreEfecto) => void;

let oyente: Oyente | null = null;

export function sonar(efecto: NombreEfecto): void {
  oyente?.(efecto);
}

/** Lo usa el módulo de audio. Devuelve la función para dejar de escuchar. */
export function escucharSonidos(nuevo: Oyente): () => void {
  oyente = nuevo;
  return () => {
    if (oyente === nuevo) oyente = null;
  };
}
