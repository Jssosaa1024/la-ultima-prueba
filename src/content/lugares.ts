/**
 * Los lugares del juego: la portería y las cinco salas. Va aparte del esquema
 * (`esquema-salas.ts`) para que el motor pueda usar la lista sin meter zod en el bundle del
 * juego (T02b: zod prueba `Function('')` al cargar y la CSP lo reporta como violación).
 */
export const LUGARES = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;
export type Lugar = (typeof LUGARES)[number];
