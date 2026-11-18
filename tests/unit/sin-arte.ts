import type { Lugar, Sala } from '../../src/content/esquema-salas';

/**
 * Salas con su arte final (T19h a T19o): modelos CC0, texturas, acabados y luz de medianoche.
 * Cada sala que recibe su arte se agrega aquí, y las pruebas de arte la revisan.
 */
export const CON_ARTE = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
] as const satisfies readonly Lugar[];

/** La sala sin los acabados por código (T19j): sin zócalo, lámparas, ventanas ni oclusión. */
export function sinAcabados(sala: Sala): Sala {
  const copia = { ...sala };
  delete copia.acabados;
  return copia;
}

/** La sala sin texturas de piso, paredes y techo, con sus modelos. */
export function sinTexturas(sala: Sala): Sala {
  const copia = { ...sala };
  delete copia.texturas;
  return copia;
}

/**
 * La sala como la arma el código, sin modelos ni texturas (T19h): desde que la portería y la
 * sala 1 tienen arte CC0, las pruebas que comparan «sin» y «con» parten de aquí.
 */
export function sinArte(sala: Sala): Sala {
  return {
    ...sinTexturas(sala),
    objetos: sala.objetos.map((o) => {
      const copia = { ...o };
      delete copia.modelo;
      return copia;
    }),
  };
}
