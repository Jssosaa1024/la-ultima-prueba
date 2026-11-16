import { batch, signal } from '@preact/signals';

/**
 * Cuaderno del jugador (T36). En individual lo escribe el controlador de la partida; en
 * cooperativo, el controlador cooperativo.
 *
 * El cuaderno no se comparte por la red (decisión de la ola 4): no hay intención ni evento
 * `nota`, porque sería chat libre entre menores. En grupo, cada jugador tiene el suyo; lo que
 * coincide es lo que el anfitrión ya difunde por sus propios eventos: los datos encontrados
 * (`revelado`) y las pistas abiertas (`pista`). Las notas se quedan en este navegador (T86).
 */

/** Máximo de caracteres por nota (el mismo `MAX_NOTA` del guardado, `game/guardado.ts`). */
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
