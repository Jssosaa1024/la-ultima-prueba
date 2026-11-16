/**
 * Perfiles de limpieza por `fuente` (T11a). `optimize-models --lista` lee la fuente de cada
 * archivo en `art/credits.json` y elige aquí qué hacer con él antes de la etapa común.
 *
 * Desde la ola 6 solo hay dos: `kenney` para modelos y `ambientcg` para texturas. Las demás
 * fuentes no se arman desde `art/modelos.json` (la taza de prueba, por ejemplo, la genera
 * `npm run taza-prueba`).
 */
import type { Fuente } from '../creditos/esquema.ts';

export type Perfil = 'kenney' | 'ambientcg';

/** Qué produce cada perfil. */
export const PRODUCE: Readonly<Record<Perfil, 'modelo' | 'textura'>> = {
  kenney: 'modelo',
  ambientcg: 'textura',
};

/** El perfil de una fuente, o `null` si esa fuente no se arma desde la lista. */
export function perfilDe(fuente: Fuente): Perfil | null {
  return fuente === 'kenney' || fuente === 'ambientcg' ? fuente : null;
}
