/**
 * Sugerencia de instalar el juego en iPhone (T95). Safari en iPhone no tiene pantalla completa:
 * la única forma de jugar sin las barras del navegador es agregarlo a la pantalla de inicio.
 * En Android no hace falta (el botón «Pantalla completa» ya existe).
 */

export interface Navegador {
  userAgent: string;
  /** `navigator.platform`: un iPad reciente dice «MacIntel» pero tiene pantalla táctil. */
  plataforma: string;
  toques: number;
  /** Ya se abrió desde la pantalla de inicio (`display-mode: standalone` o `navigator.standalone`). */
  instalado: boolean;
}

/** iPhone o iPad (también un iPad que se presenta como Mac). */
export function esIOS(n: Navegador): boolean {
  return /iPhone|iPad|iPod/.test(n.userAgent) || (n.plataforma === 'MacIntel' && n.toques > 1);
}

export function sugerirInstalar(n: Navegador): boolean {
  return esIOS(n) && !n.instalado;
}

/** Lee el navegador actual. Cualquier error se trata como «no sugerir». */
export function navegadorActual(): Navegador {
  const nav = navigator as Navigator & { standalone?: boolean };
  let instalado = nav.standalone === true;
  try {
    instalado ||= window.matchMedia('(display-mode: standalone)').matches;
    instalado ||= window.matchMedia('(display-mode: fullscreen)').matches;
  } catch {
    // Sin matchMedia: se queda con lo que dijo navigator.standalone.
  }
  return {
    userAgent: nav.userAgent,
    plataforma: nav.platform,
    toques: nav.maxTouchPoints,
    instalado,
  };
}

export const TEXTO_INSTALAR =
  'Para jugar sin las barras de Safari, toca Compartir y luego «Agregar a inicio». Después abre el juego desde ese icono.';
