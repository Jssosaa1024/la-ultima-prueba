/**
 * Los efectos de sonido grabados con ElevenLabs (T42c). Sin imports: lo usan el juego
 * (`engine/audio/grabados.ts`) y los scripts de Node (`efectos`, `optimize-audio`), que no
 * pasan por Vite.
 *
 * Cada uno reemplaza al efecto del mismo nombre hecho con Web Audio (`sintesis.ts`), que sigue
 * sonando mientras el archivo baja o si no carga. El clic, el bip y el sello siguen hechos con
 * código: son señales del juego, no objetos.
 *
 * Se publican en `public/assets/audio/es-CO/compartido/efecto-<nombre>.m4a`: suenan en todas
 * las salas y su peso cuenta en el audio compartido.
 */

export const EFECTOS_GRABADOS = [
  'puerta',
  'puerta-cerrada',
  'clac',
  'teclas',
  'registradora',
  'imprenta',
  'incubadora',
  'casilleros',
  'recoger',
  'libro',
  'ficha',
  'interfono',
  'palanca',
  'campana',
  'polea',
  'manija',
  'fichas',
  'mano',
  'caja-fuerte',
] as const;

export type EfectoGrabado = (typeof EFECTOS_GRABADOS)[number];

export function esEfectoGrabado(nombre: string): nombre is EfectoGrabado {
  return (EFECTOS_GRABADOS as readonly string[]).includes(nombre);
}

/** Ruta relativa a la carpeta del idioma (`compartido/efecto-puerta.m4a`). */
export function archivoDeEfecto(nombre: EfectoGrabado): string {
  return `compartido/efecto-${nombre}.m4a`;
}

/** URL en el sitio. El idioma es el mismo `IDIOMA_AUDIO` de `audio-guion.ts` (lo revisa un test). */
export function urlDeEfecto(nombre: EfectoGrabado): string {
  return `/assets/audio/es-CO/${archivoDeEfecto(nombre)}`;
}
