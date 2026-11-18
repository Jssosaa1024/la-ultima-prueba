import { signal } from '@preact/signals';
import { lineaPorId } from '../content/guion';

/**
 * Lo que La Voz tiene por decir (T34). El controlador de la partida pide cada línea por su
 * id del guion (`src/content/guion.json`, T34a) y la interfaz muestra el subtítulo de la
 * primera de la cola el tiempo que dura; luego pasa a la siguiente.
 *
 * Voz grabada (T42b): la interfaz anota en `lineaEnPantalla` la línea que está mostrando (el
 * subtítulo, el panel de una grabación o la pantalla de un final) y el motor la hace sonar.
 * El motor cuenta en `sonidoVoz` cuándo termina el audio, y el subtítulo lo sigue; si el
 * audio no carga, el subtítulo se ve igual su `duracion_s` estimada.
 */

/** Más líneas en espera no tienen sentido: el jugador ya pasó a otra cosa. */
export const MAX_COLA = 3;

/** Ids de las líneas por decir, en orden. La primera es la que se ve. */
export const colaVoz = signal<readonly string[]>([]);

/** Pide una línea. Se ignora si no existe en el guion, si ya está en la cola o si está llena. */
export function decir(id: string): void {
  const cola = colaVoz.value;
  if (!lineaPorId(id) || cola.includes(id) || cola.length >= MAX_COLA) return;
  colaVoz.value = [...cola, id];
}

/** La línea `id` terminó de verse: pasa a la siguiente. */
export function terminarLinea(id: string): void {
  if (colaVoz.value[0] === id) colaVoz.value = colaVoz.value.slice(1);
}

/** La línea de La Voz que la interfaz muestra ahora, o `null`. La escribe `ui/`. */
export const lineaEnPantalla = signal<string | null>(null);

/** La interfaz empieza a mostrar la línea `id`: el motor la hace sonar. */
export function mostrarLinea(id: string): void {
  if (lineaPorId(id)) lineaEnPantalla.value = id;
}

/** La interfaz deja de mostrar `id` (si otra la reemplazó, no cambia nada). */
export function ocultarLinea(id: string): void {
  if (lineaEnPantalla.peek() === id) lineaEnPantalla.value = null;
}

/**
 * Cómo va el audio de una línea. Lo escribe `engine/` (módulo de audio):
 * - `cargando`: se está bajando o decodificando;
 * - `sonando`: suena y termina en `terminaEn` (milisegundos de `performance.now()`);
 * - `sin-audio`: no cargó (sin red, sin el archivo o el navegador no lo decodifica).
 */
export type SonidoVoz =
  | { id: string; estado: 'cargando' }
  | { id: string; estado: 'sonando'; terminaEn: number }
  | { id: string; estado: 'sin-audio' };

export const sonidoVoz = signal<SonidoVoz | null>(null);

/** Cuánto sigue el subtítulo en pantalla después de que termina el audio. */
export const COLA_SUBTITULO_MS = 300;
/** Lo que se espera de más a un audio que no termina de cargar antes de pasar a la siguiente. */
export const ESPERA_CARGA_MS = 2500;

/**
 * Cuánto falta para quitar el subtítulo de `id`, en milisegundos, según el audio:
 * - si suena, hasta que termine (más una cola corta);
 * - si no hay audio (o el navegador aún no deja sonar), su duración estimada;
 * - si está cargando, la estimada más un margen, por si el audio nunca llega.
 */
export function msDeSubtitulo(
  id: string,
  duracionS: number,
  sonido: SonidoVoz | null,
  audioListo: boolean,
  ahora: number,
): number {
  const estimada = duracionS * 1000;
  if (!audioListo || !sonido || sonido.id !== id)
    return audioListo ? estimada + ESPERA_CARGA_MS : estimada;
  if (sonido.estado === 'sonando') return Math.max(0, sonido.terminaEn - ahora) + COLA_SUBTITULO_MS;
  if (sonido.estado === 'cargando') return estimada + ESPERA_CARGA_MS;
  return estimada;
}

export function reiniciarVoz(): void {
  colaVoz.value = [];
  lineaEnPantalla.value = null;
  sonidoVoz.value = null;
}
