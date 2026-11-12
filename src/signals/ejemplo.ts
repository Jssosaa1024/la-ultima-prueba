import { batch, signal } from '@preact/signals';
import { enfocado, type ObjetoEnfocado } from './interfaz';
import { sellos } from './partida';

/**
 * DATOS DE EJEMPLO para ver el HUD, la inspección y el cuaderno antes de que existan el
 * raycast del motor (T18) y el contenido de las salas (T21–T22).
 *
 * Se activan solo con `/jugar?ejemplo=1`. Simulan que el jugador va enfocando, uno tras otro,
 * los objetos de la sala 1. Se borran cuando el motor escriba `enfocado` de verdad.
 */

/** Objetos de ejemplo de la sala 1, en el orden en que se enfocan. */
export const OBJETOS_EJEMPLO: readonly ObjetoEnfocado[] = [
  { id: 's1-factura', nombre: 'Factura de la caja', accion: 'examinar' },
  { id: 's1-menu', nombre: 'Menú de la cooperativa', accion: 'examinar' },
  { id: 's1-tarjeta', nombre: 'Tarjeta de porcentajes', accion: 'recoger' },
];

/** `true` mientras la partida usa datos de ejemplo. */
export const conEjemplo = signal(false);

let siguiente = 0;

/** Lee el parámetro de la URL. Solo se acepta el valor exacto `1`. */
export function pideEjemplo(busqueda: string): boolean {
  return new URLSearchParams(busqueda).get('ejemplo') === '1';
}

/** Pone el primer objeto enfocado y un sello ya ganado, para ver el HUD con datos. */
export function cargarEjemplo(): void {
  siguiente = 0;
  batch(() => {
    conEjemplo.value = true;
    sellos.value = ['s1-cooperativa'];
    enfocarSiguiente();
  });
}

/** Simula que el jugador mira el siguiente objeto (en orden circular). */
export function enfocarSiguiente(): void {
  if (!conEjemplo.value) return;
  enfocado.value = OBJETOS_EJEMPLO[siguiente % OBJETOS_EJEMPLO.length] ?? null;
  siguiente++;
}

export function quitarEjemplo(): void {
  conEjemplo.value = false;
  siguiente = 0;
}
