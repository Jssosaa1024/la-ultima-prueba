import type { Alias, Color } from '../../signals/coop';

/**
 * Cómo se ven los alias y los colores del cooperativo (T32). Por la red solo viaja el id; el
 * texto y el color salen de aquí. Son animales de Colombia, sin nombres de personas.
 */
export const NOMBRE_ALIAS: Readonly<Record<Alias, string>> = {
  zorro: 'Zorro',
  buho: 'Búho',
  colibri: 'Colibrí',
  tortuga: 'Tortuga',
  jaguar: 'Jaguar',
  condor: 'Cóndor',
  delfin: 'Delfín',
  oso: 'Oso',
  rana: 'Rana',
  tucan: 'Tucán',
  ardilla: 'Ardilla',
  mono: 'Mono',
};

export const COLOR: Readonly<Record<Color, { nombre: string; css: string }>> = {
  ambar: { nombre: 'Ámbar', css: '#e8a33d' },
  turquesa: { nombre: 'Turquesa', css: '#3ec1c9' },
  violeta: { nombre: 'Violeta', css: '#a98bf0' },
  coral: { nombre: 'Coral', css: '#f2836b' },
};
