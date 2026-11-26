import { escalaResolucion, girarTelefono, pantalla, pixelRatioForzado } from '../signals/pantalla';

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

/** Lo que se usa de `window.visualViewport`: la parte de la página que de verdad se ve. */
export interface VistaVisible {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  scale: number;
}

/**
 * Tamaño y posición en píxeles CSS que debe tener el contenedor del juego para cubrir justo lo
 * que se ve (corrección del 25 de noviembre: pantalla corrida al volver al navegador).
 *
 * `null` deja el CSS de siempre (`inset: 0`): sin `visualViewport`, con zoom (escala distinta
 * de 1) o mientras el jugador escribe, porque el teclado achica lo visible y el formulario no
 * debe encogerse por eso.
 */
export function areaVisible(
  vista: VistaVisible | null,
  escribiendo: boolean,
): { ancho: number; alto: number; izquierda: number; arriba: number } | null {
  if (!vista || escribiendo) return null;
  if (Math.abs(vista.scale - 1) > 0.01) return null;
  const ancho = Math.round(vista.width);
  const alto = Math.round(vista.height);
  if (ancho <= 0 || alto <= 0) return null;
  return {
    ancho,
    alto,
    izquierda: Math.round(vista.offsetLeft),
    arriba: Math.round(vista.offsetTop),
  };
}

/** Hay un campo de texto con el foco (el teclado del celular puede estar abierto). */
function escribiendo(): boolean {
  const activo = document.activeElement;
  if (!(activo instanceof HTMLElement)) return false;
  return activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA' || activo.isContentEditable;
}

/**
 * Mantiene el contenedor del juego del tamaño de lo que se ve y sin desplazamiento.
 *
 * Al salir del navegador en pantalla completa y volver (sobre todo si el teléfono se giró
 * mientras tanto), el navegador puede dejar la página desplazada o con la ventana de diseño
 * de otro tamaño que la parte visible. Como la página no tiene scroll, el jugador no puede
 * corregirlo y queda un pedazo del juego por fuera (hasta ahora se arreglaba saliendo y
 * volviendo a entrar a pantalla completa, que obliga al navegador a medir de nuevo). Aquí, al
 * volver a la página, al girar, al entrar o salir de pantalla completa y cuando cambia lo
 * visible: se quita cualquier desplazamiento y el contenedor toma el tamaño y la posición de
 * `visualViewport`, que es lo que de verdad se ve. Se repite en los cuadros siguientes porque
 * algunos navegadores avisan del giro antes de tener las medidas nuevas.
 * Devuelve una función para detenerlo.
 */
export function seguirAreaVisible(contenedor: HTMLElement): () => void {
  const vista = window.visualViewport;
  let cuadro = 0;
  let espera: ReturnType<typeof setTimeout> | undefined;

  const ajustar = (): void => {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    if (contenedor.scrollTop !== 0) contenedor.scrollTop = 0;
    if (contenedor.scrollLeft !== 0) contenedor.scrollLeft = 0;
    const area = areaVisible(vista, escribiendo());
    if (area) {
      contenedor.style.setProperty('--ancho-visible', `${area.ancho}px`);
      contenedor.style.setProperty('--alto-visible', `${area.alto}px`);
      contenedor.style.setProperty('--izquierda-visible', `${area.izquierda}px`);
      contenedor.style.setProperty('--arriba-visible', `${area.arriba}px`);
    } else {
      quitarVariables(contenedor);
    }
  };

  const ajustarYRepetir = (): void => {
    ajustar();
    cancelAnimationFrame(cuadro);
    cuadro = requestAnimationFrame(() => {
      ajustar();
      cuadro = requestAnimationFrame(ajustar);
    });
    clearTimeout(espera);
    espera = setTimeout(ajustar, 300);
  };

  const alCambiarVisibilidad = (): void => {
    if (document.visibilityState === 'visible') ajustarYRepetir();
  };

  ajustar();
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  document.addEventListener('fullscreenchange', ajustarYRepetir);
  window.addEventListener('pageshow', ajustarYRepetir);
  window.addEventListener('orientationchange', ajustarYRepetir);
  window.addEventListener('resize', ajustarYRepetir);
  vista?.addEventListener('resize', ajustarYRepetir);
  vista?.addEventListener('scroll', ajustar);

  return () => {
    cancelAnimationFrame(cuadro);
    clearTimeout(espera);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    document.removeEventListener('fullscreenchange', ajustarYRepetir);
    window.removeEventListener('pageshow', ajustarYRepetir);
    window.removeEventListener('orientationchange', ajustarYRepetir);
    window.removeEventListener('resize', ajustarYRepetir);
    vista?.removeEventListener('resize', ajustarYRepetir);
    vista?.removeEventListener('scroll', ajustar);
    quitarVariables(contenedor);
  };
}

/** Sin variables, el contenedor vuelve al CSS de siempre: toda la ventana. */
function quitarVariables(contenedor: HTMLElement): void {
  for (const v of [
    '--ancho-visible',
    '--alto-visible',
    '--izquierda-visible',
    '--arriba-visible',
  ]) {
    contenedor.style.removeProperty(v);
  }
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
    // La prueba de estrés (?debug=1) puede fijar el pixel ratio; si no, el del juego.
    const dprUsado =
      pixelRatioForzado.peek() ?? Math.min(dprEquipo, DPR_MAX) * escalaResolucion.peek();
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
  const dejarDeSeguirForzado = pixelRatioForzado.subscribe(actualizar);

  return () => {
    observador.disconnect();
    window.removeEventListener('resize', actualizar);
    dejarDeSeguirEscala();
    dejarDeSeguirForzado();
    girarTelefono.value = false;
  };
}
