import type { FinalId, GrabacionId, Lugar, OpcionFinal } from '../partida';
import type { Reparto } from '../reparto';
import type { Apariencia, Eleccion } from './apariencia';

/**
 * Contenido de los mensajes del modo cooperativo (especificación, sección 3).
 *
 * Aquí solo hay tipos y listas cerradas: la lógica del anfitrión (`anfitrion.ts`) y la
 * validación de lo que llega por la red (`src/net/protocolo.ts`) los comparten. `game/` no
 * sabe nada del sobre ni del transporte.
 *
 * Los mensajes llevan ids y números, nunca texto libre: cada cliente ya tiene el contenido.
 * Por eso las notas del cuaderno NO viajan (sin chat libre entre menores): se comparten solo
 * los datos encontrados (`revelado`) y las pistas (`pista`).
 */

/** Asuntos que se votan por unanimidad. */
export const ASUNTOS = ['pausa', 'reanudar', 'sala', 'final', 'ayuda'] as const;
export type Asunto = (typeof ASUNTOS)[number];

/** Opción de un voto: a qué lugar ir (`sala`) o qué final elegir (`final`). */
export type OpcionVoto = Lugar | OpcionFinal;

/** Por qué el anfitrión no deja entrar a alguien. */
export const MOTIVOS_RECHAZO = ['llena', 'version', 'empezada'] as const;
export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number];

/** Estado discreto de un mecanismo: la forma de `solucion` de la etapa (números e ids). */
export type EstadoMecanismo = unknown;

/** Intenciones: jugador → anfitrión (evento Broadcast `int`). */
export type Intencion =
  | { t: 'listo'; p: { listo: boolean } }
  | { t: 'recoger'; p: { objeto: string } }
  | { t: 'pasar'; p: { objeto: string; a: string } }
  /**
   * Usar un objeto de la sala. Con `herramienta` (por ejemplo, la linterna sobre la pizarra)
   * revela un dato; sin herramienta (`null`) examina un dato o abre un escondite.
   */
  | { t: 'usar'; p: { herramienta: string | null; objetivo: string } }
  | { t: 'proponer'; p: { puzzle: string; etapa: number; estado: EstadoMecanismo } }
  | { t: 'confirmar'; p: { propuesta: number; acepta: boolean } }
  | { t: 'pedir_pista'; p: { puzzle: string } }
  /** `acepta: false` retira el voto propio. `opcion` solo en `sala` y `final`. */
  | { t: 'votar'; p: { asunto: Asunto; opcion: OpcionVoto | null; acepta: boolean } }
  | { t: 'pedir_estado'; p: { desde_n: number } }
  /** Sala de espera (T81b): pedir otro alias y color. El anfitrión atiende por orden de llegada. */
  | { t: 'elegir'; p: Eleccion };

export type TipoIntencion = Intencion['t'];
export const TIPOS_INTENCION = [
  'listo',
  'recoger',
  'pasar',
  'usar',
  'proponer',
  'confirmar',
  'pedir_pista',
  'votar',
  'pedir_estado',
  'elegir',
] as const satisfies readonly TipoIntencion[];

/** Dónde está un objeto que se movió de su lugar inicial. */
export interface UbicacionObjeto {
  objeto: string;
  /** Jugador que lo lleva, o null si está en el piso de `sala`. */
  portador: string | null;
  sala: Lugar;
}

/** Propuesta abierta, con los votos que lleva. */
export interface PropuestaAbierta {
  id: number;
  puzzle: string;
  etapa: number;
  por: string;
  estado: EstadoMecanismo;
  votos: { jugador: string; acepta: boolean }[];
}

/** Pistas de un puzzle: lo mismo que `EstadoPistas` de `pistas.ts`. */
export interface PistasFoto {
  ofrecidas: number;
  vistas: number;
  ms: number;
  intentos: number;
}

/** Voto abierto de un asunto. */
export interface VotoAbierto {
  asunto: Asunto;
  opcion: OpcionVoto | null;
  votos: string[];
}

/** Foto completa de la partida (evento `estado`): con ella un cliente se pone al día. */
export interface Foto {
  fase: 'espera' | 'jugando' | 'final';
  anfitrion: string;
  /** Jugadores en el orden en que se unieron; queda fijo al empezar (T29). */
  orden: string[];
  listos: string[];
  lugar: Lugar;
  /** Etapas resueltas por sala (5 números de 0 a 3). */
  etapas: number[];
  grabaciones: GrabacionId[];
  final: FinalId | null;
  reloj: { restante_ms: number; pausado: boolean };
  objetos: UbicacionObjeto[];
  /** Datos encontrados: ids de objetos examinados o revelados, para el cuaderno de todos. */
  revelados: string[];
  propuesta: PropuestaAbierta | null;
  /** Pistas por sala (5). */
  pistas: PistasFoto[];
  votos: VotoAbierto[];
  /** Jugadores fuera de Presence y cuántos ms llevan fuera. */
  ausentes: { jugador: string; ms: number }[];
  /** Alias y color que el anfitrión aceptó a cada jugador (T81b): nunca dos iguales. */
  apariencias: Apariencia[];
}

/** Eventos: anfitrión → todos (evento Broadcast `evt`), numerados con `n`. */
export type Evento =
  | { t: 'estado'; p: Foto }
  | { t: 'inicio'; p: { orden: string[]; restante_ms: number } }
  | { t: 'roles'; p: { sala: number } & Reparto }
  | { t: 'objeto'; p: UbicacionObjeto }
  | { t: 'revelado'; p: { objeto: string; por: string } }
  | {
      t: 'propuesta';
      p: { id: number; puzzle: string; etapa: number; por: string; estado: EstadoMecanismo };
    }
  | { t: 'confirmacion'; p: { propuesta: number; jugador: string; acepta: boolean } }
  | {
      t: 'resultado';
      p: {
        puzzle: string;
        etapa: number;
        condiciones: Record<string, boolean>;
        resuelta: boolean;
        sello: boolean;
      };
    }
  | { t: 'pista'; p: { puzzle: string; nivel: number } }
  | {
      t: 'voto';
      p: { asunto: Asunto; opcion: OpcionVoto | null; votos: string[]; resuelto: boolean };
    }
  | { t: 'reloj'; p: { restante_ms: number; pausado: boolean } }
  | { t: 'grabacion'; p: { fragmento: GrabacionId; por: string } }
  | { t: 'final'; p: { final: FinalId } }
  | { t: 'anfitrion'; p: { jugador: string } }
  | { t: 'rechazo'; p: { a: string; motivo: MotivoRechazo } };

export type TipoEvento = Evento['t'];
export const TIPOS_EVENTO = [
  'estado',
  'inicio',
  'roles',
  'objeto',
  'revelado',
  'propuesta',
  'confirmacion',
  'resultado',
  'pista',
  'voto',
  'reloj',
  'grabacion',
  'final',
  'anfitrion',
  'rechazo',
] as const satisfies readonly TipoEvento[];

/** Directos: jugador → todos, sin autoridad (evento Broadcast `dir`). */
export type Directo =
  /** Posición en cm enteros y giro en centésimas de grado. */
  | { t: 'pose'; p: { s: number; x: number; y: number; z: number; yaw: number } }
  /** Señal en un punto, con una frase rápida predefinida opcional (por id). */
  | { t: 'senal'; p: { s: number; x: number; y: number; z: number; frase: string | null } };

export type TipoDirecto = Directo['t'];
export const TIPOS_DIRECTO = ['pose', 'senal'] as const satisfies readonly TipoDirecto[];

/** Frases rápidas de `senal` (T91). Viaja el id; el texto lo pone cada cliente. */
export const FRASES = ['aqui', 'mira', 'ven', 'listo', 'espera', 'no_se'] as const;
