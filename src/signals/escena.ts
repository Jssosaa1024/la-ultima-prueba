import { effect, signal } from '@preact/signals';
import { CLAVE_SIN_ESCENAS, escenasApagadas, esEscena, type EscenaId } from '../content/escenas';
import { fase, final } from './partida';

/**
 * La escena que se está viendo (Historia A): la intro o un final del caso de Don Efraín, con la
 * cámara guiada en la portería (`engine/escenas/`), y su capa de tarjetas, subtítulos y «Saltar»
 * (`ui/escenas/`). Las dos partes leen el mismo reloj: `desde`, en `performance.now()`.
 *
 * Mientras `escena` no es `null`, la capa tapa el HUD y los controles no mueven al jugador; en la
 * intro el reloj de la partida no corre (`controlador.ts`). Al terminar o saltarla vuelve a
 * `null` y `escenaTerminada` dice cuál fue y cómo terminó.
 *
 * Las escenas salen siempre (decisión de Alex, 27 de noviembre de 2026) y se saltan con un
 * toque. Solo las pruebas e2e las apagan (`lup:sin-escenas` en `localStorage`).
 */

export interface EscenaEnCurso {
  id: EscenaId;
  /** `performance.now()` del inicio. */
  desde: number;
}

export type ComoTermino = 'fin' | 'saltada';

export const escena = signal<EscenaEnCurso | null>(null);
export const escenaTerminada = signal<{ id: EscenaId; como: ComoTermino } | null>(null);

/** Lo mínimo de `localStorage` que se usa. */
export interface AlmacenEscenas {
  getItem(clave: string): string | null;
}

const ahora = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());

/** Si las pruebas e2e apagaron las escenas. Sin almacén (pestaña privada), no. */
export function sinEscenas(almacen: AlmacenEscenas | null): boolean {
  if (!almacen) return false;
  try {
    return escenasApagadas(almacen.getItem(CLAVE_SIN_ESCENAS));
  } catch {
    return false;
  }
}

/** Empieza una escena. Si ya hay una, no hace nada. */
export function iniciarEscena(id: EscenaId): void {
  if (!esEscena(id) || escena.peek()) return;
  escenaTerminada.value = null;
  escena.value = { id, desde: ahora() };
}

/** La escena terminó sola (`fin`) o el jugador la saltó. */
export function terminarEscena(como: ComoTermino): void {
  const actual = escena.peek();
  if (!actual) return;
  escena.value = null;
  escenaTerminada.value = { id: actual.id, como };
}

/** Al salir al menú: sin escena y sin la última terminada. */
export function reiniciarEscena(): void {
  escena.value = null;
  escenaTerminada.value = null;
}

/**
 * Al llegar a un final con escena (el legado, justo a tiempo o tiempo cumplido), la escena
 * empieza sola. Vale para el modo individual y el cooperativo: mira los signals de la partida,
 * no quién los escribió. Cada jugador ve la suya.
 */
export function seguirFinales(almacen: AlmacenEscenas | null): () => void {
  let anterior: string | null = null;
  return effect(() => {
    const id = fase.value === 'final' ? final.value : null;
    if (id === anterior) return;
    anterior = id;
    if (id && esEscena(id) && !sinEscenas(almacen)) iniciarEscena(id);
  });
}
