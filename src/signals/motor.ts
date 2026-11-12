import { signal } from '@preact/signals';

/**
 * Estado del motor 3D (T12). Lo escribe engine/, lo lee ui/.
 * - `cargando`: todavía no hay escena.
 * - `activo`: dibuja en cada cuadro.
 * - `pausado`: la pestaña está oculta; no se dibuja ni avanza el juego.
 * - `detenido`: se liberó todo (al salir de /jugar).
 */
export type EstadoMotor = 'cargando' | 'activo' | 'pausado' | 'detenido';

export const estadoMotor = signal<EstadoMotor>('detenido');
