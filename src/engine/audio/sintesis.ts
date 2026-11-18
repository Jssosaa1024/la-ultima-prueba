/**
 * Sonidos generados por código con Web Audio (T43): los efectos de las máquinas y de la
 * rectoría, y una voz provisional mientras llega la voz real de La Voz. No pesan nada, no
 * tienen licencia que registrar y se arman en el momento con osciladores y ruido.
 *
 * Cada efecto recibe el contexto, el canal de destino y el instante de inicio, y devuelve
 * cuánto dura en segundos. Todos los nodos se desconectan solos al terminar.
 */

/** Lo mínimo del `AudioContext` que usan los efectos (en los tests, uno falso). */
export interface ContextoSintesis {
  readonly currentTime: number;
  readonly sampleRate: number;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBiquadFilter(): BiquadFilterNode;
  createBufferSource(): AudioBufferSourceNode;
  createBuffer(canales: number, largo: number, frecuencia: number): AudioBuffer;
}

export type Efecto = (contexto: ContextoSintesis, destino: AudioNode, t: number) => number;

/** Un número entre 0 y 1 que siempre sale igual para la misma semilla (sin `Math.random`). */
export function azar(semilla: number): () => number {
  let s = semilla >>> 0 || 1;
  return () => {
    // xorshift32: suficiente para variar el tono de una sílaba.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

const ruidos = new WeakMap<ContextoSintesis, AudioBuffer>();

/** Un segundo de ruido blanco, uno por contexto. */
function ruido(contexto: ContextoSintesis): AudioBuffer {
  let buffer = ruidos.get(contexto);
  if (!buffer) {
    buffer = contexto.createBuffer(1, contexto.sampleRate, contexto.sampleRate);
    const datos = buffer.getChannelData(0);
    const r = azar(7);
    for (let i = 0; i < datos.length; i++) datos[i] = r() * 2 - 1;
    ruidos.set(contexto, buffer);
  }
  return buffer;
}

/** Envolvente de un golpe: sube en `ataque` y cae de forma exponencial hasta `fin`. */
function envolvente(g: GainNode, t: number, pico: number, ataque: number, fin: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + fin);
}

/** Un tono con envolvente. */
function tono(
  contexto: ContextoSintesis,
  destino: AudioNode,
  t: number,
  o: { frecuencia: number; hasta?: number; tipo?: OscillatorType; pico: number; dura: number },
): void {
  const osc = contexto.createOscillator();
  const g = contexto.createGain();
  osc.type = o.tipo ?? 'sine';
  osc.frequency.setValueAtTime(o.frecuencia, t);
  if (o.hasta) osc.frequency.exponentialRampToValueAtTime(o.hasta, t + o.dura);
  envolvente(g, t, o.pico, 0.005, o.dura);
  osc.connect(g).connect(destino);
  osc.start(t);
  osc.stop(t + o.dura + 0.05);
  osc.onended = () => g.disconnect();
}

/** Un golpe de ruido filtrado (clic, tac, fichas). */
function chasquido(
  contexto: ContextoSintesis,
  destino: AudioNode,
  t: number,
  o: { frecuencia: number; q?: number; pico: number; dura: number },
): void {
  const fuente = contexto.createBufferSource();
  fuente.buffer = ruido(contexto);
  const filtro = contexto.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = o.frecuencia;
  filtro.Q.value = o.q ?? 4;
  const g = contexto.createGain();
  envolvente(g, t, o.pico, 0.002, o.dura);
  fuente.connect(filtro).connect(g).connect(destino);
  fuente.start(t, Math.random() * 0.5);
  fuente.stop(t + o.dura + 0.05);
  fuente.onended = () => g.disconnect();
}

/** Clic suave de un botón o un control que encaja. */
export const clic: Efecto = (c, d, t) => {
  chasquido(c, d, t, { frecuencia: 2500, pico: 0.4, dura: 0.05 });
  return 0.05;
};

/** La palanca baja: un golpe grave y el tac del mecanismo. */
export const palanca: Efecto = (c, d, t) => {
  tono(c, d, t, { frecuencia: 140, hasta: 60, pico: 0.6, dura: 0.25 });
  chasquido(c, d, t + 0.02, { frecuencia: 900, q: 2, pico: 0.5, dura: 0.12 });
  return 0.3;
};

/** La campana de los tanques: parciales inarmónicos que se apagan despacio. */
export const campana: Efecto = (c, d, t) => {
  const base = 880;
  [1, 2.76, 5.4].forEach((k, i) => {
    tono(c, d, t, { frecuencia: base * k, pico: 0.3 / (i + 1), dura: 1.6 / (i + 1) });
  });
  return 1.6;
};

/** Una polea que suelta la cuerda: el roce que baja y el golpe al llegar. */
export const polea: Efecto = (c, d, t) => {
  tono(c, d, t, { frecuencia: 420, hasta: 180, tipo: 'sawtooth', pico: 0.08, dura: 0.5 });
  chasquido(c, d, t + 0.5, { frecuencia: 600, q: 1.5, pico: 0.5, dura: 0.15 });
  return 0.65;
};

/** Notas del sello: un arpegio que sube (do, mi, sol, do). */
export const NOTAS_SELLO = [523.25, 659.25, 783.99, 1046.5];

/** Se gana un sello. */
export const sello: Efecto = (c, d, t) => {
  NOTAS_SELLO.forEach((f, i) => {
    tono(c, d, t + i * 0.11, { frecuencia: f, tipo: 'triangle', pico: 0.35, dura: 0.7 });
  });
  return NOTAS_SELLO.length * 0.11 + 0.7;
};

// --- La rectoría (sala 5): la urna, la mano mecánica y la caja fuerte. -------------------

/** La manija de la urna: un trinquete de seis dientes. */
export const manija: Efecto = (c, d, t) => {
  for (let i = 0; i < 6; i++) {
    chasquido(c, d, t + i * 0.055, { frecuencia: 1800 - i * 120, q: 6, pico: 0.45, dura: 0.04 });
  }
  return 0.4;
};

/** Las fichas se revuelven dentro de la urna: golpecitos de plástico al azar. */
export const fichas: Efecto = (c, d, t) => {
  const r = azar(11);
  let u = t;
  for (let i = 0; i < 10; i++) {
    u += 0.03 + r() * 0.07;
    chasquido(c, d, u, { frecuencia: 3000 + r() * 2000, q: 8, pico: 0.15 + r() * 0.2, dura: 0.03 });
  }
  return u - t + 0.05;
};

/** La mano mecánica baja y sube: un servo que zumba y cambia de tono. */
export const mano: Efecto = (c, d, t) => {
  const osc = c.createOscillator();
  const filtro = c.createBiquadFilter();
  const g = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.linearRampToValueAtTime(140, t + 0.5);
  osc.frequency.linearRampToValueAtTime(90, t + 1);
  filtro.type = 'lowpass';
  filtro.frequency.value = 700;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
  g.gain.setValueAtTime(0.12, t + 0.95);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
  osc.connect(filtro).connect(g).connect(d);
  osc.start(t);
  osc.stop(t + 1.1);
  osc.onended = () => g.disconnect();
  return 1.1;
};

/** La caja fuerte se abre: el cerrojo (dos tac) y la bisagra que chirría. */
export const cajaFuerte: Efecto = (c, d, t) => {
  chasquido(c, d, t, { frecuencia: 700, q: 3, pico: 0.6, dura: 0.08 });
  chasquido(c, d, t + 0.12, { frecuencia: 500, q: 3, pico: 0.5, dura: 0.1 });
  tono(c, d, t + 0.25, { frecuencia: 320, hasta: 210, tipo: 'sawtooth', pico: 0.05, dura: 1.1 });
  return 1.4;
};

/** Los efectos que se pueden pedir por su nombre (`sonar('palanca')`). */
export const EFECTOS = {
  clic,
  palanca,
  campana,
  polea,
  sello,
  manija,
  fichas,
  mano,
  'caja-fuerte': cajaFuerte,
} satisfies Record<string, Efecto>;

export type NombreEfecto = keyof typeof EFECTOS;
