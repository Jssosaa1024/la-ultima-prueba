import { batch, computed, signal } from '@preact/signals';
import { fase } from './partida';

/**
 * Estado de la interfaz que también le importa al motor (T31).
 *
 * - `enfocado` lo escribe `engine/` (raycast, T18) y lo lee el HUD para el botón contextual.
 * - `panel` e `inspeccionando` los escribe `ui/` y los lee `engine/` para soltar los
 *   controles mientras hay un panel abierto.
 * - `carga` la escribe `engine/` (cargador de salas, T20) y la lee `ui/`.
 */

/**
 * Panel 2D abierto encima de la escena. Solo uno a la vez. `salida` es la elección de final
 * frente a la puerta de salida y `ayuda`, la confirmación del intercomunicador.
 */
export type Panel = 'cuaderno' | 'inspeccion' | 'pausa' | 'salida' | 'ayuda';

/** Lo que pasa al tocar el botón contextual sobre el objeto enfocado. */
export type AccionObjeto = 'usar' | 'recoger' | 'examinar';

export interface ObjetoEnfocado {
  id: string;
  nombre: string;
  accion: AccionObjeto;
}

/**
 * Algo que el mundo le muestra al jugador sin abrir un panel. Lleva ids y números, nunca
 * texto: el HUD lo convierte en una frase. Cada aviso es un objeto nuevo, para que se vuelva
 * a mostrar aunque sea igual al anterior.
 */
export interface Aviso {
  t: 'puerta_cerrada';
  /** Número de la sala (2 a 5) cuya puerta sigue cerrada. */
  sala: number;
}

export interface Carga {
  estado: 'inactiva' | 'cargando' | 'lista' | 'error';
  /** De 0 a 1. */
  progreso: number;
}

export const panel = signal<Panel | null>(null);
export const enfocado = signal<ObjetoEnfocado | null>(null);
/** Id del objeto que se ve en la vista de inspección 2D. */
export const inspeccionando = signal<string | null>(null);
export const carga = signal<Carga>({ estado: 'inactiva', progreso: 0 });
/** Último aviso sin leer. Lo escribe el controlador y lo borra el HUD al rato de mostrarlo. */
export const aviso = signal<Aviso | null>(null);

/** El motor solo mueve al jugador y lee toques cuando se está jugando y no hay panel abierto. */
export const controlesActivos = computed(() => fase.value === 'jugando' && panel.value === null);

/** Abre la vista de inspección de un objeto. */
export function abrirInspeccion(objeto: string): void {
  batch(() => {
    inspeccionando.value = objeto;
    panel.value = 'inspeccion';
  });
}

/** Abre el cuaderno. La pausa del reloj la pide el propio cuaderno al abrirse. */
export function abrirCuaderno(): void {
  batch(() => {
    inspeccionando.value = null;
    panel.value = 'cuaderno';
  });
}

/** Abre un panel que no necesita más datos (la puerta de salida o el intercomunicador). */
export function abrirPanel(cual: 'salida' | 'ayuda'): void {
  batch(() => {
    inspeccionando.value = null;
    panel.value = cual;
  });
}

export function avisar(nuevo: Aviso): void {
  aviso.value = nuevo;
}

export function cerrarAviso(): void {
  aviso.value = null;
}

/** Cierra cualquier panel y vuelve a la escena. */
export function cerrarPanel(): void {
  batch(() => {
    panel.value = null;
    inspeccionando.value = null;
  });
}

/**
 * Vuelve la interfaz al estado inicial (al salir al menú). No toca `carga`: es del motor, que
 * puede estar preparando una sala justo cuando empieza la partida (T20b).
 */
export function reiniciarInterfaz(): void {
  batch(() => {
    cerrarPanel();
    enfocado.value = null;
    aviso.value = null;
  });
}
