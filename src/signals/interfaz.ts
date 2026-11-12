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

/** Panel 2D abierto encima de la escena. Solo uno a la vez. */
export type Panel = 'cuaderno' | 'inspeccion' | 'pausa';

/** Lo que pasa al tocar el botón contextual sobre el objeto enfocado. */
export type AccionObjeto = 'usar' | 'recoger' | 'examinar';

export interface ObjetoEnfocado {
  id: string;
  nombre: string;
  accion: AccionObjeto;
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

/** El motor solo mueve al jugador y lee toques cuando se está jugando y no hay panel abierto. */
export const controlesActivos = computed(() => fase.value === 'jugando' && panel.value === null);

/** Abre la vista de inspección de un objeto. */
export function abrirInspeccion(objeto: string): void {
  batch(() => {
    inspeccionando.value = objeto;
    panel.value = 'inspeccion';
  });
}

/** Cierra cualquier panel y vuelve a la escena. */
export function cerrarPanel(): void {
  batch(() => {
    panel.value = null;
    inspeccionando.value = null;
  });
}

/** Vuelve la interfaz al estado inicial (al salir al menú). */
export function reiniciarInterfaz(): void {
  batch(() => {
    cerrarPanel();
    enfocado.value = null;
    carga.value = { estado: 'inactiva', progreso: 0 };
  });
}
