import { batch, computed, signal } from '@preact/signals';
import { girarTelefono } from './pantalla';
import { fase } from './partida';
import type { Alias } from '../net/protocolo';

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
 * frente a la puerta de salida; `ayuda`, la confirmación del intercomunicador; `mecanismo`,
 * la máquina de la sala actual; y `pistas`, las pistas de esa máquina.
 */
export type Panel =
  | 'cuaderno'
  | 'inspeccion'
  | 'pausa'
  | 'salida'
  | 'ayuda'
  | 'mecanismo'
  | 'pistas'
  /** La grabación escondida en la sala actual, recién recogida (T75). */
  | 'grabacion'
  /** Sensibilidad, modo zurdo, tamaño del texto y volumen (T39). */
  | 'ajustes';

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
export type Aviso =
  | {
      t: 'puerta_cerrada';
      /** Número de la sala (2 a 5) cuya puerta sigue cerrada. */
      sala: number;
    }
  /**
   * Una puerta falsa del pasillo: suena el picaporte y sale su frase (`frase`, id de
   * `puertas-falsas.json`). `hablada` dice que La Voz la está diciendo: entonces el texto va
   * en el subtítulo y el aviso no lo repite.
   */
  | { t: 'puerta_falsa'; frase: string; hablada: boolean }
  /**
   * Sala 2 (corrección del 25 de noviembre): se tocó una estación que no es la de la etapa
   * pendiente. `estacion` y `encendida` son números de estación (1 a 3).
   */
  | { t: 'estacion'; estacion: number; resuelta: boolean; encendida: number | null }
  /** Cooperativo: ese dato solo se lee con una herramienta que este jugador no lleva. */
  | { t: 'necesita_herramienta'; objeto: string; herramienta: string }
  /** Cooperativo (T84d): un compañero (`de`, su alias) le pasó un objeto a este jugador. */
  | { t: 'objeto_recibido'; objeto: string; de: Alias | null }
  /** Cooperativo (T84d): este jugador le pasó un objeto a un compañero (`a`, su alias). */
  | { t: 'objeto_pasado'; objeto: string; a: Alias | null };

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
/**
 * Número (`n`) del último resultado resuelto de una máquina al que el jugador ya le dio
 * «Seguir» en su panel. Mientras el signal `resultado` tenga uno más nuevo, el panel sigue
 * mostrando la etapa resuelta. Lo escribe el panel de mecanismo.
 */
export const resultadoVisto = signal(0);
/**
 * Panel de la máquina en franja (correcciones del 25 nov, sesión C): en horizontal, el panel
 * es una columna a la derecha y la máquina 3D se ve a su izquierda. `derecha` es la fracción
 * del ancho (0 a 1) que tapa esa columna: 0 sin panel de máquina, con el panel recogido en su
 * pestaña o en vertical. Lo escribe `ui/` y lo lee `engine/` para encuadrar la máquina en el
 * ancho que queda libre (sesión A).
 */
export const franja = signal<{ derecha: number }>({ derecha: 0 });
/**
 * El panel de la máquina está recogido en su pestaña (botón «Ver» o mientras la máquina se
 * mueve): la escena se ve entera. Lo escribe `ui/` y lo lee `engine/` (la mano de la urna).
 */
export const panelRecogido = signal(false);
/** Último aviso sin leer. Lo escribe el controlador y lo borra el HUD al rato de mostrarlo. */
export const aviso = signal<Aviso | null>(null);

/**
 * El motor solo mueve al jugador y lee toques cuando se está jugando, no hay panel abierto y
 * el celular no está en vertical (T41b).
 */
export const controlesActivos = computed(
  () => fase.value === 'jugando' && panel.value === null && !girarTelefono.value,
);

/** Abre la vista de inspección de un objeto. */
export function abrirInspeccion(objeto: string): void {
  batch(() => {
    inspeccionando.value = objeto;
    panel.value = 'inspeccion';
  });
}

/** Abre el cuaderno. El reloj sigue corriendo mientras está abierto (T36b). */
export function abrirCuaderno(): void {
  batch(() => {
    inspeccionando.value = null;
    panel.value = 'cuaderno';
  });
}

/** Abre un panel que no necesita más datos (la puerta de salida, la máquina de la sala…). */
export function abrirPanel(
  cual: 'salida' | 'ayuda' | 'mecanismo' | 'pistas' | 'grabacion' | 'ajustes' | 'pausa',
): void {
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
    panelRecogido.value = false;
    franja.value = { derecha: 0 };
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
