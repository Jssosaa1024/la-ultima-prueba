import type { GrabacionId, SalaId } from '../game/partida';

/**
 * Las tres grabaciones opcionales (T75), con los escondites y las transcripciones de
 * `docs/salas-y-puzzles.md` («Grabaciones y finales»). Juntas desbloquean el final «El legado».
 *
 * Cada una se recoge al usar el objeto que la esconde, estando en su sala. El texto queda en
 * el cuaderno. El audio llega después (Ola 3): por ahora solo se lee.
 */
export interface Grabacion {
  id: GrabacionId;
  /** 1, 2 o 3: el orden en que La Voz las numeró. */
  numero: number;
  sala: SalaId;
  /** Objeto de `salas.json` que la esconde. */
  objeto: string;
  /** Dónde estaba, para el panel y el cuaderno. */
  lugar: string;
  /** Lo que dice la grabación. */
  texto: string;
}

export const GRABACIONES_ESCONDIDAS: readonly Grabacion[] = [
  {
    id: 'grab-1',
    numero: 1,
    sala: 's2-laboratorio',
    objeto: 's2-gabinete',
    lugar: 'En el gabinete del laboratorio',
    texto:
      'Grabación uno. Soy Tobías Rincón. En 1991 fui el jurado más nuevo. Voté en contra y perdí. Guardé las pruebas por si alguien quería revisar.',
  },
  {
    id: 'grab-2',
    numero: 2,
    sala: 's3-gimnasio',
    objeto: 's3-balon-3',
    lugar: 'En el balón desinflado del carro del gimnasio',
    texto:
      'Grabación dos. Tenía quince años y un filtro de agua para su vereda. Después de la sanción no volvió. Yo tampoco fui el mismo profe.',
  },
  {
    id: 'grab-3',
    numero: 3,
    sala: 's4-biblioteca',
    objeto: 's4-cactus',
    lugar: 'En la maceta del cactus del estante M de la biblioteca',
    texto:
      'Grabación tres. Él nunca se fue del todo. Está más cerca de lo que crees. Si restauras el archivo, que él lo vea primero.',
  },
];

/** La grabación que esconde ese objeto, si esconde alguna. */
export function grabacionDeObjeto(objeto: string): Grabacion | null {
  return GRABACIONES_ESCONDIDAS.find((g) => g.objeto === objeto) ?? null;
}

export function grabacionPorId(id: string): Grabacion | null {
  return GRABACIONES_ESCONDIDAS.find((g) => g.id === id) ?? null;
}

/** La grabación escondida en ese lugar (las salas 2, 3 y 4 tienen una cada una). */
export function grabacionDeSala(lugar: string): Grabacion | null {
  return GRABACIONES_ESCONDIDAS.find((g) => g.sala === lugar) ?? null;
}

/**
 * Los balones del carro del gimnasio. Se tocan («Usar») y rebotan; el único que no rebota es
 * el que esconde la grabación 2. Ninguno es parte de la máquina de la sala.
 */
export const BALONES: readonly string[] = ['s3-balon-1', 's3-balon-2', 's3-balon-3', 's3-balon-4'];

/** La linterna de la portería: con ella en el inventario se ven las flechas del laboratorio. */
export const OBJETO_LINTERNA = 'porteria-linterna';

/**
 * Objetos que se usan dentro de una sala sin ser parte de su máquina: no abren el panel del
 * mecanismo. Son los escondites de las grabaciones y los balones.
 */
export function esObjetoSuelto(objeto: string): boolean {
  return BALONES.includes(objeto) || grabacionDeObjeto(objeto) !== null;
}
