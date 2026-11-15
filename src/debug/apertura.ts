/**
 * Cómo se abre el panel de depuración (T11n): con `?debug=1` en la URL o con 3 toques
 * seguidos en la esquina superior izquierda. Lógica pura, con pruebas de unidad.
 */

/**
 * Tamaño de la esquina, en píxeles CSS desde el borde superior izquierdo. Durante la partida
 * el botón «Salir» ocupa parte de ella (de 8 a 56 px): se toca justo debajo de él.
 */
export const LADO_ESQUINA = 80;
/** Los 3 toques deben caber en este tiempo. */
export const VENTANA_TOQUES_MS = 1000;
export const TOQUES_PARA_ABRIR = 3;

/**
 * El parámetro viene de fuera del bundle: solo se acepta el valor exacto `1`
 * (CLAUDE.md, «Seguridad»).
 */
export function pideDepuracion(busqueda: string): boolean {
  try {
    return new URLSearchParams(busqueda).get('debug') === '1';
  } catch {
    return false;
  }
}

export interface DetectorToques {
  /** Cuenta un toque en (x, y) en el instante `ms`. Devuelve `true` al completar los 3. */
  tocar(x: number, y: number, ms: number): boolean;
}

export function crearDetectorToques(
  lado = LADO_ESQUINA,
  ventanaMs = VENTANA_TOQUES_MS,
): DetectorToques {
  const instantes: number[] = [];
  return {
    tocar(x, y, ms) {
      if (x < 0 || y < 0 || x > lado || y > lado) {
        instantes.length = 0;
        return false;
      }
      instantes.push(ms);
      while (instantes.length > 0 && ms - (instantes[0] ?? ms) > ventanaMs) instantes.shift();
      if (instantes.length >= TOQUES_PARA_ABRIR) {
        instantes.length = 0;
        return true;
      }
      return false;
    },
  };
}
