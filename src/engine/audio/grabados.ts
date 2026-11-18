/**
 * Los efectos de sonido grabados con ElevenLabs (T42c): puertas, la registradora, las
 * máquinas. Se bajan después del primer toque (unos 220 KB en total), se decodifican una vez y
 * suenan por el canal de efectos de la mezcla, así que respetan el volumen de los ajustes.
 *
 * Mientras un archivo no ha llegado, o si no carga, `tocar` devuelve `false` y el motor toca
 * el efecto hecho con código del mismo nombre (`sintesis.ts`): nunca se queda callado.
 */
import {
  EFECTOS_GRABADOS,
  esEfectoGrabado,
  urlDeEfecto,
  type EfectoGrabado,
} from '../../content/audio-efectos';
import { bajarConLimite } from './voz';

/**
 * Nivel de cada efecto al sonar, en dB. Los archivos van normalizados por pico (−2 dBTP), así
 * que su sonoridad cambia mucho de uno a otro; esto los acomoda por debajo de La Voz (−16 LUFS)
 * después del canal de efectos (−3 dB al 100 %): las puertas, la registradora y lo que abre un
 * sello cerca de −21 LUFS, y los controles cerca de −24. Sale de los LUFS que imprime
 * `npm run optimize-audio`. Nunca pasa de +3 dB, para que el pico no llegue a 0 dB.
 */
export const NIVEL_GRABADO_DB: Readonly<Record<EfectoGrabado, number>> = {
  puerta: 2.5,
  'puerta-cerrada': 3,
  clac: 2.5,
  teclas: 3,
  registradora: 3,
  imprenta: 3,
  incubadora: 3,
  casilleros: 3,
  recoger: -0.1,
  libro: -1.5,
  ficha: 3,
  interfono: -5,
  palanca: -0.2,
  campana: 3,
  polea: -3.8,
  manija: -2,
  fichas: 1,
  mano: -4.5,
  'caja-fuerte': 3,
};

/** El nivel más alto permitido: con el pico a −2 dBTP y el canal a −3 dB, queda en −2 dBFS. */
export const NIVEL_MAXIMO_DB = 3;

/** Lo mínimo del `AudioContext` que usan los efectos grabados. */
export interface ContextoGrabados {
  createBufferSource(): AudioBufferSourceNode;
  createGain(): GainNode;
  decodeAudioData(datos: ArrayBuffer): Promise<AudioBuffer>;
}

export interface OpcionesGrabados {
  contexto: ContextoGrabados;
  /** El canal de efectos de la mezcla. */
  destino: AudioNode;
  /** Baja un archivo. Por defecto, `fetch` con límite de tiempo. */
  bajar?: (url: string) => Promise<ArrayBuffer>;
}

export interface EfectosGrabados {
  /** Toca el efecto grabado en el instante `t`; `false` si todavía no está (o no existe). */
  tocar(nombre: string, t: number): boolean;
  /** Cuántos ya están listos para sonar. */
  readonly listos: number;
  /** Calla lo que suena y suelta los audios. */
  detener(): void;
}

export function crearEfectosGrabados(o: OpcionesGrabados): EfectosGrabados {
  const bajar = o.bajar ?? bajarConLimite;
  const audios = new Map<EfectoGrabado, AudioBuffer>();
  const sonando = new Set<AudioBufferSourceNode>();
  let activo = true;

  for (const nombre of EFECTOS_GRABADOS) {
    bajar(urlDeEfecto(nombre))
      .then((datos) => o.contexto.decodeAudioData(datos))
      .then((audio) => {
        if (activo) audios.set(nombre, audio);
      })
      // Sin el archivo, suena el efecto hecho con código.
      .catch(() => undefined);
  }

  return {
    tocar(nombre, t) {
      if (!activo || !esEfectoGrabado(nombre)) return false;
      const audio = audios.get(nombre);
      if (!audio) return false;
      const fuente = o.contexto.createBufferSource();
      fuente.buffer = audio;
      const g = o.contexto.createGain();
      g.gain.value = 10 ** (Math.min(NIVEL_GRABADO_DB[nombre], NIVEL_MAXIMO_DB) / 20);
      fuente.connect(g).connect(o.destino);
      fuente.onended = () => {
        g.disconnect();
        sonando.delete(fuente);
      };
      sonando.add(fuente);
      fuente.start(t);
      return true;
    },
    get listos() {
      return audios.size;
    },
    detener() {
      activo = false;
      for (const f of sonando) {
        try {
          f.stop();
        } catch {
          // Ya había terminado.
        }
      }
      sonando.clear();
      audios.clear();
    },
  };
}
