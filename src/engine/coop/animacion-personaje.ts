/**
 * Animación de los personajes del cooperativo (T83c), en reglas puras: sin Three ni red, con
 * pruebas de unidad. `personajes.ts` las aplica a los esqueletos.
 *
 * - **Andar:** la velocidad sale de la posición interpolada (`poses.ts`, a 2 Hz), cuadro a
 *   cuadro y suavizada. Quieto o caminando, con un margen para no parpadear entre los dos, y el
 *   clip de caminar a la rapidez que hace que los pies no patinen: velocidad ÷ la del clip.
 * - **Saludo:** cuando un compañero manda una frase rápida (T91), su personaje saluda una vez.
 */

/** Qué hace el cuerpo entero. El saludo va encima, solo en el brazo. */
export type Paso = 'quieto' | 'caminar';

/** Desde esta velocidad (m/s) el personaje camina. */
export const VELOCIDAD_PARA_CAMINAR = 0.3;
/** Y por debajo de esta vuelve a quedarse quieto (margen para no parpadear). */
export const VELOCIDAD_PARA_PARAR = 0.15;
/** Constante de tiempo del suavizado de la velocidad. */
export const SUAVIZADO_VELOCIDAD_MS = 180;
/** Más que esto en un cuadro (cambio de sala, reaparecer) no es caminar: se salta. */
const SALTO_M = 1.5;
/** Rapidez del clip de caminar entre estos límites: fuera de ellos se ve raro. */
export const ESCALA_MINIMA = 0.6;
export const ESCALA_MAXIMA = 1.8;

export interface Andar {
  readonly paso: Paso;
  /** Velocidad suavizada, en m/s. */
  readonly velocidad: number;
  /** Multiplicador del clip de caminar para que los pies no patinen. */
  readonly escala: number;
  /** Cada cuadro, con la posición dibujada (metros). No asigna memoria. */
  medir(ahoraMs: number, x: number, z: number): void;
  /** Olvida la posición anterior (al volver a verlo después de un rato). */
  reiniciar(): void;
}

/**
 * @param velocidadDelClip metros por segundo que avanza el clip de caminar a rapidez 1: la
 *   distancia de un paso doble dividida por la duración del clip.
 */
export function crearAndar(velocidadDelClip: number): Andar {
  let x0 = 0;
  let z0 = 0;
  let t0 = NaN;
  let velocidad = 0;
  let paso: Paso = 'quieto';
  const clip = Math.max(0.01, velocidadDelClip);

  return {
    get paso() {
      return paso;
    },
    get velocidad() {
      return velocidad;
    },
    get escala() {
      return Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, velocidad / clip));
    },
    medir(ahoraMs, x, z) {
      const dt = ahoraMs - t0;
      const d = Math.hypot(x - x0, z - z0);
      x0 = x;
      z0 = z;
      t0 = ahoraMs;
      // Un salto (otra sala) o mucho rato sin verlo: arranca quieto.
      if (d > SALTO_M || dt > 1000) {
        velocidad = 0;
        paso = 'quieto';
        return;
      }
      // Primer cuadro o el mismo instante: no hay velocidad que medir.
      if (!(dt > 0)) return;
      const k = 1 - Math.exp(-dt / SUAVIZADO_VELOCIDAD_MS);
      velocidad += ((d * 1000) / dt - velocidad) * k;
      if (paso === 'quieto' && velocidad >= VELOCIDAD_PARA_CAMINAR) paso = 'caminar';
      else if (paso === 'caminar' && velocidad < VELOCIDAD_PARA_PARAR) paso = 'quieto';
    },
    reiniciar() {
      t0 = NaN;
      velocidad = 0;
      paso = 'quieto';
    },
  };
}

/** Lo mínimo de una señal (`SenalCoop` de `signals/coop.ts`) para decidir un saludo. */
export interface SenalParaSaludo {
  n: number;
  jugador: string;
  frase: string | null;
}

/** Las señales más nuevas que esto ya no saludan (llegaron con el módulo cargándose). */
export const MS_SALUDO_VIGENTE = 3000;

/**
 * Quiénes saludan por las señales nuevas (las de número mayor que `vistas`): las que traen una
 * frase («¡Aquí!», «Mira», …). Un punto sin frase no saluda. Devuelve el número de la última
 * señal vista y, solo si hay alguien, la lista (sin repetir). No asigna memoria si no hay
 * señales nuevas.
 */
export function saludosNuevos(
  senales: readonly SenalParaSaludo[],
  vistas: number,
): { vistas: number; jugadores: string[] | null } {
  const ultima = senales[senales.length - 1];
  if (!ultima || ultima.n <= vistas) return { vistas, jugadores: null };
  let jugadores: string[] | null = null;
  for (const s of senales) {
    if (s.n <= vistas || s.frase === null) continue;
    jugadores ??= [];
    if (!jugadores.includes(s.jugador)) jugadores.push(s.jugador);
  }
  return { vistas: ultima.n, jugadores };
}

/**
 * Qué personaje del paquete le toca a cada jugador. Sale del color, que es único en la partida
 * y no cambia durante el juego: así dos compañeros nunca se ven iguales (si el paquete trae
 * cuatro o más) y el mismo jugador es siempre el mismo personaje, también al reconectarse.
 */
export function varianteDe(indiceColor: number, variantes: number): number {
  if (variantes <= 0) return 0;
  return ((indiceColor % variantes) + variantes) % variantes;
}
