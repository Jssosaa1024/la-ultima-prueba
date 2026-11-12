/**
 * Estado de entrada que el motor lee en cada cuadro (T14).
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
}

export function crearEntrada(): Entrada {
  return { miradaX: 0, miradaY: 0, escalaMirada: 1 };
}

/** Devuelve el arrastre acumulado y lo pone en cero. */
export function consumirMirada(e: Entrada): { dx: number; dy: number } {
  const dx = e.miradaX * e.escalaMirada;
  const dy = e.miradaY * e.escalaMirada;
  e.miradaX = 0;
  e.miradaY = 0;
  return { dx, dy };
}
