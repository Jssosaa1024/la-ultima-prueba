/**
 * Dónde está publicado el audio de cada línea de La Voz (T42b). Sin imports: lo usan el juego
 * (`engine/audio/voz.ts`) y los scripts de Node (`optimize-audio`), que no pasan por Vite.
 *
 * `public/assets/audio/<idioma>/<carpeta>/<id>.m4a`, donde la carpeta es la sala de la línea
 * en el guion; las que suenan en cualquier sala (espera y fallo) van a `compartido`.
 */

export const IDIOMA_AUDIO = 'es-CO';

/** Los ids del guion también son nombres de archivo: solo minúsculas, números y guiones. */
const ID_AUDIO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Carpeta del audio de una línea según su `sala` del guion. */
export function carpetaDeAudio(sala: string): string {
  return sala === 'cualquiera' ? 'compartido' : sala;
}

/** Ruta del audio relativa a la carpeta del idioma (`porteria/voz-intro-1.m4a`), o `null`. */
export function archivoDeAudio(linea: { id: string; sala: string }): string | null {
  if (!ID_AUDIO.test(linea.id) || !ID_AUDIO.test(carpetaDeAudio(linea.sala))) return null;
  return `${carpetaDeAudio(linea.sala)}/${linea.id}.m4a`;
}

/** URL del audio en el sitio (`/assets/audio/es-CO/porteria/voz-intro-1.m4a`), o `null`. */
export function urlDeAudio(linea: { id: string; sala: string }): string | null {
  const archivo = archivoDeAudio(linea);
  return archivo ? `/assets/audio/${IDIOMA_AUDIO}/${archivo}` : null;
}
