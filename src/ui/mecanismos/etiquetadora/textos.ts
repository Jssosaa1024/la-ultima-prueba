/** Textos del panel de la etiquetadora (T45). Puros: se prueban sin navegador. */

/** Precio en pesos como se escribe en Colombia: `$1.600`. */
export function pesos(n: number): string {
  const digitos = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '−' : ''}$${digitos}`;
}

/** Un rodillo como está marcado en la caja: `−20 %`, `+25 %`. */
export function textoRodillo(p: number): string {
  return `${p < 0 ? '−' : '+'}${Math.abs(p)} %`;
}

/** «el jugo», «la empanada»: para decir de qué producto es la etiqueta. */
const PRODUCTOS: Readonly<Record<string, string>> = {
  jugo: 'del jugo',
  empanada: 'de la empanada',
  combo: 'del combo',
};

/** «Etiqueta del jugo». Un producto que no esté en la lista se nombra con su id. */
export function tituloEtiqueta(producto: string): string {
  return `Etiqueta ${PRODUCTOS[producto] ?? `de ${producto}`}`;
}

/** «sin rodillos», «con el rodillo −20 %», «con los rodillos −50 % y +50 %». */
export function textoRodillos(rodillos: readonly number[]): string {
  const [primero, ...resto] = rodillos.map(textoRodillo);
  if (primero === undefined) return 'sin rodillos';
  if (resto.length === 0) return `con el rodillo ${primero}`;
  const ultimo = resto.pop();
  return `con los rodillos ${[primero, ...resto].join(', ')} y ${ultimo}`;
}

/**
 * Lo que pasó al bajar la palanca, en una frase: de qué precio a qué precio y cuántos pesos
 * cambió. Nunca dice si estuvo bien o mal: el jugador compara con la pizarra.
 */
export function textoImpresion(
  antes: number,
  rodillos: readonly number[],
  impreso: number,
): string {
  const como = textoRodillos(rodillos);
  const inicio = como.charAt(0).toUpperCase() + como.slice(1);
  if (rodillos.length === 0) {
    return `${inicio}, la etiqueta salió con el mismo precio: ${pesos(impreso)}.`;
  }
  const cambio = impreso - antes;
  const paso = `la etiqueta pasó de ${pesos(antes)} a ${pesos(impreso)}`;
  if (cambio === 0) return `${inicio}, ${paso}: quedó igual.`;
  return `${inicio}, ${paso}: ${cambio > 0 ? 'subió' : 'bajó'} ${pesos(Math.abs(cambio))}.`;
}
