import { batch, signal } from '@preact/signals';

/**
 * Cuaderno del jugador (T36). En individual lo escribe el controlador de la partida; en
 * cooperativo lo escribirá el anfitrión con los eventos `nota` (T86).
 */

/** Máximo de caracteres por nota (igual que la intención `nota` del protocolo). */
export const MAX_NOTA = 280;
/** Máximo de notas: es lo que acepta el guardado (`MAX_NOTAS` de `game/guardado.ts`). */
export const MAX_NOTAS = 50;

export interface Nota {
  id: string;
  texto: string;
}

/** Ids de los objetos con datos ya inspeccionados, en el orden en que se encontraron. */
export const datosEncontrados = signal<readonly string[]>([]);
export const notas = signal<readonly Nota[]>([]);
/** El jugador ya recogió el cuaderno de la portería: el HUD muestra su botón. */
export const cuadernoActivo = signal(false);

/** Limpia un texto de nota: sin espacios a los lados y con el máximo de caracteres. */
export function limpiarNota(texto: string): string {
  return [...texto.trim()].slice(0, MAX_NOTA).join('');
}

export function reiniciarCuaderno(): void {
  batch(() => {
    datosEncontrados.value = [];
    notas.value = [];
    cuadernoActivo.value = false;
  });
}
