import { batch, signal } from '@preact/signals';
import { fichas, type Ficha } from './contenido';
import { enfocado, type ObjetoEnfocado } from './interfaz';
import { FINALES, type FinalId } from './partida';

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

/**
 * Fichas de ejemplo de la sala 1: la factura está dividida entre la caja y el reverso del
 * menú, así que ninguna de las dos basta sola. No incluyen la respuesta.
 */
export const FICHAS_EJEMPLO: Readonly<Record<string, Ficha>> = {
  's1-factura': {
    titulo: 'Factura de la caja',
    descripcion: 'Media factura arrugada, encontrada junto a la registradora.',
    bloques: [
      {
        tipo: 'tabla',
        titulo: 'Cooperativa escolar · Factura de venta',
        columnas: ['Producto', 'Cantidad', 'Precio unitario'],
        filas: [['Refrigerio', '4', '$5.000']],
      },
      { tipo: 'texto', texto: 'La parte de abajo de la factura está rota.' },
    ],
  },
  's1-menu': {
    titulo: 'Menú de la cooperativa',
    descripcion: 'Al reverso del menú está pegada la otra mitad de la factura.',
    bloques: [
      {
        tipo: 'lista',
        items: ['Refrigerio: $5.000', 'Jugo: $2.500', 'Empanada: $2.000'],
      },
      { tipo: 'nota', texto: 'Descuento de 15 % sobre el total de la compra.' },
    ],
  },
};

/** `true` mientras la partida usa datos de ejemplo. */
export const conEjemplo = signal(false);

let siguiente = 0;

/** Lee el parámetro de la URL. Solo se acepta el valor exacto `1`. */
export function pideEjemplo(busqueda: string): boolean {
  return new URLSearchParams(busqueda).get('ejemplo') === '1';
}

/**
 * `/jugar?ejemplo=1&final=<id>`: para ver una pantalla de final sin jugar la partida.
 * Solo se aceptan los ids de la lista de finales; cualquier otro valor se ignora.
 */
export function finalPedido(busqueda: string): FinalId | null {
  const valor = new URLSearchParams(busqueda).get('final');
  return FINALES.find((f) => f === valor) ?? null;
}

/**
 * Pone las fichas de ejemplo y el primer objeto enfocado. Lo llama el controlador al recibir
 * la orden `ejemplo`; los sellos y las grabaciones de ejemplo los pone él en la partida.
 */
export function cargarEjemplo(): void {
  siguiente = 0;
  batch(() => {
    conEjemplo.value = true;
    fichas.value = FICHAS_EJEMPLO;
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
  fichas.value = {};
  siguiente = 0;
}
