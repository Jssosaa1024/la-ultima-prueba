/**
 * Mezcla del audio (T43): tres canales con su volumen (voz, ambiente y efectos) que entran a
 * un volumen general. Mientras suena la voz, el ambiente baja un poco para que se entienda.
 */
import type { Ajustes } from '../../signals/ajustes';

/** Volúmenes de 0 a 1. `general` multiplica a los otros tres. */
export interface Volumenes {
  general: number;
  /** La Voz y las grabaciones. */
  voz: number;
  /** El fondo de cada sala, en bucle. */
  ambiente: number;
  /** Máquinas, sellos, puertas y objetos. */
  efectos: number;
}

/**
 * El ambiente al 100 % de los ajustes suena a la mitad de la voz: así ella siempre se
 * entiende. Con el 70 % inicial queda en 0,35.
 */
export const TECHO_AMBIENTE = 0.5;
/**
 * Los efectos al 100 % de los ajustes (T42c) suenan un poco por debajo de la voz, como antes
 * de tener su propio ajuste.
 */
export const TECHO_EFECTOS = 0.7;

/** Los volúmenes de la mezcla según los ajustes del jugador (T39 y T42c, de 0 a 100). */
export function volumenesDeAjustes(
  a: Pick<Ajustes, 'volumenVoz' | 'volumenAmbiente' | 'volumenEfectos'>,
): Volumenes {
  return {
    general: 1,
    voz: a.volumenVoz / 100,
    ambiente: (a.volumenAmbiente / 100) * TECHO_AMBIENTE,
    efectos: (a.volumenEfectos / 100) * TECHO_EFECTOS,
  };
}

/** Cuánto baja el ambiente mientras habla La Voz (0,5 = a la mitad). */
export const AMBIENTE_BAJO_LA_VOZ = 0.5;
/** Constante de tiempo de los cambios de volumen, en segundos: sin chasquidos. */
const SUAVIDAD_S = 0.08;

export interface Mezcla {
  readonly voz: GainNode;
  readonly ambiente: GainNode;
  readonly efectos: GainNode;
  /** Pone los volúmenes (de 0 a 1). */
  aplicar(v: Readonly<Volumenes>): void;
  /** La Voz empieza o termina de hablar: el ambiente baja o vuelve. */
  hablando(si: boolean): void;
  desconectar(): void;
}

/** Lo mínimo del `AudioContext` que usa la mezcla. */
export interface ContextoMezcla {
  readonly currentTime: number;
  readonly destination: AudioNode;
  createGain(): GainNode;
}

const limitar = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Volumen final de cada canal: el suyo por el general, y el ambiente más bajo si hay voz. */
export function niveles(
  v: Readonly<Volumenes>,
  conVoz: boolean,
): { voz: number; ambiente: number; efectos: number } {
  const g = limitar(v.general);
  return {
    voz: g * limitar(v.voz),
    ambiente: g * limitar(v.ambiente) * (conVoz ? AMBIENTE_BAJO_LA_VOZ : 1),
    efectos: g * limitar(v.efectos),
  };
}

export function crearMezcla(contexto: ContextoMezcla, inicial: Readonly<Volumenes>): Mezcla {
  const canal = (): GainNode => {
    const g = contexto.createGain();
    g.connect(contexto.destination);
    return g;
  };
  const voz = canal();
  const ambiente = canal();
  const efectos = canal();
  let volumenes = inicial;
  let conVoz = false;

  const poner = (nodo: GainNode, valor: number): void => {
    nodo.gain.setTargetAtTime(valor, contexto.currentTime, SUAVIDAD_S);
  };
  const actualizar = (): void => {
    const n = niveles(volumenes, conVoz);
    poner(voz, n.voz);
    poner(ambiente, n.ambiente);
    poner(efectos, n.efectos);
  };
  // El primer valor va directo: no hay nada sonando que suavizar.
  const n = niveles(inicial, false);
  voz.gain.value = n.voz;
  ambiente.gain.value = n.ambiente;
  efectos.gain.value = n.efectos;

  return {
    voz,
    ambiente,
    efectos,
    aplicar(v) {
      volumenes = v;
      actualizar();
    },
    hablando(si) {
      if (si === conVoz) return;
      conVoz = si;
      actualizar();
    },
    desconectar() {
      voz.disconnect();
      ambiente.disconnect();
      efectos.disconnect();
    },
  };
}
