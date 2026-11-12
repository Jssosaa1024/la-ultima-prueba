import { pantalla } from '../signals/pantalla';

/** Límite de resolución interna en celular (especificación, sección 0). */
export const DPR_MAX = 1.25;

/**
 * Mantiene el buffer del canvas del tamaño de su caja en pantalla, con el DPR limitado.
 * Llama a `alCambiar` después de cada cambio de tamaño. Devuelve una función para detenerlo.
 */
export function ajustarCanvas(canvas: HTMLCanvasElement, alCambiar: () => void): () => void {
  const actualizar = (): void => {
    const ancho = canvas.clientWidth;
    const alto = canvas.clientHeight;
    const dprEquipo = window.devicePixelRatio || 1;
    const dprUsado = Math.min(dprEquipo, DPR_MAX);
    const w = Math.max(1, Math.round(ancho * dprUsado));
    const h = Math.max(1, Math.round(alto * dprUsado));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    pantalla.value = { ancho, alto, dprEquipo, dprUsado };
    alCambiar();
  };

  const observador = new ResizeObserver(actualizar);
  observador.observe(canvas);
  // El zoom del navegador o mover la ventana a otro monitor cambian el DPR sin cambiar el tamaño.
  window.addEventListener('resize', actualizar);
  actualizar();

  return () => {
    observador.disconnect();
    window.removeEventListener('resize', actualizar);
  };
}
