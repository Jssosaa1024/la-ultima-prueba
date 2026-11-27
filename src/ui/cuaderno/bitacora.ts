import type { PruebaExpediente } from '../../content/expediente';

/** Un punto de la bitácora: minuto y litros. */
export interface PuntoBitacora {
  minuto: number;
  litros: number;
}

/** Las dos series de la bitácora de 1991: el filtro de E. C. y el del otro colegio. */
export interface SeriesBitacora {
  propio: PuntoBitacora[];
  otro: PuntoBitacora[];
  /** Los minutos en que los dos filtros dan lo mismo (con datos de rectas distintas, uno). */
  cruces: PuntoBitacora[];
}

const numero = (celda: string | undefined): number | null => {
  if (celda === undefined) return null;
  const n = Number(celda.replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Lee la tabla de la bitácora (prueba de la sala 2) para dibujar sus dos rectas en el
 * cuaderno. Columnas: minuto, filtro de E. C., otro colegio. Las filas que no son números se
 * saltan. Sin tabla de tres columnas, `null`. Puro.
 */
export function seriesBitacora(prueba: PruebaExpediente): SeriesBitacora | null {
  const tabla = prueba.bloques.find((b) => b.tipo === 'tabla' && b.columnas.length === 3);
  if (!tabla || tabla.tipo !== 'tabla') return null;
  const propio: PuntoBitacora[] = [];
  const otro: PuntoBitacora[] = [];
  const cruces: PuntoBitacora[] = [];
  for (const fila of tabla.filas) {
    const minuto = numero(fila[0]);
    const a = numero(fila[1]);
    const b = numero(fila[2]);
    if (minuto === null || a === null || b === null) continue;
    propio.push({ minuto, litros: a });
    otro.push({ minuto, litros: b });
    if (a === b) cruces.push({ minuto, litros: a });
  }
  return propio.length >= 2 ? { propio, otro, cruces } : null;
}
