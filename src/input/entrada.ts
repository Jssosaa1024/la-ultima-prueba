/**
 * Estado de entrada que el motor lee en cada cuadro (T14, T15, T19).
 *
 * Táctil, teclado y ratón escriben aquí; el motor lo consume. No usa signals: cambia
 * decenas de veces por segundo y solo lo lee el motor, no la interfaz.
 */
export interface Entrada {
  /** Arrastre acumulado para mirar, en píxeles CSS, desde el último cuadro. */
  miradaX: number;
  miradaY: number;
  /** Escala de la mirada: táctil 1; el ratón con puntero bloqueado usa otra. */
  escalaMirada: number;
  /** Joystick: movimiento lateral (+ derecha) y hacia adelante (+ adelante), de −1 a 1. */
  moverX: number;
  moverY: number;
  /** Joystick visible: base y perilla en píxeles CSS del canvas; `null` si no se usa. */
  joystick: { baseX: number; baseY: number; perillaX: number; perillaY: number } | null;
  /** Teclado (T19): −1, 0 o 1 en cada eje, con la misma convención que el joystick. */
  teclasX: number;
  teclasY: number;
}

export function crearEntrada(): Entrada {
  return {
    miradaX: 0,
    miradaY: 0,
    escalaMirada: 1,
    moverX: 0,
    moverY: 0,
    joystick: null,
    teclasX: 0,
    teclasY: 0,
  };
}

/** Devuelve el arrastre acumulado y lo pone en cero. */
export function consumirMirada(e: Entrada): { dx: number; dy: number } {
  const dx = e.miradaX * e.escalaMirada;
  const dy = e.miradaY * e.escalaMirada;
  e.miradaX = 0;
  e.miradaY = 0;
  return { dx, dy };
}

/** Movimiento pedido: joystick y teclado juntos, con largo máximo 1. */
export function movimiento(e: Entrada): { x: number; y: number } {
  const x = e.moverX + e.teclasX;
  const y = e.moverY + e.teclasY;
  const largo = Math.hypot(x, y);
  return largo > 1 ? { x: x / largo, y: y / largo } : { x, y };
}

/** Suelta todo: al abrir un panel o perder el foco, el jugador se detiene. */
export function soltarTodo(e: Entrada): void {
  e.miradaX = 0;
  e.miradaY = 0;
  e.moverX = 0;
  e.moverY = 0;
  e.joystick = null;
}
