import type { Alcance, LecturaPoste } from '../../../game/puzzles';

/**
 * Textos del panel del reflector (T58). Puros: se prueban sin navegador.
 *
 * La máquina nunca dice «incorrecto»: cuenta lo que se ve. Cuánto mide cada sombra, dónde
 * cae su punta frente al sensor y hasta dónde llegó el gancho de la polea.
 */

/** Metros como se escriben en Colombia: «2 m», «1,5 m», «10,7 m». */
export function metros(n: number): string {
  const redondo = Math.round(n * 10) / 10;
  return `${Number.isInteger(redondo) ? String(redondo) : redondo.toFixed(1).replace('.', ',')} m`;
}

/** «Poste de 2 m». */
export const nombrePoste = (altura: number): string => `Poste de ${metros(altura)}`;

/** Lo que se ve de un poste con la luz actual. */
export function textoPoste(l: LecturaPoste): string {
  const base = `${nombrePoste(l.altura)}: su sombra mide ${metros(l.sombra)}.`;
  if (l.alcance === null || l.distancia === null) return base;
  const sensor = `del sensor, que está a ${metros(l.distancia)}`;
  switch (l.alcance) {
    case 'toca':
      return `${base} La punta toca el sensor y suena.`;
    case 'corta':
      return `${base} La punta se queda antes ${sensor}.`;
    case 'larga':
      return `${base} La punta pasa de largo ${sensor}.`;
  }
}

/** Dónde cae la sombra del marcador en la cinta métrica del piso. */
export function textoMarcador(sombra: number): string {
  return `Marcador: su sombra llega hasta los ${metros(sombra)} de la cinta del piso.`;
}

/** Lo que pasó al soltar la polea con esa longitud de cuerda. */
export function textoPolea(polea: number, alcance: Alcance): string {
  const subio = `Soltaste ${metros(polea)} de cuerda y el gancho subió ${metros(polea)}.`;
  switch (alcance) {
    case 'toca':
      return `${subio} Quedó justo en el marcador y lo enganchó: el sello baja.`;
    case 'corta':
      return `${subio} Quedó colgando por debajo del marcador, sin alcanzarlo.`;
    case 'larga':
      return `${subio} Pasó de largo junto al marcador y el contrapeso chocó con el piso.`;
  }
}

/** Nombre del sensor de un poste, para su indicador. */
export const nombreSensor = (altura: number): string => `Sensor del poste de ${metros(altura)}`;
