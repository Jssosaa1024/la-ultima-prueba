import { estacionDeObjeto } from '../content/estaciones';

/**
 * Una máquina por etapa en la sala 2 (corrección del 25 de noviembre): cada estación responde
 * solo en su etapa. Si el jugador usa una pieza de otra estación, no se abre el panel y se le
 * dice por qué.
 */
export interface EstacionAjena {
  /** Número de la estación que se tocó (1 a 3). */
  estacion: number;
  /** Ya se resolvió (si no, todavía está apagada). */
  resuelta: boolean;
  /** Número de la estación encendida, o `null` si la sala ya está resuelta. */
  encendida: number | null;
}

/**
 * Si `objeto` es de una estación que no es la de la etapa pendiente, cuál es y en qué estado
 * está. `etapa` es la etapa pendiente de la sala (`null`: la sala ya está resuelta). Las piezas
 * que no son de ninguna estación, y las de la estación encendida, dan `null`.
 */
export function estacionAjena(objeto: string, etapa: number | null): EstacionAjena | null {
  const e = estacionDeObjeto(objeto);
  if (!e || e.etapa === etapa) return null;
  return {
    estacion: e.etapa + 1,
    resuelta: etapa === null || e.etapa < etapa,
    encendida: etapa === null ? null : etapa + 1,
  };
}
