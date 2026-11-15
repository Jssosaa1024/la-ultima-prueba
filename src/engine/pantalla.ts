import { escalaResolucion, girarTelefono, pantalla } from '../signals/pantalla';

/** Límite de resolución interna en celular (especificación, sección 0). */
export const DPR_MAX = 1.25;

/** Lado corto, en píxeles CSS, por debajo del cual una pantalla táctil se trata como celular. */
export const LADO_CORTO_CELULAR = 600;

/**
 * Si hay que pedir que se gire el teléfono (T41b): pantalla táctil (puntero grueso), más alta
 * que ancha y con el lado corto de celular. Una tableta o un PC con la ventana angosta no.
 */
export function debeGirar(ancho: number, alto: number, tactil: boolean): boolean {
  return tactil && alto > ancho && Math.min(ancho, alto) < LADO_CORTO_CELULAR;
}

/** Pantalla táctil sin ratón: celulares y tabletas. */
function esTactil(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Mantiene el buffer del canvas del tamaño de su caja en pantalla, con el DPR limitado y
 * multiplicado por la escala dinámica de resolución (T13).
 * Llama a `alCambiar` después de cada cambio de tamaño. Devuelve una función para detenerlo.
 */
export function ajustarCanvas(canvas: HTMLCanvasElement, alCambiar: () => void): () => void {
  const actualizar = (): void => {
    const ancho = canvas.clientWidth;
    const alto = canvas.clientHeight;
    const dprEquipo = window.devicePixelRatio || 1;
    const dprUsado = Math.min(dprEquipo, DPR_MAX) * escalaResolucion.peek();
    const w = Math.max(1, Math.round(ancho * dprUsado));
    const h = Math.max(1, Math.round(alto * dprUsado));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    pantalla.value = { ancho, alto, dprEquipo, dprUsado };
    const girar = debeGirar(ancho, alto, esTactil());
    if (girarTelefono.peek() !== girar) girarTelefono.value = girar;
    alCambiar();
  };

  const observador = new ResizeObserver(actualizar);
  observador.observe(canvas);
  // El zoom del navegador o mover la ventana a otro monitor cambian el DPR sin cambiar el tamaño.
  window.addEventListener('resize', actualizar);
  // Cuando el motor cambia la escala, el búfer se rehace (el CSS del canvas no cambia).
  // `subscribe` llama una vez de entrada: así queda el primer ajuste.
  const dejarDeSeguirEscala = escalaResolucion.subscribe(actualizar);

  return () => {
    observador.disconnect();
    window.removeEventListener('resize', actualizar);
    dejarDeSeguirEscala();
    girarTelefono.value = false;
  };
}
