import { frasePuertaFalsa } from '../content/puertas-falsas';
import { avisar } from './interfaz';
import { decir } from './voz';

/**
 * Tocar una puerta falsa del pasillo (`docs/pasillos.md`): está cerrada, suena el picaporte y
 * sale su frase. Es lo mismo en la partida sola y en el cooperativo, y no pasa por la red: cada
 * jugador oye su propia puerta.
 *
 * Si la frase es una línea de La Voz, la dice la primera vez en la partida (`dichas` es el
 * registro de líneas ya dichas de quien llama) y el aviso no repite el texto, que ya va en el
 * subtítulo. Las veces siguientes la frase sale escrita en el aviso, sin voz.
 *
 * `frase` es el campo `falsa` del objeto, validado en el build; si no existe en
 * `puertas-falsas.json`, el aviso sale igual con una frase de respaldo.
 */
export function tocarPuertaFalsa(frase: string, dichas: Set<string>): void {
  const voz = frasePuertaFalsa(frase)?.voz;
  let hablada = false;
  if (voz && !dichas.has(voz) && decir(voz)) {
    dichas.add(voz);
    hablada = true;
  }
  avisar({ t: 'puerta_falsa', frase, hablada });
}
