/**
 * Presupuesto por sala (T09), sección 0 de la especificación y AGENTS.md.
 *
 * Los MB son decimales (1 MB = 1.000.000 bytes): es la lectura más estricta.
 * No subas estos límites para que una sala pase: optimiza el asset (AGENTS.md, regla 3).
 */
import type { Manifiesto } from '../manifiesto/construir.ts';

export const LIMITES = {
  /** Triángulos en escena por sala. */
  triangulos: 90_000,
  /** Draw calls: una sala cerrada se ve casi entera, así que el total estimado no pasa de 40. */
  drawCalls: 40,
  /** Descarga de modelos e imágenes por sala. */
  bytes: 2_000_000,
  /** Audio de la sala. */
  bytesAudio: 600_000,
  /** Texturas en GPU, con mipmaps. */
  bytesGpu: 16_000_000,
  /** Lado máximo de una textura. */
  ladoTextura: 1024,
} as const;

export type Limites = { -readonly [K in keyof typeof LIMITES]: number };

export type Metrica = 'triangulos' | 'drawCalls' | 'bytes' | 'bytesAudio' | 'bytesGpu';

export interface Fila {
  sala: string;
  metrica: Metrica;
  valor: number;
  limite: number;
  ok: boolean;
}

export interface Evaluacion {
  filas: Fila[];
  /** Una línea por cada exceso, lista para imprimir. */
  excesos: string[];
}

export const NOMBRES: Record<Metrica, string> = {
  triangulos: 'triángulos',
  drawCalls: 'draw calls',
  bytes: 'descarga',
  bytesAudio: 'audio',
  bytesGpu: 'texturas en GPU',
};

const METRICAS: Metrica[] = ['triangulos', 'drawCalls', 'bytes', 'bytesAudio', 'bytesGpu'];

const decimales = (n: number, d: number): string =>
  n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Cantidades en español de Colombia: `90.000`, `2,50 MB`, `12,3 KB`, `1 B`. */
export function formatear(metrica: Metrica, valor: number): string {
  if (metrica === 'triangulos' || metrica === 'drawCalls') return valor.toLocaleString('es-CO');
  if (valor >= 100_000) return `${decimales(valor / 1_000_000, 2)} MB`;
  if (valor >= 1000) return `${decimales(valor / 1000, 1)} KB`;
  return `${valor} B`;
}

/** Compara cada sala del manifiesto con los límites. */
export function evaluarPresupuesto(manifiesto: Manifiesto, limites: Limites = LIMITES): Evaluacion {
  const filas: Fila[] = [];
  const excesos: string[] = [];

  for (const [sala, { totales, archivos }] of Object.entries(manifiesto.salas)) {
    for (const metrica of METRICAS) {
      const valor = totales[metrica];
      const limite = limites[metrica];
      const ok = valor <= limite;
      filas.push({ sala, metrica, valor, limite, ok });
      if (!ok) {
        excesos.push(
          `${sala}: ${NOMBRES[metrica]} ${formatear(metrica, valor)} > ${formatear(metrica, limite)}` +
            ` (sobran ${formatear(metrica, valor - limite)})`,
        );
      }
    }
    for (const { archivo, texturas = [] } of archivos) {
      for (const t of texturas) {
        if (t.ancho > limites.ladoTextura || t.alto > limites.ladoTextura) {
          excesos.push(
            `${sala}: la textura "${t.nombre}" de ${archivo} mide ${t.ancho}×${t.alto}; ` +
              `el máximo es ${limites.ladoTextura}×${limites.ladoTextura}`,
          );
        }
      }
    }
  }
  return { filas, excesos };
}
