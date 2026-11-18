/**
 * La voz grabada de La Voz (T42b): baja, decodifica y hace sonar cada línea del guion por el
 * canal de voz de la mezcla, así que respeta el volumen de voz de los ajustes (T39).
 *
 * - Se guarda solo el archivo comprimido (unos 30 KB por línea); el audio decodificado
 *   (casi 1 MB por línea) se crea al sonar y se suelta al terminar.
 * - Suena una línea a la vez: una nueva calla la anterior.
 * - Cuenta en `sonidoVoz` cuándo termina, para que el subtítulo la siga. Si el archivo no
 *   carga o el navegador no lo decodifica, escribe `sin-audio` y el subtítulo sale igual.
 */
import { lineaPorId } from '../../content/guion';
import { urlDeAudio } from '../../content/audio-guion';
import { sonidoVoz } from '../../signals/voz';

/** Lo que más se espera a que baje un archivo, en milisegundos. */
export const LIMITE_DESCARGA_MS = 8000;

/** Lo mínimo del `AudioContext` que usa la voz. */
export interface ContextoVoz {
  createBufferSource(): AudioBufferSourceNode;
  decodeAudioData(datos: ArrayBuffer): Promise<AudioBuffer>;
}

export interface OpcionesVoz {
  contexto: ContextoVoz;
  /** El canal de voz de la mezcla. */
  destino: AudioNode;
  /** Baja un archivo. Por defecto, `fetch` con límite de tiempo. */
  bajar?: (url: string) => Promise<ArrayBuffer>;
  /** Reloj en milisegundos, el mismo de `performance.now()`. */
  ahora?: () => number;
  /** Empieza a sonar una línea (la mezcla baja el ambiente). */
  alEmpezar?: (id: string) => void;
  /** Ya no suena nada (terminó, se calló o falló). */
  alTerminar?: () => void;
}

export interface Voz {
  /** Hace sonar la línea `id` (calla la que sonaba). */
  decir(id: string): void;
  /** Calla lo que suena. */
  callar(): void;
  /** Baja de antemano los archivos de estas líneas, sin decodificarlos. */
  precargar(ids: readonly string[]): void;
  /** Calla y suelta todo. */
  detener(): void;
}

export async function bajarConLimite(url: string): Promise<ArrayBuffer> {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), LIMITE_DESCARGA_MS);
  try {
    const r = await fetch(url, { signal: control.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.arrayBuffer();
  } finally {
    clearTimeout(t);
  }
}

export function crearVoz(o: OpcionesVoz): Voz {
  const bajar = o.bajar ?? bajarConLimite;
  const ahora = o.ahora ?? (() => performance.now());
  /** Archivos comprimidos ya pedidos, por id. Si uno falla, se olvida para reintentar. */
  const archivos = new Map<string, Promise<ArrayBuffer>>();
  let fuente: AudioBufferSourceNode | null = null;
  /** Cambia con cada línea: lo que llega tarde de una línea anterior se descarta. */
  let turno = 0;
  let activa = true;

  const archivoDe = (id: string): Promise<ArrayBuffer> => {
    const guardado = archivos.get(id);
    if (guardado) return guardado;
    const linea = lineaPorId(id);
    const url = linea ? urlDeAudio(linea) : null;
    const pedido = url ? bajar(url) : Promise.reject(new Error(`sin audio para ${id}`));
    archivos.set(id, pedido);
    pedido.catch(() => archivos.delete(id));
    return pedido;
  };

  const soltarFuente = (): void => {
    const f = fuente;
    fuente = null;
    if (!f) return;
    f.onended = null;
    try {
      f.stop();
    } catch {
      // Ya había terminado.
    }
    f.disconnect();
  };

  const callar = (): void => {
    turno++;
    const sonaba = fuente !== null;
    soltarFuente();
    if (sonaba) o.alTerminar?.();
  };

  const decir = (id: string): void => {
    callar();
    if (!activa) return;
    const mio = turno;
    sonidoVoz.value = { id, estado: 'cargando' };
    void (async () => {
      try {
        // decodeAudioData se queda con el búfer: se le pasa una copia para poder repetirla.
        const datos = (await archivoDe(id)).slice(0);
        const audio = await o.contexto.decodeAudioData(datos);
        if (mio !== turno || !activa) return;
        const f = o.contexto.createBufferSource();
        f.buffer = audio;
        f.connect(o.destino);
        f.onended = () => {
          if (fuente !== f) return;
          fuente = null;
          f.disconnect();
          o.alTerminar?.();
        };
        fuente = f;
        f.start();
        sonidoVoz.value = { id, estado: 'sonando', terminaEn: ahora() + audio.duration * 1000 };
        o.alEmpezar?.(id);
      } catch {
        if (mio !== turno || !activa) return;
        sonidoVoz.value = { id, estado: 'sin-audio' };
      }
    })();
  };

  return {
    decir,
    callar,
    precargar(ids) {
      if (!activa) return;
      for (const id of ids) archivoDe(id).catch(() => undefined);
    },
    detener() {
      callar();
      activa = false;
      archivos.clear();
    },
  };
}
