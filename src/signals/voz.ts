import { signal } from '@preact/signals';
import { lineaPorId } from '../content/guion';

/**
 * Lo que La Voz tiene por decir (T34). El controlador de la partida pide cada línea por su
 * id del guion (`src/content/guion.json`, T34a) y la interfaz muestra el subtítulo de la
 * primera de la cola el tiempo que dura; luego pasa a la siguiente.
 *
 * Mientras no exista el audio, cada línea se muestra su `duracion_s` estimada. Cuando llegue
 * la voz grabada (T43), el subtítulo seguirá al audio que se llama igual que el id.
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

export function reiniciarVoz(): void {
  colaVoz.value = [];
}
