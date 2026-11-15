/**
 * Los cuatro ejes de la prueba de estrés (T11p y T11q), en números: cuánto agrega cada
 * escalón, cuántos escalones hay y cómo se describe la carga. Lógica pura; la geometría y las
 * texturas de cada escalón están en `cargas.ts`.
 */
import type { Eje } from './marca';

/** Triángulos: +10.000 por escalón con un `InstancedMesh` (una sola draw call). */
export const TRIANGULOS_POR_ESCALON = 10_000;
/** Draw calls: +10 mallas pequeñas con material propio. */
export const MALLAS_POR_ESCALON = 10;
/** Texturas: +4 texturas KTX2 de 1024 px en planos visibles. */
export const TEXTURAS_POR_ESCALON = 4;
/** Píxeles: pixel ratio de 0,5 al del equipo en pasos de 0,25; luego +1 plano transparente. */
export const PIXEL_RATIO_INICIAL = 0.5;
export const PASO_PIXEL_RATIO = 0.25;
export const PLANOS_MAXIMOS = 10;

/** Tope de escalones por eje: muy por encima del presupuesto, para no correr sin fin. */
export const MAX_ESCALONES: Record<Exclude<Eje, 'pixeles'>, number> = {
  triangulos: 30,
  'draw-calls': 30,
  // 64 texturas de 1024²: unos 45 MB en ETC2, casi el triple del presupuesto de 16 MB.
  texturas: 16,
};

/** Pixel ratios del eje de píxeles: 0,5; 0,75; … hasta el `devicePixelRatio` del equipo. */
export function pasosPixelRatio(dprEquipo: number): number[] {
  const tope = Math.max(PIXEL_RATIO_INICIAL, dprEquipo);
  const pasos: number[] = [];
  for (let r = PIXEL_RATIO_INICIAL; r < tope - 1e-6; r += PASO_PIXEL_RATIO) {
    pasos.push(Math.round(r * 100) / 100);
  }
  pasos.push(Math.round(tope * 100) / 100);
  return pasos;
}

export interface NivelPixeles {
  pixelRatio: number;
  planos: number;
}

/** Qué pide el escalón `escalon` (desde 1) del eje de píxeles. */
export function nivelPixeles(escalon: number, dprEquipo: number): NivelPixeles {
  const pasos = pasosPixelRatio(dprEquipo);
  const i = Math.min(escalon, pasos.length) - 1;
  return {
    pixelRatio: pasos[Math.max(0, i)] ?? PIXEL_RATIO_INICIAL,
    planos: Math.max(0, escalon - pasos.length),
  };
}

export function maxEscalones(eje: Eje, dprEquipo: number): number {
  if (eje === 'pixeles') return pasosPixelRatio(dprEquipo).length + PLANOS_MAXIMOS;
  return MAX_ESCALONES[eje];
}

const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** La carga del escalón, en palabras: «+20.000 triángulos», «pixel ratio 1,5 + 2 planos». */
export function describirCarga(eje: Eje, escalon: number, dprEquipo: number): string {
  switch (eje) {
    case 'triangulos':
      return `+${entero.format(escalon * TRIANGULOS_POR_ESCALON)} triángulos`;
    case 'draw-calls':
      return `+${escalon * MALLAS_POR_ESCALON} draw calls`;
    case 'texturas':
      return `+${escalon * TEXTURAS_POR_ESCALON} texturas`;
    case 'pixeles': {
      const n = nivelPixeles(escalon, dprEquipo);
      const ratio = `pixel ratio ${decimal.format(n.pixelRatio)}`;
      if (n.planos === 0) return ratio;
      return `${ratio} + ${n.planos} ${n.planos === 1 ? 'plano' : 'planos'}`;
    }
  }
}

export const NOMBRES_EJE: Record<Eje, string> = {
  triangulos: 'Triángulos',
  'draw-calls': 'Draw calls',
  texturas: 'Texturas',
  pixeles: 'Píxeles',
};
