/**
 * Comprobaciones del equipo antes de arrancar el juego (especificación, «Render»:
 * Three.js exige WebGL2; en equipos sin WebGL2 se muestra un aviso).
 */

/** Parámetro de prueba: `/jugar?sinwebgl2=1` muestra el aviso aunque el equipo tenga WebGL2. */
const PARAM_SIMULAR = 'sinwebgl2';

/**
 * Devuelve `true` si el navegador puede crear un contexto WebGL2.
 * Usa un canvas aparte y libera el contexto de inmediato, para no gastar uno de los
 * pocos contextos que permite el navegador en celulares.
 */
export function tieneWebGL2(): boolean {
  if (new URLSearchParams(window.location.search).has(PARAM_SIMULAR)) return false;
  if (typeof WebGL2RenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    // Algunos navegadores lanzan un error en vez de devolver null (p. ej. GPU en lista negra).
    return false;
  }
}
