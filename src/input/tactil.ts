/**
 * Controles táctiles sobre el canvas.
 * - Mitad derecha (T14): arrastrar para mirar.
 * - Mitad izquierda (T15): joystick flotante para caminar.
 *
 * Cada dedo se sigue por su `pointerId`: se puede caminar y mirar a la vez con dos dedos.
 * Con ratón también funciona (arrastrar con el botón izquierdo).
 */
import type { Entrada } from './entrada';
import { perilla, vectorJoystick } from './joystick';

export interface OpcionesTactil {
  /** `false` mientras hay un panel abierto: se ignoran los toques nuevos. */
  activos: () => boolean;
}

interface Dedo {
  id: number;
  inicioX: number;
  inicioY: number;
  ultimoX: number;
  ultimoY: number;
}

export function conectarTactil(
  canvas: HTMLCanvasElement,
  entrada: Entrada,
  { activos }: OpcionesTactil,
): () => void {
  let mirada: Dedo | null = null;
  let joystick: Dedo | null = null;

  const local = (e: PointerEvent): { x: number; y: number; derecha: boolean } => {
    const caja = canvas.getBoundingClientRect();
    const x = e.clientX - caja.left;
    return { x, y: e.clientY - caja.top, derecha: x >= caja.width / 2 };
  };

  const actualizarJoystick = (d: Dedo): void => {
    const dx = d.ultimoX - d.inicioX;
    const dy = d.ultimoY - d.inicioY;
    const v = vectorJoystick(dx, dy);
    entrada.moverX = v.x;
    entrada.moverY = v.y;
    const p = perilla(dx, dy);
    entrada.joystick = { baseX: d.inicioX, baseY: d.inicioY, perillaX: p.x, perillaY: p.y };
  };

  const soltarJoystick = (): void => {
    joystick = null;
    entrada.moverX = 0;
    entrada.moverY = 0;
    entrada.joystick = null;
  };

  const alBajar = (e: PointerEvent): void => {
    if (!activos()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y, derecha } = local(e);
    const dedo: Dedo = { id: e.pointerId, inicioX: x, inicioY: y, ultimoX: x, ultimoY: y };
    if (derecha && mirada === null) mirada = dedo;
    else if (!derecha && joystick === null) {
      joystick = dedo;
      actualizarJoystick(dedo);
    } else return;
    canvas.setPointerCapture(e.pointerId);
  };

  const alMover = (e: PointerEvent): void => {
    const { x, y } = local(e);
    if (mirada && e.pointerId === mirada.id) {
      entrada.miradaX += x - mirada.ultimoX;
      entrada.miradaY += y - mirada.ultimoY;
      mirada.ultimoX = x;
      mirada.ultimoY = y;
    } else if (joystick && e.pointerId === joystick.id) {
      joystick.ultimoX = x;
      joystick.ultimoY = y;
      actualizarJoystick(joystick);
    }
  };

  const alSoltar = (e: PointerEvent): void => {
    if (mirada && e.pointerId === mirada.id) mirada = null;
    else if (joystick && e.pointerId === joystick.id) soltarJoystick();
    else return;
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
