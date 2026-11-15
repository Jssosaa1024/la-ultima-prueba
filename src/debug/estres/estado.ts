/**
 * Estado observable de la prueba de estrés. El panel (`ui`) escribe `ordenEstres`; el
 * controlador del motor la atiende y publica `estres`. Ningún lado importa al otro.
 */
import { signal } from '@preact/signals';
import type { EscalonInforme, InformeEstres } from '../informe';
import { ultimoEstable } from './ciclo';
import type { FaseCiclo, MotivoFin } from './ciclo';
import type { Eje } from './marca';

export type FaseEstres = 'inactiva' | FaseCiclo | 'calor' | 'liberando';

export interface EstadoEstres {
  fase: FaseEstres;
  eje: Eje | null;
  escalon: number;
  carga: string;
  escalones: EscalonInforme[];
  /** Por qué terminó; `recarga` si se encontró la marca al abrir la página. */
  motivo: MotivoFin | 'recarga' | null;
  memoria?: InformeEstres['memoria'];
  calor?: InformeEstres['calor'];
  /** Segundos que le faltan a la prueba de calor. */
  calorRestanteS?: number;
}

export const ESTRES_INACTIVO: EstadoEstres = {
  fase: 'inactiva',
  eje: null,
  escalon: 0,
  carga: '',
  escalones: [],
  motivo: null,
};

export const estres = signal<EstadoEstres>(ESTRES_INACTIVO);

export type OrdenEstres = { t: 'iniciar'; eje: Eje } | { t: 'detener' } | { t: 'calor' };

/** Lo que pide el panel. El controlador la toma y la vuelve a `null`. */
export const ordenEstres = signal<OrdenEstres | null>(null);

/** Si la prueba está corriendo (no se puede empezar otra). */
export const corriendo = (e: EstadoEstres): boolean =>
  e.fase !== 'inactiva' && e.fase !== 'terminada';

/** La parte `estres` del JSON exportado; `null` si nunca corrió. */
export function informeEstres(e: EstadoEstres): InformeEstres | null {
  if (!e.eje) return null;
  const informe: InformeEstres = {
    eje: e.eje,
    escalones: e.escalones,
    ultimo_estable: ultimoEstable(e.escalones),
  };
  if (e.memoria) informe.memoria = e.memoria;
  if (e.calor) informe.calor = e.calor;
  return informe;
}
