/**
 * Poses del cooperativo (T82): cuándo enviar la propia y cómo mover a los demás. Lógica pura,
 * sin Three ni red, con pruebas de unidad.
 *
 * Protocolo (especificación, sección 3, `dir`): `pose { s, x, y, z, yaw }` con la sala por
 * número (0 = portería), la posición en centímetros enteros y el giro en centésimas de grado.
 * Se envía a 4 Hz solo en movimiento, más una al detenerse; los demás interpolan con 150 ms
 * de retraso.
 */

import type { PoseRed } from '../../signals/poses';

/** Pose tal como viaja por la red. */
export type { PoseRed };

/** 4 Hz: una pose cada 250 ms mientras el jugador se mueve. */
export const MS_ENTRE_POSES = 250;
/** Sin cambios durante este tiempo, el jugador se detuvo: sale su última pose. */
export const MS_PARA_DETENIDO = 120;
/** Los demás se dibujan 150 ms en el pasado: así casi siempre hay dos poses entre las cuales interpolar. */
export const RETRASO_INTERPOLACION_MS = 150;

const LIMITE_CM = 10_000;
const cm = (metros: number): number =>
  Math.max(-LIMITE_CM, Math.min(LIMITE_CM, Math.round(metros * 100)));

/** Giro en radianes (el `yaw` de la cámara) a centésimas de grado, entre −18.000 y 18.000. */
export function yawACentesimas(rad: number): number {
  let g = ((rad * 180) / Math.PI) % 360;
  if (g > 180) g -= 360;
  if (g <= -180) g += 360;
  return Math.round(g * 100);
}

export const centesimasARad = (c: number): number => ((c / 100) * Math.PI) / 180;

/** Metros a centímetros enteros, dentro de los ±100 m que acepta el protocolo. */
export const aCm = cm;

export interface EmisorPoses {
  /**
   * Cada cuadro, con la pose ya cuantizada (sala, cm y centésimas de grado). Devuelve la pose
   * que hay que enviar o `null`. Solo asigna memoria al enviar.
   * - En movimiento: una cada `MS_ENTRE_POSES` como máximo.
   * - Al detenerse (sin cambios durante `MS_PARA_DETENIDO`): la última, para que los demás no
   *   se queden con una vieja.
   */
  cuadro(ahoraMs: number, s: number, x: number, y: number, z: number, yaw: number): PoseRed | null;
  /** Olvida lo enviado: la siguiente pose sale de una vez (al volver a la partida). */
  reiniciar(): void;
}

export function crearEmisorPoses(msEntrePoses = MS_ENTRE_POSES): EmisorPoses {
  // Última enviada y la del cuadro anterior, en números sueltos para no asignar por cuadro.
  const enviada = new Float64Array(5);
  const anterior = new Float64Array(5);
  let hayEnviada = false;
  let ultimoEnvio = -Infinity;
  let ultimoCambio = -Infinity;

  const igual = (v: Float64Array, s: number, x: number, y: number, z: number, yaw: number) =>
    v[0] === s && v[1] === x && v[2] === y && v[3] === z && v[4] === yaw;
  const guardar = (v: Float64Array, s: number, x: number, y: number, z: number, yaw: number) => {
    v[0] = s;
    v[1] = x;
    v[2] = y;
    v[3] = z;
    v[4] = yaw;
  };

  return {
    cuadro(ahoraMs, s, x, y, z, yaw) {
      if (!igual(anterior, s, x, y, z, yaw)) ultimoCambio = ahoraMs;
      guardar(anterior, s, x, y, z, yaw);
      if (hayEnviada && igual(enviada, s, x, y, z, yaw)) return null;
      // Quieto un momento (no un solo cuadro: girar despacio no mueve un centímetro por cuadro).
      const detenido = ahoraMs - ultimoCambio >= MS_PARA_DETENIDO;
      if (detenido || !hayEnviada || ahoraMs - ultimoEnvio >= msEntrePoses) {
        guardar(enviada, s, x, y, z, yaw);
        hayEnviada = true;
        ultimoEnvio = ahoraMs;
        return { s, x, y, z, yaw };
      }
      return null;
    },
    reiniciar() {
      hayEnviada = false;
      anterior.fill(NaN);
      ultimoEnvio = -Infinity;
      ultimoCambio = -Infinity;
    },
  };
}

/** Pose en metros y radianes, lista para dibujar. */
export interface PoseMundo {
  s: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Poses guardadas por jugador: con 4 Hz y 150 ms de retraso bastan unas pocas. */
const CAPACIDAD = 8;

export interface Interpolador {
  /** Guarda una pose recibida en el instante local `enMs`. */
  recibir(enMs: number, pose: PoseRed): void;
  /**
   * Escribe en `destino` la pose de hace `RETRASO_INTERPOLACION_MS`. Entre dos poses
   * interpola; antes de la primera o después de la última, se queda en la más cercana (sin
   * adivinar hacia adelante). Devuelve `false` si aún no llegó ninguna. No asigna memoria.
   */
  muestra(ahoraMs: number, destino: PoseMundo): boolean;
}

/** Diferencia de ángulo en (−π, π]: el camino corto entre dos giros. */
export function diferenciaAngulo(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

export function crearInterpolador(retrasoMs = RETRASO_INTERPOLACION_MS): Interpolador {
  const t = new Float64Array(CAPACIDAD);
  const s = new Int32Array(CAPACIDAD);
  const x = new Float64Array(CAPACIDAD);
  const y = new Float64Array(CAPACIDAD);
  const z = new Float64Array(CAPACIDAD);
  const yaw = new Float64Array(CAPACIDAD);
  let n = 0;
  let inicio = 0;

  const indice = (k: number): number => (inicio + k) % CAPACIDAD;
  const copiar = (i: number, d: PoseMundo): void => {
    d.s = s[i] ?? 0;
    d.x = x[i] ?? 0;
    d.y = y[i] ?? 0;
    d.z = z[i] ?? 0;
    d.yaw = yaw[i] ?? 0;
  };

  return {
    recibir(enMs, p) {
      // Si llega desordenada (más vieja que la última), se descarta.
      if (n > 0 && enMs < (t[indice(n - 1)] ?? 0)) return;
      let i: number;
      if (n < CAPACIDAD) i = indice(n++);
      else {
        i = inicio;
        inicio = (inicio + 1) % CAPACIDAD;
      }
      t[i] = enMs;
      s[i] = p.s;
      x[i] = p.x / 100;
      y[i] = p.y / 100;
      z[i] = p.z / 100;
      yaw[i] = centesimasARad(p.yaw);
    },
    muestra(ahoraMs, destino) {
      if (n === 0) return false;
      const objetivo = ahoraMs - retrasoMs;
      const primero = indice(0);
      if (objetivo <= (t[primero] ?? 0)) {
        copiar(primero, destino);
        return true;
      }
      for (let k = n - 1; k > 0; k--) {
        const b = indice(k);
        const a = indice(k - 1);
        const ta = t[a] ?? 0;
        const tb = t[b] ?? 0;
        if (objetivo < ta) continue;
        if (objetivo >= tb) {
          copiar(b, destino);
          return true;
        }
        // Al cambiar de sala no se interpola: se salta.
        if (s[a] !== s[b]) {
          copiar(b, destino);
          return true;
        }
        const f = (objetivo - ta) / Math.max(1, tb - ta);
        destino.s = s[b] ?? 0;
        destino.x = (x[a] ?? 0) + ((x[b] ?? 0) - (x[a] ?? 0)) * f;
        destino.y = (y[a] ?? 0) + ((y[b] ?? 0) - (y[a] ?? 0)) * f;
        destino.z = (z[a] ?? 0) + ((z[b] ?? 0) - (z[a] ?? 0)) * f;
        destino.yaw = (yaw[a] ?? 0) + diferenciaAngulo(yaw[a] ?? 0, yaw[b] ?? 0) * f;
        return true;
      }
      copiar(indice(n - 1), destino);
      return true;
    },
  };
}
