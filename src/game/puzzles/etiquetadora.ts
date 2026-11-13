import type { EstadoDe, EtapaDe } from '../../content/esquema';
import { esEntero, esObjeto, evaluacion, soloClaves, type Evaluacion } from './tipos';

/**
 * Sala 1 · La etiquetadora. Cada rodillo de p % multiplica el precio por (1 + p/100); dos
 * rodillos se multiplican, así que el orden no importa.
 */

type Etapa = EtapaDe<'etiquetadora'>;
type Estado = EstadoDe<'etiquetadora'>;

/** Precio impreso, exacto como fracción: precio × Π(100 + p) / 100^k. */
function fraccionImpresa(precio: number, rodillos: readonly number[]): [number, number] {
  let num = precio;
  let den = 1;
  for (const p of rodillos) {
    num *= 100 + p;
    den *= 100;
  }
  return [num, den];
}

/** Precio que imprime la máquina, redondeado al peso. */
export function precioImpreso(precio: number, rodillos: readonly number[]): number {
  const [num, den] = fraccionImpresa(precio, rodillos);
  return Math.round(num / den);
}

/** Condición `precio`: la etiqueta impresa es exactamente el precio de la pizarra. */
export function evaluarEtiquetadora(etapa: Etapa, estado: Estado): Evaluacion {
  const [num, den] = fraccionImpresa(estado.precio, estado.rodillos);
  return evaluacion({ precio: num === etapa.exito.precio * den });
}

/** Revisa un estado que llega de fuera: solo puede cambiar los rodillos, y con los de la caja. */
export function esEstadoEtiquetadora(etapa: Etapa, x: unknown): x is Estado {
  if (!esObjeto(x) || !soloClaves(x, ['producto', 'precio', 'rodillos'])) return false;
  const { rodillos, max_rodillos } = etapa.controles;
  const r = x['rodillos'];
  return (
    x['producto'] === etapa.estado_inicial.producto &&
    x['precio'] === etapa.estado_inicial.precio &&
    Array.isArray(r) &&
    r.length <= max_rodillos &&
    r.every((v) => esEntero(v) && rodillos.includes(v)) &&
    new Set(r).size === r.length
  );
}
