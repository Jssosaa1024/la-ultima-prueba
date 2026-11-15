import { batch, signal } from '@preact/signals';
import type { SalaConSello } from './partida';

/**
 * Estado del puzzle de la sala actual, para los paneles de mecanismo y de pistas (T31b).
 *
 * Lo escribe el controlador de la partida (`controlador.ts`) con las reglas de `game/`. Los
 * paneles solo leen: los textos y los controles de cada etapa salen de `content/puzzles.ts`
 * con el id del puzzle y el número de etapa. Para cambiar algo, el panel envía por el puente
 * `ajustar` (ajustes nuevos, completos) o `accionar` (la palanca, la polea o la manija).
 */

export interface EtapaActual {
  sala: SalaConSello;
  /** Id del puzzle (`s1-etiquetadora` … `s5-urna`). */
  puzzle: string;
  /** 0 = presentar, 1 = torcer, 2 = dominar. */
  etapa: number;
}

/** Cuántas pistas del puzzle de la sala actual se han ofrecido y cuántas abrió el jugador. */
export interface PistasDeSala {
  ofrecidas: number;
  vistas: number;
}

/** Etapa que falta resolver en la sala actual; `null` en la portería o si ya tiene sello. */
export const etapa = signal<EtapaActual | null>(null);

/**
 * Ajustes del mecanismo en la etapa actual, con la forma de `estado_inicial` de su puzzle.
 * Cada panel lo revisa con el `esEstado…` de su mecanismo antes de dibujarlo.
 */
export const mecanismo = signal<unknown>(null);

/** Condiciones de la etapa que se cumplen con esos ajustes (por ejemplo, una por lámpara). */
export const condiciones = signal<Readonly<Record<string, boolean>>>({});

export const pistas = signal<PistasDeSala>({ ofrecidas: 0, vistas: 0 });

/**
 * Lo último que respondió una máquina (T31d): al accionarla (palanca, polea, manija) o, en las
 * máquinas que responden en vivo, al quedar resuelta. El panel lo usa para mostrar lo que pasó
 * con esos ajustes; la máquina nunca dice «incorrecto».
 *
 * Cuando `resuelta` es verdadero la partida ya avanzó: `etapa` y `mecanismo` son de la etapa
 * siguiente (o `null` si la sala quedó resuelta), y este resultado sigue siendo el de antes.
 */
export interface ResultadoMecanismo {
  /** Sube con cada resultado, para animar aunque sea igual al anterior. */
  n: number;
  sala: SalaConSello;
  puzzle: string;
  /** Etapa en la que se dio el resultado (0 a 2). */
  etapa: number;
  /** Ajustes con los que respondió la máquina. */
  estado: unknown;
  condiciones: Readonly<Record<string, boolean>>;
  resuelta: boolean;
  /** Con esta etapa se resolvió la sala: hay sello nuevo. */
  sello: boolean;
}

export const resultado = signal<ResultadoMecanismo | null>(null);

/**
 * Cómo quedó la máquina de la sala actual, si la sala ya tiene su sello (T76): los ajustes
 * con los que se resolvió la última etapa. Al volver a una sala resuelta, su máquina se ve
 * como se dejó. `null` en la portería y en las salas con etapas pendientes.
 *
 * Después de recargar la página no se sabe con qué ajustes exactos se resolvió, así que vale
 * la solución de ejemplo de la última etapa del puzzle.
 */
export const maquinaResuelta = signal<unknown>(null);

export function reiniciarMecanismo(): void {
  batch(() => {
    etapa.value = null;
    mecanismo.value = null;
    condiciones.value = {};
    pistas.value = { ofrecidas: 0, vistas: 0 };
    resultado.value = null;
    maquinaResuelta.value = null;
  });
}
