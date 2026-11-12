/**
 * Controles táctiles sobre el canvas (T14): arrastrar en la mitad derecha para mirar.
 *
 * Cada dedo se sigue por su `pointerId`, así que mirar no se mezcla con el joystick de la
 * mitad izquierda (T15). Con ratón también funciona (arrastrar con el botón presionado).
 */
import type { Entrada } from './entrada';

export interface OpcionesTactil {
  /** `false` mientras hay un panel abierto: se ignoran los toques nuevos. */
  activos: () => boolean;
}

export function conectarTactil(
  canvas: HTMLCanvasElement,
  entrada: Entrada,
  { activos }: OpcionesTactil,
): () => void {
  let dedoMirada: number | null = null;
  let ultimoX = 0;
  let ultimoY = 0;

  const enMitadDerecha = (e: PointerEvent): boolean => {
    const caja = canvas.getBoundingClientRect();
    return e.clientX - caja.left >= caja.width / 2;
  };

  const alBajar = (e: PointerEvent): void => {
    if (!activos() || dedoMirada !== null || !enMitadDerecha(e)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dedoMirada = e.pointerId;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const alMover = (e: PointerEvent): void => {
    if (e.pointerId !== dedoMirada) return;
    entrada.miradaX += e.clientX - ultimoX;
    entrada.miradaY += e.clientY - ultimoY;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
  };

  const alSoltar = (e: PointerEvent): void => {
    if (e.pointerId !== dedoMirada) return;
    dedoMirada = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  canvas.addEventListener('pointerdown', alBajar);
  canvas.addEventListener('pointermove', alMover);
  canvas.addEventListener('pointerup', alSoltar);
  canvas.addEventListener('pointercancel', alSoltar);
  return () => {
    canvas.removeEventListener('pointerdown', alBajar);
    canvas.removeEventListener('pointermove', alMover);
    canvas.removeEventListener('pointerup', alSoltar);
    canvas.removeEventListener('pointercancel', alSoltar);
  };
}
