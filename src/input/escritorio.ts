/**
 * Teclado y ratón en escritorio (T19), como soporte secundario: el juego es celular primero.
 *
 * - WASD o flechas: caminar.
 * - Clic sobre un objeto: lo selecciona (el botón del HUD sigue clicable).
 * - Clic en otro lugar de la escena: bloquea el puntero; el ratón mira y la mira del centro apunta.
 * - Clic (con el puntero bloqueado) o E: usar el objeto apuntado.
 * - Esc: el navegador suelta el puntero.
 */
import type { Entrada } from './entrada';
import { TECLA_USAR, TECLAS_MOVIMIENTO, vectorTeclas } from './teclas';
import { esToque } from './toque';

/** Radianes por píxel del ratón, relativos a la sensibilidad táctil (0,0045 rad/px). */
export const ESCALA_RATON = 0.5;

export interface OpcionesEscritorio {
  activos: () => boolean;
  /** Pide usar el objeto apuntado o enfocado. */
  alUsar: () => void;
  /** `false` si el clic acaba de seleccionar un objeto: entonces no se bloquea el puntero. */
  puedeBloquear: () => boolean;
  /** Avisa cuando el puntero se bloquea o se suelta. */
  alCambiarBloqueo?: (bloqueado: boolean) => void;
}

/** Teclas que se escriben en un campo de texto o activan un botón: no son del juego. */
function esCampoDeLaInterfaz(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false;
  return (
    objetivo.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(objetivo.tagName)
  );
}

export function conectarEscritorio(
  canvas: HTMLCanvasElement,
  entrada: Entrada,
  { activos, alUsar, puedeBloquear, alCambiarBloqueo }: OpcionesEscritorio,
): () => void {
  const presionadas = new Set<string>();
  /** Dónde y cuándo bajó el botón del ratón: un arrastre no debe bloquear el puntero. */
  let bajada = { x: 0, y: 0, tiempo: 0 };
  const bloqueado = (): boolean => document.pointerLockElement === canvas;

  const actualizarTeclas = (): void => {
    const v = vectorTeclas(presionadas);
    entrada.teclasX = v.x;
    entrada.teclasY = v.y;
  };

  const alBajarTecla = (e: KeyboardEvent): void => {
    if (!activos() || e.ctrlKey || e.metaKey || e.altKey || esCampoDeLaInterfaz(e.target)) return;
    if (TECLAS_MOVIMIENTO.has(e.code)) {
      // Sin esto, las flechas hacen scroll de la página.
      e.preventDefault();
      presionadas.add(e.code);
      actualizarTeclas();
    } else if (e.code === TECLA_USAR && !e.repeat) {
      alUsar();
    }
  };
  const alSoltarTecla = (e: KeyboardEvent): void => {
    if (presionadas.delete(e.code)) actualizarTeclas();
  };
  /** Al cambiar de ventana se pierden los `keyup`: se sueltan todas las teclas. */
  const soltarTeclas = (): void => {
    presionadas.clear();
    actualizarTeclas();
  };

  const alHacerClic = (e: MouseEvent): void => {
    if (!activos() || e.button !== 0) return;
    // Un toque en pantalla táctil también dispara `click`: el bloqueo es solo para ratón.
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    if (bloqueado()) {
      alUsar();
      return;
    }
    // Soltar el botón tras arrastrar (caminar o mirar) también dispara `click`: no bloquea.
    const fin = { x: e.clientX, y: e.clientY, tiempo: e.timeStamp };
    if (!esToque(bajada, fin, Math.hypot(fin.x - bajada.x, fin.y - bajada.y))) return;
    if (!puedeBloquear()) return;
    // Algunos navegadores no permiten bloquear el puntero (o el usuario lo negó): el juego
    // sigue funcionando con arrastrar para mirar y tocar para seleccionar.
    try {
      void Promise.resolve(canvas.requestPointerLock()).catch(() => {});
    } catch {
      /* sin bloqueo de puntero */
    }
  };

  const alBajarBoton = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') bajada = { x: e.clientX, y: e.clientY, tiempo: e.timeStamp };
  };

  const alMoverRaton = (e: MouseEvent): void => {
    if (!bloqueado() || !activos()) return;
    entrada.miradaX += e.movementX * ESCALA_RATON;
    entrada.miradaY += e.movementY * ESCALA_RATON;
  };

  const alCambiarBloqueoInterno = (): void => alCambiarBloqueo?.(bloqueado());

  window.addEventListener('keydown', alBajarTecla);
  window.addEventListener('keyup', alSoltarTecla);
  window.addEventListener('blur', soltarTeclas);
  canvas.addEventListener('pointerdown', alBajarBoton);
  canvas.addEventListener('click', alHacerClic);
  document.addEventListener('mousemove', alMoverRaton);
  document.addEventListener('pointerlockchange', alCambiarBloqueoInterno);

  return () => {
    window.removeEventListener('keydown', alBajarTecla);
    window.removeEventListener('keyup', alSoltarTecla);
    window.removeEventListener('blur', soltarTeclas);
    canvas.removeEventListener('pointerdown', alBajarBoton);
    canvas.removeEventListener('click', alHacerClic);
    document.removeEventListener('mousemove', alMoverRaton);
    document.removeEventListener('pointerlockchange', alCambiarBloqueoInterno);
    if (bloqueado()) document.exitPointerLock();
    soltarTeclas();
  };
}
