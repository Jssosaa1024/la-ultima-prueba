/**
 * Prueba de calor: después de hallar el límite, la sala se deja 3 minutos al 70 % de la carga
 * límite y se compara el p95 del primer minuto con el del último. Lógica pura.
 */
import { crearVentanaCuadros, HUECO_MAX_MS } from '../metricas';

export const DURACION_CALOR_MS = 3 * 60_000;
export const MINUTO_MS = 60_000;
export const FRACCION_CALOR = 0.7;

/** Escalón al 70 % del último estable (al menos el 1). */
export function escalonDeCalor(ultimoEstable: number): number {
  return Math.max(1, Math.round(ultimoEstable * FRACCION_CALOR));
}

export interface ResultadoCalor {
  p95PrimerMinutoMs: number;
  p95UltimoMinutoMs: number;
}

export interface Calor {
  /** Segundos que faltan. */
  readonly restanteS: number;
  /** Cuenta un cuadro. Devuelve el resultado al cumplir los 3 minutos. */
  cuadro(ahoraMs: number): ResultadoCalor | null;
}

export function crearCalor(): Calor {
  // Un minuto a 120 Hz son 7.200 cuadros.
  const primero = crearVentanaCuadros(8192, MINUTO_MS);
  const ultimo = crearVentanaCuadros(8192, MINUTO_MS);
  let inicio: number | null = null;
  let anterior: number | null = null;
  let p95Primero: number | null = null;
  let restanteS = DURACION_CALOR_MS / 1000;

  return {
    get restanteS() {
      return restanteS;
    },
    cuadro(ahoraMs) {
      if (inicio === null) inicio = ahoraMs;
      const t = ahoraMs - inicio;
      restanteS = Math.max(0, Math.ceil((DURACION_CALOR_MS - t) / 1000));
      if (anterior !== null) {
        const ms = ahoraMs - anterior;
        if (ms > 0 && ms < HUECO_MAX_MS) {
          if (t <= MINUTO_MS) primero.registrar(ms, ahoraMs);
          if (t >= DURACION_CALOR_MS - MINUTO_MS) ultimo.registrar(ms, ahoraMs);
        }
      }
      anterior = ahoraMs;
      if (p95Primero === null && t >= MINUTO_MS) p95Primero = primero.estadisticas(ahoraMs).p95Ms;
      if (t < DURACION_CALOR_MS) return null;
      return {
        p95PrimerMinutoMs: p95Primero ?? 0,
        p95UltimoMinutoMs: ultimo.estadisticas(ahoraMs).p95Ms,
      };
    },
  };
}
