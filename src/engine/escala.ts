/**
 * Escala dinámica de resolución (T13): si el celular no alcanza los 30 cuadros por segundo,
 * se dibuja con menos píxeles; si le sobra, se vuelve a subir. Va de 0,5 a 1,0 sobre el DPR
 * limitado a 1,25 (especificación, sección 0) y se decide cada 2 s con los fps medidos.
 *
 * Es lógica pura: el motor le pasa el paso de cada cuadro que dibuja a velocidad normal y,
 * cuando cambia, publica la escala nueva en el signal `escalaResolucion`.
 */

/** Límites de la escala sobre el DPR usado. */
export const ESCALA_MIN = 0.5;
export const ESCALA_MAX = 1;
/** Cada cuánto se decide, en segundos de cuadros dibujados. */
export const VENTANA_S = 2;
/** Por debajo de estos fps se baja la escala (el objetivo es 30 sostenidos). */
export const FPS_BAJAR = 27;
/** Por encima de estos fps se sube: con margen, para no subir y bajar sin parar. */
export const FPS_SUBIR = 50;
/** Cuánto se baja de una vez (rápido, para salir del tirón) y cuánto se sube (despacio). */
const PASO_BAJAR = 0.15;
const PASO_SUBIR = 0.05;

export interface EscalaDinamica {
  /** Escala actual, de `ESCALA_MIN` a `ESCALA_MAX`. */
  readonly valor: number;
  /**
   * Cuenta un cuadro dibujado que tardó `dt` segundos. Devuelve la escala nueva si cambió al
   * cerrar la ventana de 2 s; si no, `null`.
   */
  registrar(dt: number): number | null;
  /** Olvida la ventana en curso (tras una pausa, un panel o un cambio de sala). */
  reiniciar(): void;
}

const redondear = (x: number): number => Math.round(x * 100) / 100;

export function crearEscalaDinamica(inicial = ESCALA_MAX): EscalaDinamica {
  let valor = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, inicial));
  let tiempo = 0;
  let cuadros = 0;

  return {
    get valor() {
      return valor;
    },
    registrar(dt) {
      // El primer cuadro tras una pausa llega con dt = 0: no dice nada del rendimiento.
      if (!(dt > 0)) return null;
      tiempo += dt;
      cuadros++;
      if (tiempo < VENTANA_S) return null;
      const fps = cuadros / tiempo;
      tiempo = 0;
      cuadros = 0;
      let nuevo = valor;
      if (fps < FPS_BAJAR) nuevo = Math.max(ESCALA_MIN, redondear(valor - PASO_BAJAR));
      else if (fps > FPS_SUBIR) nuevo = Math.min(ESCALA_MAX, redondear(valor + PASO_SUBIR));
      if (nuevo === valor) return null;
      valor = nuevo;
      return valor;
    },
    reiniciar() {
      tiempo = 0;
      cuadros = 0;
    },
  };
}
