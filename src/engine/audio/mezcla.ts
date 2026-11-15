/**
 * Mezcla del audio (T43): tres canales con su volumen (voz, ambiente y efectos) que entran a
 * un volumen general. Mientras suena la voz, el ambiente baja un poco para que se entienda.
 */
import type { Volumenes } from '../../signals/audio';

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
