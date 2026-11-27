import type { Mecanismo } from '../../content/esquema';

/** Textos del marco de los paneles de mecanismo (T37). */

/** Lo que dice el botón que confirma la etapa en cada máquina. */
export const TEXTO_ACCIONAR: Readonly<Record<Mecanismo, string>> = {
  etiquetadora: 'Bajar la palanca',
  tanques: 'Bajar la palanca',
  reflector: 'Soltar la polea',
  // Los carritos responden en vivo en sus tres etapas; el texto queda por si eso cambia.
  carritos: 'Accionar',
  urna: 'Tirar de la manija',
};

/** «Sala 1 · Etapa 2 de 3». */
export function textoEtapa(sala: number, numero: number, total: number): string {
  return `Sala ${sala} · Etapa ${numero + 1} de ${total}`;
}

/** Aviso de las máquinas que responden en vivo, sin nada que accionar. */
export function textoReposo(segundos: number): string {
  return `Responde sola: déjala quieta ${segundos} segundos y revisa lo que hay.`;
}

/**
 * Lo que el marco dice al resolver una etapa. Con sello, depende de si era la última sala, y
 * avisa que llegó una prueba del caso de 1991 al cuaderno (`docs/historia.md`).
 */
export function textoResuelta(sello: boolean, sala: number, salas: number): string {
  if (!sello) return 'La máquina aceptó los ajustes. Ahora pide algo distinto.';
  const prueba = `Con él llega la prueba ${sala} del caso de 1991: está en tu cuaderno.`;
  if (sala === salas) {
    return `Conseguiste el último sello. La puerta de salida de la portería ya puede abrirse. ${prueba}`;
  }
  return `Conseguiste el sello de esta sala. En la portería ya se abre la puerta ${sala + 1}. ${prueba}`;
}

/**
 * Sala 2 (corrección del 25 de noviembre): cada etapa tiene su estación. Al resolver una sin
 * ganar el sello, la siguiente se enciende y hay que ir hasta ella.
 */
export function textoEstacionResuelta(numero: number): string {
  return `La estación ${numero + 1} quedó resuelta. Ahora se encendió la estación ${numero + 2}: ve hasta ella.`;
}

export const TEXTO_TERMINADA =
  'Esta máquina ya quedó resuelta: su sello está en el mural de la portería.';
