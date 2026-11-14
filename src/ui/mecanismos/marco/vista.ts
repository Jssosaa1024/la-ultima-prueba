import type { Puzzle } from '../../../content/esquema';
import type { EtapaActual, ResultadoMecanismo } from '../../../signals/mecanismo';

/**
 * Qué muestra el panel de mecanismo (T37). Puro: se prueba sin navegador.
 *
 * Cuando una etapa se resuelve, la partida avanza de una vez y los signals `etapa` y
 * `mecanismo` ya son de la etapa siguiente. El panel, en cambio, se queda mostrando la etapa
 * resuelta, con lo que respondió la máquina, hasta que el jugador toca «Seguir».
 */
export type Vista =
  /** Etapa pendiente: controles activos. */
  | {
      tipo: 'en_curso';
      numero: number;
      estado: unknown;
      condiciones: Readonly<Record<string, boolean>>;
      /** Lo último que respondió la máquina en esta misma etapa. */
      resultado: ResultadoMecanismo | null;
    }
  /** Etapa recién resuelta, todavía sin «Seguir»: controles bloqueados. */
  | {
      tipo: 'resuelta';
      numero: number;
      estado: unknown;
      condiciones: Readonly<Record<string, boolean>>;
      resultado: ResultadoMecanismo;
      /** Con esta etapa se ganó el sello de la sala. */
      sello: boolean;
    }
  /** La sala ya tiene sello y no queda nada por mostrar. */
  | { tipo: 'terminada' };

export interface DatosDeVista {
  puzzle: Puzzle;
  /** Signal `etapa`: la etapa pendiente de la sala actual, si la hay. */
  etapa: EtapaActual | null;
  /** Signal `mecanismo`. */
  estado: unknown;
  /** Signal `condiciones`. */
  condiciones: Readonly<Record<string, boolean>>;
  /** Signal `resultado`. */
  resultado: ResultadoMecanismo | null;
  /** Número del último resultado resuelto al que el jugador ya le dio «Seguir». */
  visto: number;
}

export function vistaDelPanel(d: DatosDeVista): Vista {
  const r = d.resultado?.puzzle === d.puzzle.id ? d.resultado : null;
  if (r?.resuelta && r.n > d.visto) {
    return {
      tipo: 'resuelta',
      numero: r.etapa,
      estado: r.estado,
      condiciones: r.condiciones,
      resultado: r,
      sello: r.sello,
    };
  }
  if (!d.etapa || d.etapa.puzzle !== d.puzzle.id) return { tipo: 'terminada' };
  return {
    tipo: 'en_curso',
    numero: d.etapa.etapa,
    estado: d.estado,
    condiciones: d.condiciones,
    resultado: r && !r.resuelta && r.etapa === d.etapa.etapa ? r : null,
  };
}
