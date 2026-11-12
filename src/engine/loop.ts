/**
 * Bucle de juego (T12): corre con `setAnimationLoop` del renderer y se detiene del todo
 * cuando la pestaña se oculta (otra app, bloqueo de pantalla), para no gastar batería.
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
}

export interface Bucle {
  readonly estado: EstadoBucle;
  detener(): void;
}

export function crearBucle({
  programar,
  alCuadro,
  alCambiarEstado,
  documento = document,
}: OpcionesBucle): Bucle {
  let estado: EstadoBucle = 'detenido';
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
  const alCambiarVisibilidad = (): void => {
    if (estado === 'detenido') return;
    if (documento.hidden) pausar();
    else reanudar();
  };

  documento.addEventListener('visibilitychange', alCambiarVisibilidad);
  if (documento.hidden) {
    estado = 'pausado';
    alCambiarEstado?.('pausado');
  } else {
    reanudar();
  }

  return {
    get estado() {
      return estado;
    },
    detener() {
      documento.removeEventListener('visibilitychange', alCambiarVisibilidad);
      programar(null);
      cambiar('detenido');
    },
  };
}
