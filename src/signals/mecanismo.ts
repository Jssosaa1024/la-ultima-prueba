import { batch, signal } from '@preact/signals';
import type { SalaConSello } from './partida';

/**
 * Estado del puzzle de la sala actual, para los paneles de mecanismo y de pistas (T31b).
 *
 * Lo escribe el controlador de la partida (`controlador.ts`) con las reglas de `game/`. Los
 * paneles solo leen: los textos y los controles de cada etapa salen de `content/puzzles.ts`
 * con el id del puzzle y el número de etapa.
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

export function reiniciarMecanismo(): void {
  batch(() => {
    etapa.value = null;
    mecanismo.value = null;
    condiciones.value = {};
    pistas.value = { ofrecidas: 0, vistas: 0 };
  });
}
