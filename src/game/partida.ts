/**
 * Máquina de estados de la partida (T24): portería, salas y final.
 *
 * Reglas puras, sin DOM, sin Three y sin red. La usan igual el modo individual y el
 * anfitrión del cooperativo. `aplicar()` nunca modifica el estado que recibe: devuelve uno
 * nuevo, o el MISMO objeto si la acción no está permitida (así se sabe que no pasó nada).
 */

/** Las cinco salas, en el orden en que se abren. Los ids coinciden con `signals/partida.ts`. */
export const SALAS = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;
export type SalaId = (typeof SALAS)[number];

/** Dónde está el jugador (o el grupo): la portería o una sala. */
export type Lugar = 'porteria' | SalaId;

/** Cada sala tiene un puzzle de tres etapas: presentar, torcer y dominar. */
export const ETAPAS_POR_SALA = 3;

/** Los cuatro finales del diseño. */
export const FINALES = ['justo_a_tiempo', 'el_legado', 'pedir_ayuda', 'tiempo_cumplido'] as const;
export type FinalId = (typeof FINALES)[number];

/** Las tres grabaciones opcionales; los ids coinciden con `signals/partida.ts`. */
export const GRABACIONES = ['grab-1', 'grab-2', 'grab-3'] as const;
export type GrabacionId = (typeof GRABACIONES)[number];

/** Dónde está escondida cada grabación (salas 2, 3 y 4). */
export const GRABACION_EN_SALA: Readonly<Record<GrabacionId, SalaId>> = {
  'grab-1': 's2-laboratorio',
  'grab-2': 's3-gimnasio',
  'grab-3': 's4-biblioteca',
};

/** Lo que se elige frente a la puerta de salida con los cinco sellos. */
export type OpcionFinal = 'salir' | 'restaurar';

export type FasePartida = 'jugando' | 'final';

export interface Partida {
  fase: FasePartida;
  lugar: Lugar;
  /** Etapas resueltas en cada sala, de 0 a 3. Con 3 la sala está resuelta. */
  etapas: Readonly<Record<SalaId, number>>;
  final: FinalId | null;
  /** Grabaciones recogidas, en el orden en que se encontraron. */
  grabaciones: readonly GrabacionId[];
}

export type Accion =
  /** Entrar desde la portería a una sala abierta. */
  | { t: 'entrar'; sala: SalaId }
  /** Salir de la sala actual a la portería. */
  | { t: 'volver_porteria' }
  /** El mecanismo de la sala cumplió la etapa (la decide `game/puzzles/`). */
  | { t: 'resolver_etapa'; sala: SalaId; etapa: number }
  /** Recoger una grabación estando en su sala. */
  | { t: 'recoger_grabacion'; grabacion: GrabacionId }
  /** En la portería, con los cinco sellos: salir o restaurar el archivo. */
  | { t: 'elegir_final'; opcion: OpcionFinal }
  /** Usar el intercomunicador y confirmar, en cualquier momento. */
  | { t: 'pedir_ayuda' }
  /** El reloj llegó a 00:40. */
  | { t: 'tiempo_agotado' };

/** Número de sala (1 a 5) de un id de sala. */
export const numeroDeSala = (sala: SalaId): number => SALAS.indexOf(sala) + 1;

/** Id de la sala por número (1 a 5). */
export const salaPorNumero = (n: number): SalaId | undefined => SALAS[n - 1];

export function crearPartida(): Partida {
  return {
    fase: 'jugando',
    lugar: 'porteria',
    etapas: {
      's1-cooperativa': 0,
      's2-laboratorio': 0,
      's3-gimnasio': 0,
      's4-biblioteca': 0,
      's5-rectoria': 0,
    },
    final: null,
    grabaciones: [],
  };
}

export const salaResuelta = (p: Partida, sala: SalaId): boolean =>
  p.etapas[sala] >= ETAPAS_POR_SALA;

/** Las salas se abren en orden: la 1 desde el principio y cada una al resolver la anterior. */
export function salaAbierta(p: Partida, sala: SalaId): boolean {
  const i = SALAS.indexOf(sala);
  const anterior = SALAS[i - 1];
  return anterior === undefined || salaResuelta(p, anterior);
}

/** Etapa que falta en la sala (0 = presentar, 1 = torcer, 2 = dominar) o null si ya se resolvió. */
export function etapaActual(p: Partida, sala: SalaId): number | null {
  return salaResuelta(p, sala) ? null : p.etapas[sala];
}

/** Salas resueltas, en el orden del recorrido. */
export const salasResueltas = (p: Partida): SalaId[] => SALAS.filter((s) => salaResuelta(p, s));

/** Sellos del mural: uno por sala resuelta, en el orden del recorrido. */
export const sellos = salasResueltas;

export const tieneCincoSellos = (p: Partida): boolean => sellos(p).length === SALAS.length;

export interface OpcionesDeFinal {
  /** «Salir»: hay cinco sellos y se está en la portería. */
  salir: boolean;
  /** «Restaurar archivo»: además, las tres grabaciones. */
  restaurar: boolean;
  faltanGrabaciones: number;
  /** Salas que aún esconden una grabación, para el mapa junto al botón desactivado. */
  salasConGrabacion: SalaId[];
}

/** Qué finales se pueden elegir ahora frente a la puerta de salida. */
export function opcionesDeFinal(p: Partida): OpcionesDeFinal {
  const salir = p.fase === 'jugando' && p.lugar === 'porteria' && tieneCincoSellos(p);
  const pendientes = GRABACIONES.filter((g) => !p.grabaciones.includes(g));
  return {
    salir,
    restaurar: salir && pendientes.length === 0,
    faltanGrabaciones: pendientes.length,
    salasConGrabacion: pendientes.map((g) => GRABACION_EN_SALA[g]),
  };
}

const terminar = (p: Partida, final: FinalId): Partida => ({ ...p, fase: 'final', final });

export function aplicar(p: Partida, a: Accion): Partida {
  if (p.fase !== 'jugando') return p;
  switch (a.t) {
    case 'entrar':
      if (p.lugar !== 'porteria' || !SALAS.includes(a.sala) || !salaAbierta(p, a.sala)) return p;
      return { ...p, lugar: a.sala };
    case 'volver_porteria':
      if (p.lugar === 'porteria') return p;
      return { ...p, lugar: 'porteria' };
    case 'resolver_etapa':
      // Solo la etapa que sigue, y solo estando en esa sala.
      if (p.lugar !== a.sala || etapaActual(p, a.sala) !== a.etapa) return p;
      return { ...p, etapas: { ...p.etapas, [a.sala]: a.etapa + 1 } };
    case 'recoger_grabacion': {
      if (!GRABACIONES.includes(a.grabacion)) return p;
      if (p.lugar !== GRABACION_EN_SALA[a.grabacion] || p.grabaciones.includes(a.grabacion)) {
        return p;
      }
      return { ...p, grabaciones: [...p.grabaciones, a.grabacion] };
    }
    case 'elegir_final': {
      const opciones = opcionesDeFinal(p);
      if (a.opcion === 'salir' && opciones.salir) return terminar(p, 'justo_a_tiempo');
      if (a.opcion === 'restaurar' && opciones.restaurar) return terminar(p, 'el_legado');
      return p;
    }
    case 'pedir_ayuda':
      return terminar(p, 'pedir_ayuda');
    case 'tiempo_agotado':
      return terminar(p, 'tiempo_cumplido');
  }
}
