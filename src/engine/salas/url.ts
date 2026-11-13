import { LUGARES } from '../../content/esquema-salas';
import type { Lugar } from '../../content/esquema-salas';

/**
 * `/jugar?sala=s3-gimnasio`: el motor dibuja esa sala al empezar, para revisar cada sala en
 * el celular sin recorrer el juego. No cambia el estado de la partida: en cuanto la lógica
 * del juego cambia de sala, manda ella.
 *
 * El parámetro viene de la URL: solo se acepta un id exacto de la lista de lugares.
 */
export function salaDeLaUrl(busqueda: string): Lugar | null {
  const valor = new URLSearchParams(busqueda).get('sala');
  return LUGARES.find((l) => l === valor) ?? null;
}
