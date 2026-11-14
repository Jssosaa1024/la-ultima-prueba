import type { FinalId } from '../../signals/partida';

/**
 * Textos de los cuatro finales, los créditos con humor y la escena poscréditos, según
 * `docs/salas-y-puzzles.md` («Grabaciones y finales») y `docs/diseno.md` («Créditos con humor»). Cuando exista `src/content/finales/` (T21),
 * estos textos pasan allá.
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
      'A las 00:40, mientras cruzas la portería, el archivo de La Voz termina de borrarse.',
    ],
  },
  el_legado: {
    titulo: 'El legado',
    parrafos: [
      'Con los cinco sellos y las tres grabaciones, elegiste restaurar el archivo. La carpeta se copia a un pendrive que te llevas.',
      'La Voz se despide con su nombre: es el profe Tobías Rincón, que enseñó matemáticas 34 años en el colegio y dejó un mensaje para cada promoción. La puerta se abre.',
    ],
  },
  pedir_ayuda: {
    titulo: 'También vale pedir ayuda',
    parrafos: [
      'Usaste el intercomunicador de emergencia. Don Efraín, el celador de la noche, llega con su llave y abre la puerta.',
      'Antes de que te vayas, te ofrece repasar las salas pendientes en modo práctica, sin reloj.',
    ],
  },
  tiempo_cumplido: {
    titulo: 'Tiempo cumplido',
    parrafos: [
      'El reloj de la portería marca las 00:40. Las cerraduras ceden y la puerta queda libre.',
      'Los acertijos que faltaron siguen disponibles en modo práctica, sin reloj.',
    ],
  },
};

export const CAMEOS: readonly string[] = [
  'La profe Marta, de geometría, revisó todos los ángulos de cámara.',
  'El profe Julián, de estadística, exige una muestra mayor de aplausos.',
  'La profe Inés, de español, corrigió los mensajes de La Voz.',
];

export const AGRADECIMIENTO =
  'Gracias a don Efraín, el celador, que tenía la llave desde el principio.';

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
