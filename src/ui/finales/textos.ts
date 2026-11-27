import type { ResultadoSala } from '../../game/aprendizaje';
import type { FinalId } from '../../signals/partida';

/**
 * Textos de los cuatro finales, los créditos y la escena poscréditos. Los finales y los
 * créditos siguen el caso de Don Efraín (`docs/historia.md`); la escena poscréditos, el humor
 * de `docs/diseno.md`. Cuando exista `src/content/finales/` (T21), estos textos pasan allá.
 */

export interface TextoFinal {
  titulo: string;
  parrafos: readonly string[];
}

export const FINALES_TEXTO: Readonly<Record<FinalId, TextoFinal>> = {
  justo_a_tiempo: {
    titulo: 'Justo a tiempo',
    parrafos: [
      'Colocaste los cinco sellos y elegiste salir. El casillero de objetos perdidos se abre: ahí está tu memoria USB con el proyecto de la feria de ciencias.',
      'A las 00:40, mientras cruzas la portería, el archivo termina de borrarse. Don Efraín te abre la puerta sin decir nada.',
      'Antes de cerrar, se queda mirando la pantalla apagada y guarda en el bolsillo una foto vieja de una feria de ciencias.',
    ],
  },
  el_legado: {
    titulo: 'El legado',
    parrafos: [
      'Con los cinco sellos y las tres grabaciones, restauraste el archivo: las cinco pruebas y el expediente de 1991 se copian a un pendrive.',
      'La puerta se abre. Don Efraín, el celador, está ahí con su llave. En la pantalla aparece una foto de la feria de 1991: un filtro de agua y un cartel escrito a mano, «Efraín Cárdenas, 10-B».',
      'Don Efraín se quita la gorra y la mira un largo rato. «Ese era yo», dice. Después te abre la puerta: «Mañana llegue temprano a su feria. Yo le abro».',
    ],
  },
  pedir_ayuda: {
    titulo: 'También vale pedir ayuda',
    parrafos: [
      'Usaste el intercomunicador de emergencia. Don Efraín, el celador de la noche, llega con su llave y abre la puerta.',
      'Mira las máquinas encendidas y sonríe: «El profe Rincón y sus pruebas». Mientras caminan hacia la salida, te cuenta cómo funcionaba cada una, también las que faltaron.',
    ],
  },
  tiempo_cumplido: {
    titulo: 'Tiempo cumplido',
    parrafos: [
      'El reloj de la portería marca las 00:40. La pantalla se apaga: el archivo se borró. Las cerraduras ceden.',
      'Don Efraín abre la puerta en silencio. Se queda un momento mirando la pantalla oscura y guarda en el bolsillo una foto vieja de una feria de ciencias.',
      'Abajo está cómo funcionaba cada máquina, también las que no alcanzaste a resolver.',
    ],
  },
};

/** Un personaje del caso, con su papel, para los créditos. */
export interface PapelCaso {
  nombre: string;
  papel: string;
}

/**
 * Los créditos cuentan el caso (`docs/historia.md`): el expediente de 1991, cerrado en la
 * feria y reabierto si el jugador restauró el archivo. Ya es el final: aquí sí va el nombre
 * completo de Don Efraín.
 */
export const EXPEDIENTE_CREDITOS = {
  rotulo: 'Expediente 1991-14 · Feria de ciencias',
  apertura:
    'Abierto el 8 de noviembre de 1991 por «copia de proyecto». Cerrado el mismo día, en cuarenta minutos.',
  pruebas: 'Folios: un recibo, una bitácora, una foto, unas fichas de préstamo y un acta.',
  personajes: [
    {
      nombre: 'Efraín Cárdenas',
      papel: 'Estudiante de 10-B en 1991 y autor del filtro de agua. Hoy, celador de la noche.',
    },
    {
      nombre: 'Tobías Rincón',
      papel: 'El jurado más nuevo. Votó en contra, guardó las pruebas y les puso voz.',
    },
    {
      nombre: 'El jurado de la feria',
      papel: 'Cinco profes con prisa. Cuatro firmaron la sanción.',
    },
    {
      nombre: 'Tú',
      papel: 'Estudiante de grado 10. Revisaste el caso con calma, prueba por prueba.',
    },
  ] as readonly PapelCaso[],
  reabierto: 'Reabierto esta noche. Las cinco pruebas están en el pendrive.',
  cerrado: 'Sigue cerrado. Las pruebas se borraron a las 00:40.',
} as const;

/** El estado del expediente al final: solo «El legado» lo reabre. */
export function expedienteReabierto(id: FinalId): boolean {
  return id === 'el_legado';
}

export const AGRADECIMIENTO =
  'Gracias a Don Efraín, que tenía la llave desde el principio y abrió esta puerta cada noche durante treinta años.';

export const POSCREDITOS = {
  escena: 'En la sala de profesores, la fotocopiadora se enciende sola e imprime una hoja:',
  hoja: 'Pregunta 6: justifique dejar los documentos para última hora.',
};

/** Une nombres con comas y una «y» final: «El laboratorio, El gimnasio y La biblioteca». */
function enLista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** Lo que muestra la puerta de salida cuando el mural no está completo. */
export function textoSellosFaltantes(faltan: number): string {
  return faltan === 1 ? 'En el mural falta 1 sello.' : `En el mural faltan ${faltan} sellos.`;
}

/**
 * Lo que acompaña a «Restaurar archivo» mientras está desactivado: cuántas grabaciones
 * faltan y en qué salas queda alguna, sin decir dónde mirar.
 */
export function textoGrabacionesFaltantes(faltan: number, salas: readonly string[]): string {
  const cuantas = faltan === 1 ? 'Falta 1 grabación' : `Faltan ${faltan} grabaciones`;
  const donde = faltan === 1 ? 'Sigue escondida en' : 'Siguen escondidas en';
  return `${cuantas} para restaurar el archivo. ${donde}: ${enLista(salas)}.`;
}

/**
 * Lo que pregunta la puerta antes de «Salir» con grabaciones pendientes (hito 1, punto 2):
 * al salir, el archivo de La Voz se borra y ya no se puede restaurar.
 */
export function textoConfirmarSalida(faltan: number): string {
  const cuantas =
    faltan === 1 ? 'Todavía falta 1 grabación' : `Todavía faltan ${faltan} grabaciones`;
  return `${cuantas}. Si sales ahora, el archivo con las pruebas de 1991 se borra a las 00:40 y ya no podrás restaurarlo.`;
}

/** Cómo terminó una sala en el resumen de aprendizaje. */
export function textoResultadoSala(resultado: ResultadoSala, pistas: number): string {
  if (resultado === 'sin_resolver') return 'Sin resolver';
  if (resultado === 'sin_pistas') return 'Resuelta sin pistas';
  return pistas === 1 ? 'Resuelta con 1 pista' : `Resuelta con ${pistas} pistas`;
}

/** La frase de arriba del resumen: «Resolviste 4 de 5 salas, 2 sin pistas.» */
export function textoTotalAprendizaje(resueltas: number, sinPistas: number): string {
  const salas = resueltas === 1 ? '1 de 5 salas' : `${resueltas} de 5 salas`;
  if (resueltas === 0) return 'Esta vez no alcanzaste a resolver ninguna sala.';
  if (sinPistas === 0) return `Resolviste ${salas}.`;
  if (sinPistas === resueltas) {
    return resueltas === 1
      ? `Resolviste ${salas}, sin pistas.`
      : `Resolviste ${salas}, todas sin pistas.`;
  }
  return `Resolviste ${salas}, ${sinPistas} sin pistas.`;
}
