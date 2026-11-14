import type { ComponentType } from 'preact';
import type { Mecanismo } from '../../content/esquema';
import PanelCarritos from './carritos/Panel';
import PanelEtiquetadora from './etiquetadora/Panel';
import type { PropsPanel } from './marco/tipos';
import PanelReflector from './reflector/Panel';
import PanelTanques from './tanques/Panel';
import PanelUrna from './urna/Panel';

/**
 * El panel de cada mecanismo (T37). Cada uno vive en su propio archivo
 * (`<mecanismo>/Panel.tsx`), así que varias sesiones pueden hacer el suyo a la vez sin tocar
 * este.
 */
export const PANELES: { readonly [M in Mecanismo]: ComponentType<PropsPanel<M>> } = {
  etiquetadora: PanelEtiquetadora,
  tanques: PanelTanques,
  reflector: PanelReflector,
  carritos: PanelCarritos,
  urna: PanelUrna,
};
