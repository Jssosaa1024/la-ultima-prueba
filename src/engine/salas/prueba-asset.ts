/**
 * Prueba de la taza (T10b): `/jugar?prueba=asset` pone sobre el escritorio de la portería una
 * taza con `modelo: 'taza'`, el GLB que `optimize-models` llevó de
 * `art/prueba-assets/originales/` a `public/assets/salas/porteria/`. Sirve para ver en el
 * celular un asset real recorriendo todo el camino: manifiesto, meshopt, KTX2 y el ajuste a
 * `tam`. Sin el parámetro, la portería queda igual.
 *
 * El parámetro viene de la URL: solo vale el texto exacto `asset`.
 */
import type { ObjetoSala, Sala } from '../../content/esquema-salas';

export const ID_TAZA = 'porteria-taza-prueba';
export const MODELO_TAZA = 'taza';
const ESCRITORIO = 'porteria-escritorio';

export function esPruebaAsset(busqueda: string): boolean {
  return new URLSearchParams(busqueda).get('prueba') === 'asset';
}

/** La portería con la taza encima del escritorio; las demás salas, sin cambios. */
export function conTazaDePrueba(sala: Sala): Sala {
  const escritorio = sala.objetos.find((o) => o.id === ESCRITORIO);
  if (sala.id !== 'porteria' || !escritorio) return sala;
  const [x, y, z] = escritorio.pos;
  const taza: ObjetoSala = {
    id: ID_TAZA,
    forma: 'cilindro',
    // Unos 12 cm de alto con el asa: el modelo se ajusta a esta caja sin deformarse.
    tam: [0.12, 0.1, 0],
    pos: [x - 0.3, y + escritorio.tam[1], z],
    color: '#eeeae2',
    modelo: MODELO_TAZA,
  };
  return { ...sala, objetos: [...sala.objetos, taza] };
}
