/** Textos de las grabaciones en el panel y en el cuaderno (T75). Puros: se prueban sin navegador. */

export const TOTAL_GRABACIONES = 3;

/** «Grabación 2 de 3». */
export function tituloGrabacion(numero: number): string {
  return `Grabación ${numero} de ${TOTAL_GRABACIONES}`;
}

/** Cuántas lleva el jugador y qué falta: lo que se dice al recoger una. */
export function textoAvance(recogidas: number): string {
  if (recogidas >= TOTAL_GRABACIONES) {
    return 'Ya tienes las tres grabaciones. Con los cinco sellos, en la puerta de salida podrás restaurar el archivo.';
  }
  const faltan = TOTAL_GRABACIONES - recogidas;
  return `Llevas ${recogidas} de ${TOTAL_GRABACIONES} grabaciones. ${
    faltan === 1 ? 'Falta una' : `Faltan ${faltan}`
  }, en otras salas.`;
}
