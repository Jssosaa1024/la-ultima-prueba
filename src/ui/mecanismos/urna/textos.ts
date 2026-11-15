import type { EstadoDe, ExitoDe } from '../../../content/esquema';
import { parejas } from '../../../game/puzzles';
import type { ResultadoSimulacion } from './simulador';

/**
 * Textos del panel de la urna (T70). Puros, para probarlos. La máquina nunca dice
 * «incorrecto»: cuenta lo que hizo con las fichas que había.
 */

type Estado = EstadoDe<'urna'>;
type Exito = ExitoDe<'urna'>;

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

/** «3 fichas azules y 1 amarilla», o «La urna está vacía». */
export function textoUrna(estado: Estado): string {
  const { azules, amarillas } = estado;
  if (azules + amarillas === 0) return 'La urna está vacía.';
  const partes: string[] = [];
  if (azules > 0) partes.push(plural(azules, 'ficha azul', 'fichas azules'));
  if (amarillas > 0) partes.push(plural(amarillas, 'ficha amarilla', 'fichas amarillas'));
  return `En la urna hay ${partes.join(' y ')}.`;
}

/** Lo que dice el simulador después de sus 100 extracciones. */
export function textoSimulacion(r: ResultadoSimulacion | null): string {
  if (!r) return 'Con menos de dos fichas, la mano no puede sacar una pareja.';
  return `De ${r.veces} veces, ${r.iguales} salieron del mismo color (ganas tú) y ${r.distintas} de distinto color (gana La Voz).`;
}

/**
 * Lo que pasó al tirar de la manija de la caja fuerte, con las fichas que había en la urna.
 * Varias frases: cuántas fichas contó, las parejas que revisó y qué hizo la caja.
 */
export function textoRespuesta(estado: Estado, exito: Exito, resuelta: boolean): string[] {
  const total = estado.azules + estado.amarillas;
  const { iguales, distintas } = parejas(estado.azules, estado.amarillas);
  const frases = [
    `La caja fuerte contó ${plural(total, 'ficha', 'fichas')} en la urna. La placa pide ${exito.fichas}.`,
  ];
  if (total < 2) {
    frases.push('Con menos de dos fichas no hay pareja que sacar. La caja no se movió.');
    return frases;
  }
  frases.push(
    `Revisó todas las parejas: ${iguales} del mismo color y ${distintas} de distinto color.`,
  );
  if (resuelta) {
    frases.push('Sonó un clic y la caja fuerte se abrió.');
    return frases;
  }
  if (total !== exito.fichas) {
    frases.push('No es la cantidad de fichas de la placa. La caja siguió cerrada.');
  } else if (exito.juego === 'siempre_gana') {
    frases.push('Con esta urna, a veces gana La Voz. La caja siguió cerrada.');
  } else if (iguales > distintas) {
    frases.push('Con esta urna ganas tú más veces que La Voz. La caja siguió cerrada.');
  } else {
    frases.push('Con esta urna, La Voz gana más veces que tú. La caja siguió cerrada.');
  }
  return frases;
}
