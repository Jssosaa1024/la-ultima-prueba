/**
 * Teclado en escritorio (T19): WASD o flechas para caminar. Sin DOM, para probarlo con tests.
 *
 * Se usa `KeyboardEvent.code` (la tecla física), no `key`: así WASD queda en el mismo lugar
 * en un teclado en español, en inglés o en francés (AZERTY).
 */

const ADELANTE = new Set(['KeyW', 'ArrowUp']);
const ATRAS = new Set(['KeyS', 'ArrowDown']);
const IZQUIERDA = new Set(['KeyA', 'ArrowLeft']);
const DERECHA = new Set(['KeyD', 'ArrowRight']);

/** Teclas que mueven al jugador: el navegador no debe hacer scroll con ellas. */
export const TECLAS_MOVIMIENTO = new Set([...ADELANTE, ...ATRAS, ...IZQUIERDA, ...DERECHA]);

/** Tecla para usar el objeto apuntado (además del clic). */
export const TECLA_USAR = 'KeyE';

const alguna = (presionadas: ReadonlySet<string>, grupo: ReadonlySet<string>): boolean => {
  for (const tecla of grupo) if (presionadas.has(tecla)) return true;
  return false;
};

/**
 * Vector de movimiento con las teclas presionadas: `x` lateral (+ derecha) y `y` hacia
 * adelante (+ adelante), cada uno −1, 0 o 1. Dos teclas opuestas se anulan.
 */
export function vectorTeclas(presionadas: ReadonlySet<string>): { x: number; y: number } {
  const x = Number(alguna(presionadas, DERECHA)) - Number(alguna(presionadas, IZQUIERDA));
  const y = Number(alguna(presionadas, ADELANTE)) - Number(alguna(presionadas, ATRAS));
  return { x, y };
}
