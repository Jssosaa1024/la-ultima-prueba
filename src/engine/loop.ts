/**
 * Bucle de juego (T12): corre con `setAnimationLoop` del renderer y se detiene del todo
 * cuando la pestaña se oculta (otra app, bloqueo de pantalla), para no gastar batería.
 *
 * También se detiene cuando el juego no lo necesita (T20b): detrás del menú y de las pantallas
 * de final no hay nada que animar. Corre solo si la pestaña se ve **y** `permitir(true)`.
 */

/** Paso de tiempo máximo: tras una pausa o un tirón, el juego no salta más de 0,1 s. */
export const DT_MAX = 0.1;

export type EstadoBucle = 'activo' | 'pausado' | 'detenido';

export interface DocumentoVisible {
  readonly hidden: boolean;
  addEventListener(tipo: 'visibilitychange', fn: () => void): void;
  removeEventListener(tipo: 'visibilitychange', fn: () => void): void;
}

export interface OpcionesBucle {
  /** `renderer.setAnimationLoop`: recibe la función de cada cuadro, o `null` para parar. */
  programar: (cuadro: ((tiempoMs: number) => void) | null) => void;
  /** Se llama en cada cuadro con el paso de tiempo en segundos (máx. `DT_MAX`). */
  alCuadro: (dt: number) => void;
  alCambiarEstado?: (estado: EstadoBucle) => void;
  documento?: DocumentoVisible;
  /** Si el bucle puede correr desde el principio. Por defecto, sí. */
  permitido?: boolean;
}

export interface Bucle {
  readonly estado: EstadoBucle;
  /** `false` pausa el bucle aunque la pestaña se vea; `true` lo deja correr si se ve. */
  permitir(permitido: boolean): void;
  detener(): void;
}

export function crearBucle({
  programar,
  alCuadro,
  alCambiarEstado,
  documento = document,
  permitido = true,
}: OpcionesBucle): Bucle {
  let estado: EstadoBucle = 'detenido';
  let iniciado = false;
  let anterior: number | null = null;

  const cambiar = (nuevo: EstadoBucle): void => {
    if (nuevo === estado) return;
    estado = nuevo;
    alCambiarEstado?.(nuevo);
  };

  const cuadro = (tiempoMs: number): void => {
    const dt = anterior === null ? 0 : Math.min(DT_MAX, Math.max(0, (tiempoMs - anterior) / 1000));
    anterior = tiempoMs;
    alCuadro(dt);
  };

  const reanudar = (): void => {
    anterior = null;
    programar(cuadro);
    cambiar('activo');
  };
  const pausar = (): void => {
    programar(null);
    cambiar('pausado');
  };
  /** Corre solo si la pestaña se ve y el juego lo permite. No hace nada si ya está así. */
  const ajustar = (): void => {
    if (iniciado && estado === 'detenido') return;
    const debeCorrer = permitido && !documento.hidden;
    if (debeCorrer && estado !== 'activo') reanudar();
    else if (!debeCorrer && estado !== 'pausado') pausar();
  };

  documento.addEventListener('visibilitychange', ajustar);
  ajustar();
  iniciado = true;

  return {
    get estado() {
      return estado;
    },
    permitir(nuevo) {
      permitido = nuevo;
      ajustar();
    },
    detener() {
      documento.removeEventListener('visibilitychange', ajustar);
      programar(null);
      cambiar('detenido');
    },
  };
}
