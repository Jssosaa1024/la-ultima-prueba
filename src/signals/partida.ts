import { batch, computed, signal } from '@preact/signals';

/**
 * Estado de la partida que ven la interfaz y el motor (T31).
 *
 * Quién escribe aquí: la lógica del juego (`game/`, T24–T30) a través de su controlador, y
 * mientras esa lógica no exista, el controlador provisional. `ui/` y `engine/` solo leen
 * estos signals y piden cambios con `enviar()` de `signals/puente.ts`.
 */

/** Salas en el orden del recorrido. La portería no entrega sello. */
export const SALAS = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;
export type SalaId = (typeof SALAS)[number];

/** Salas que entregan un sello al resolver su pregunta (las cinco del recorrido). */
export const SALAS_CON_SELLO = SALAS.filter(
  (s): s is Exclude<SalaId, 'porteria'> => s !== 'porteria',
);
export type SalaConSello = (typeof SALAS_CON_SELLO)[number];

/** Fragmentos opcionales de la grabación (salas 2, 3 y 4). */
export const GRABACIONES = ['grab-1', 'grab-2', 'grab-3'] as const;
export type GrabacionId = (typeof GRABACIONES)[number];

/** Los cuatro finales del diseño. */
export const FINALES = ['justo_a_tiempo', 'el_legado', 'pedir_ayuda', 'tiempo_cumplido'] as const;
export type FinalId = (typeof FINALES)[number];

/** En qué pantalla está el jugador. */
export type Fase = 'inicio' | 'cargando' | 'jugando' | 'final';
export type Modo = 'individual' | 'cooperativo';

/** 40 minutos activos. */
export const DURACION_MS = 40 * 60 * 1000;

/**
 * Reloj sin ticks, igual que el evento `reloj` del protocolo: guarda cuánto quedaba en el
 * instante `desde` (`performance.now()`) y si estaba en pausa. Cada quien descuenta con su
 * propio reloj; así el signal no cambia 60 veces por segundo.
 */
export interface Reloj {
  restanteMs: number;
  pausado: boolean;
  desde: number;
}

/** Milisegundos que quedan en el instante `ahora`, nunca negativos. */
export function restanteEn(reloj: Reloj, ahora: number): number {
  const restante = reloj.pausado ? reloj.restanteMs : reloj.restanteMs - (ahora - reloj.desde);
  return Math.max(0, restante);
}

/** Objeto que el jugador lleva consigo. `nombre` viene del contenido del bundle, no de la red. */
export interface ObjetoInventario {
  id: string;
  nombre: string;
}

export const fase = signal<Fase>('inicio');
export const modo = signal<Modo | null>(null);
export const sala = signal<SalaId>('porteria');
export const reloj = signal<Reloj>({ restanteMs: DURACION_MS, pausado: true, desde: 0 });
export const sellos = signal<readonly SalaConSello[]>([]);
export const grabaciones = signal<readonly GrabacionId[]>([]);
export const inventario = signal<readonly ObjetoInventario[]>([]);
export const final = signal<FinalId | null>(null);

/** Cuántos sellos lleva el jugador o el grupo (0 a 5). */
export const totalSellos = computed(() => sellos.value.length);

/** Vuelve todo al estado de antes de empezar, por ejemplo al salir al menú. */
export function reiniciarPartida(): void {
  batch(() => {
    fase.value = 'inicio';
    modo.value = null;
    sala.value = 'porteria';
    reloj.value = { restanteMs: DURACION_MS, pausado: true, desde: 0 };
    sellos.value = [];
    grabaciones.value = [];
    inventario.value = [];
    final.value = null;
  });
}
