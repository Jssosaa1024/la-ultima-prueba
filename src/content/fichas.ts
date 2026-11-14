import type { BloqueFicha, FichaDeObjeto } from './esquema-fichas';
import type { Lugar } from './esquema-salas';
import datos from './fichas.json';
import { SALAS_3D } from './salas';

/**
 * Fichas de inspección de todas las salas (T35c): lo que se lee al examinar un objeto.
 *
 * El JSON se valida con el esquema en cada build (`src/content.config.ts`) y en
 * `tests/unit/fichas.test.ts`; por eso aquí solo se declara su tipo, sin cargar zod en el
 * bundle del juego.
 */
export const FICHAS = datos as unknown as readonly FichaDeObjeto[];

/** Una ficha lista para la vista de inspección: tiene la forma de `Ficha` de `signals/contenido.ts`. */
export interface FichaLista {
  titulo: string;
  descripcion: string;
  bloques: readonly BloqueFicha[];
}

/** Acciones de un objeto con algo que leer: lo que se examina y los papeles que se recogen. */
const ACCIONES_CON_FICHA: readonly (string | undefined)[] = ['examinar', 'recoger'];

/**
 * Objetos de un lugar que el jugador puede examinar (botón «Examinar» del HUD). Cada uno
 * debe tener ficha: un test falla si falta alguna.
 */
export function objetosExaminables(lugar: Lugar): string[] {
  const sala = SALAS_3D.find((s) => s.id === lugar);
  return (sala?.objetos ?? []).filter((o) => o.accion === 'examinar').map((o) => o.id);
}

/**
 * La ficha de un objeto, o `null` si no tiene nada escrito.
 *
 * `etapa` es la etapa pendiente de la sala del objeto, como la devuelve `etapaActual()` de
 * `game/partida.ts`: 0 (presentar), 1 (torcer), 2 (dominar) o `null` si la sala ya tiene su
 * sello. Solo cambia las fichas que dependen del avance (por ejemplo, la etiqueta de un
 * producto); en la portería no importa.
 */
export function fichaDeObjeto(objeto: string, etapa: number | null = 0): FichaLista | null {
  const ficha = FICHAS.find((f) => f.id === objeto);
  if (!ficha) return null;
  const dueno = SALAS_3D.flatMap((s) => s.objetos).find((o) => o.id === objeto);
  if (!dueno?.nombre || !ACCIONES_CON_FICHA.includes(dueno.accion)) return null;
  // Una etapa que no existe (un guardado raro, un número suelto) se lee como la primera.
  const momento =
    etapa === null ? 3 : Number.isInteger(etapa) && etapa >= 0 && etapa <= 2 ? etapa : 0;
  const extra = ficha.por_etapa?.[momento] ?? [];
  return {
    titulo: dueno.nombre,
    descripcion: ficha.descripcion,
    bloques: [...ficha.bloques, ...extra],
  };
}

/**
 * Todas las fichas de un lugar, por id de objeto: lo que el controlador copia al signal
 * `fichas` al entrar a una sala o al cambiar de etapa.
 */
export function fichasDeLugar(
  lugar: Lugar,
  etapa: number | null = 0,
): Readonly<Record<string, FichaLista>> {
  const sala = SALAS_3D.find((s) => s.id === lugar);
  const fichas: Record<string, FichaLista> = {};
  for (const o of sala?.objetos ?? []) {
    const ficha = fichaDeObjeto(o.id, etapa);
    if (ficha) fichas[o.id] = ficha;
  }
  return fichas;
}
