import type { Sala } from '../../src/content/esquema-salas';

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
