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

/**
 * Encuadre de la máquina (corrección del 25 de noviembre): con el panel de una máquina abierto,
 * la cámara se acerca y la deja en la parte de la pantalla que el panel no tapa.
 * - `libre`: se dibuja con la cámara del jugador.
 * - `acercando` y `volviendo`: la cámara va hacia la máquina o de vuelta (unos 0,6 s).
 * - `encuadrada`: la máquina está en su sitio; el panel puede animarse sin que la cámara se mueva.
 * Lo escribe engine/ (motor.ts); lo lee ui/ (sesión C).
 */
export type EstadoEncuadre = 'libre' | 'acercando' | 'encuadrada' | 'volviendo';

export const encuadre = signal<EstadoEncuadre>('libre');
