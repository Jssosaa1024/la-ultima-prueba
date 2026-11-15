/**
 * Ambiente de cada sala, generado por código (T43) mientras llegan los ambientes grabados:
 * un rumor grave (ruido filtrado) y un zumbido eléctrico suave, distintos en cada lugar. Al
 * cambiar de sala, el anterior se apaga y el nuevo sube en un segundo.
 */
import type { Lugar } from '../../content/esquema-salas';
import type { ContextoSintesis } from './sintesis';
import { azar } from './sintesis';

export interface Fondo {
  /** Corte del filtro del rumor, en Hz: más bajo, más sordo. */
  rumor: number;
  /** Frecuencia del zumbido (tubos fluorescentes, máquinas), en Hz. */
  zumbido: number;
  /** Volumen del zumbido frente al rumor. */
  nivelZumbido: number;
}

/** Cómo suena cada lugar. */
export const FONDOS: Record<Lugar, Fondo> = {
  // Pasillo vacío de noche.
  porteria: { rumor: 300, zumbido: 60, nivelZumbido: 0.25 },
  // Neveras de la cooperativa.
  's1-cooperativa': { rumor: 450, zumbido: 120, nivelZumbido: 0.35 },
  // Bombas y tubos del laboratorio.
  's2-laboratorio': { rumor: 700, zumbido: 100, nivelZumbido: 0.3 },
  // Gimnasio grande: rumor con eco y casi sin zumbido.
  's3-gimnasio': { rumor: 220, zumbido: 50, nivelZumbido: 0.1 },
  // Biblioteca: casi silencio.
  's4-biblioteca': { rumor: 250, zumbido: 60, nivelZumbido: 0.08 },
  // Rectoría: el reloj de pared y un zumbido de oficina.
  's5-rectoria': { rumor: 350, zumbido: 120, nivelZumbido: 0.15 },
};

const FUNDIDO_S = 1;

export interface Ambiente {
  /** Cambia al fondo de ese lugar, o calla con `null` (menú y finales). */
  cambiar(lugar: Lugar | null): void;
  readonly lugar: Lugar | null;
  detener(): void;
}

interface Sonando {
  salida: GainNode;
  fuentes: AudioScheduledSourceNode[];
}

/** Dos segundos de ruido marrón (más grave que el blanco), que se repiten sin costura. */
function ruidoMarron(contexto: ContextoSintesis): AudioBuffer {
  const largo = contexto.sampleRate * 2;
  const buffer = contexto.createBuffer(1, largo, contexto.sampleRate);
  const datos = buffer.getChannelData(0);
  const r = azar(5);
  let ultimo = 0;
  for (let i = 0; i < largo; i++) {
    ultimo = (ultimo + 0.02 * (r() * 2 - 1)) / 1.02;
    datos[i] = ultimo * 3.5;
  }
  return buffer;
}

export function crearAmbiente(contexto: ContextoSintesis, destino: AudioNode): Ambiente {
  let actual: Sonando | null = null;
  let lugar: Lugar | null = null;
  let buffer: AudioBuffer | null = null;

  const apagar = (s: Sonando): void => {
    const t = contexto.currentTime;
    s.salida.gain.cancelScheduledValues(t);
    s.salida.gain.setTargetAtTime(0, t, FUNDIDO_S / 4);
    for (const f of s.fuentes) f.stop(t + FUNDIDO_S * 1.5);
    const ultima = s.fuentes[0];
    if (ultima) ultima.onended = () => s.salida.disconnect();
  };

  const encender = (fondo: Fondo): Sonando => {
    const t = contexto.currentTime;
    const salida = contexto.createGain();
    salida.gain.setValueAtTime(0, t);
    salida.gain.setTargetAtTime(1, t, FUNDIDO_S / 4);
    salida.connect(destino);

    buffer ??= ruidoMarron(contexto);
    const rumor = contexto.createBufferSource();
    rumor.buffer = buffer;
    rumor.loop = true;
    const filtro = contexto.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = fondo.rumor;
    rumor.connect(filtro).connect(salida);

    const zumbido = contexto.createOscillator();
    zumbido.frequency.value = fondo.zumbido;
    const nivel = contexto.createGain();
    nivel.gain.value = fondo.nivelZumbido * 0.2;
    zumbido.connect(nivel).connect(salida);

    rumor.start(t);
    zumbido.start(t);
    return { salida, fuentes: [rumor, zumbido] };
  };

  return {
    cambiar(nuevo) {
      if (nuevo === lugar) return;
      lugar = nuevo;
      if (actual) apagar(actual);
      actual = nuevo ? encender(FONDOS[nuevo]) : null;
    },
    get lugar() {
      return lugar;
    },
    detener() {
      if (actual) apagar(actual);
      actual = null;
      lugar = null;
    },
  };
}
