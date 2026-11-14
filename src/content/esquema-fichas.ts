import { z } from 'astro/zod';
import type { Sala } from './esquema-salas';
import datosSalas from './salas.json';

/**
 * Esquema de las fichas de inspección (T35c): el texto legible de cada objeto que se examina.
 *
 * `src/content/fichas.json` trae una ficha por objeto, con los mismos bloques que dibuja la
 * vista de inspección (`src/signals/contenido.ts`): texto, tabla, lista y nota. Lo que cambia
 * con el avance de la sala (la etiqueta de un producto, el temporizador de la campana, las
 * lámparas destapadas) va en `por_etapa`.
 *
 * Este archivo lo usa `src/content.config.ts` para validar el JSON en cada build. El juego
 * solo importa los TIPOS (`import type`), para no meter zod en el bundle.
 *
 * Reglas de escritura (las revisa `tests/unit/fichas.test.ts`):
 * - Una ficha cuenta lo que se ve o está escrito en el objeto. No da pasos de cálculo ni
 *   nombra el concepto de la sala: eso lo hace el cuaderno después de resolver.
 * - Español de Colombia: `$1.600`, coma decimal, «comillas angulares».
 */

/** `presentar`, `torcer`, `dominar` y, al final, la sala ya resuelta. */
export const MOMENTOS = 4;

/** Un bloque se lee de un vistazo en un celular: textos cortos y tablas angostas. */
const texto = (max: number) => z.string().trim().min(1).max(max);

export const esquemaBloque = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('texto'), texto: texto(280) }),
  /** Algo escrito a mano o al margen: se ve distinto, pero se lee igual. */
  z.strictObject({ tipo: z.literal('nota'), texto: texto(280) }),
  z.strictObject({ tipo: z.literal('lista'), items: z.array(texto(120)).min(1).max(8) }),
  z.strictObject({
    tipo: z.literal('tabla'),
    titulo: texto(60),
    columnas: z.array(texto(24)).min(2).max(4),
    filas: z
      .array(z.array(texto(40)).min(2).max(4))
      .min(1)
      .max(8),
  }),
]);

const bloques = z.array(esquemaBloque).max(6);

export const esquemaFicha = z.strictObject({
  /** Id del objeto en `salas.json`. El título de la ficha es el `nombre` de ese objeto. */
  id: z.string().regex(/^(porteria|s[1-5])-[a-z0-9]+(-[a-z0-9]+)*$/),
  /** Qué es el objeto, en una frase. */
  descripcion: texto(160),
  /** Lo que se lee siempre. */
  bloques,
  /**
   * Lo que cambia con el avance de la sala, después de `bloques`: cuatro listas, una por
   * momento (`presentar`, `torcer`, `dominar`, sala resuelta). Solo en las salas 1 a 5.
   */
  por_etapa: z.tuple([bloques, bloques, bloques, bloques]).optional(),
});

export type BloqueFicha = z.infer<typeof esquemaBloque>;
export type FichaDeObjeto = z.infer<typeof esquemaFicha>;

// ---------- Reglas que el esquema no expresa ----------

const SALAS = datosSalas as unknown as readonly Sala[];

/** Acciones de un objeto que puede tener ficha: lo que se examina y los papeles que se recogen. */
const ACCIONES_CON_FICHA: readonly (string | undefined)[] = ['examinar', 'recoger'];

/** Problemas de una ficha: objeto que no existe, tabla descuadrada o ficha que queda vacía. */
export function problemasDeFicha(ficha: FichaDeObjeto): string[] {
  const problemas: string[] = [];
  const objeto = SALAS.flatMap((s) => s.objetos).find((o) => o.id === ficha.id);
  if (!objeto) problemas.push(`«${ficha.id}» no existe en salas.json`);
  else if (!ACCIONES_CON_FICHA.includes(objeto.accion)) {
    problemas.push(`«${ficha.id}» no se examina ni se recoge: no necesita ficha`);
  }
  if (ficha.por_etapa && ficha.id.startsWith('porteria-')) {
    problemas.push('la portería no tiene etapas: sobra «por_etapa»');
  }

  const momentos = ficha.por_etapa ?? [[]];
  momentos.forEach((extra, i) => {
    const todos = [...ficha.bloques, ...extra];
    if (todos.length === 0) problemas.push(`momento ${i}: la ficha queda sin bloques`);
    if (todos.length > 6) problemas.push(`momento ${i}: más de 6 bloques no caben en un celular`);
    for (const b of todos) {
      if (b.tipo !== 'tabla') continue;
      if (b.filas.some((f) => f.length !== b.columnas.length)) {
        problemas.push(`tabla «${b.titulo}»: cada fila debe tener ${b.columnas.length} celdas`);
      }
    }
  });
  return problemas;
}

/** Una ficha con sus reglas propias (la colección de Astro valida ficha por ficha). */
export const esquemaFichaValidada = esquemaFicha.superRefine((ficha, ctx) => {
  for (const mensaje of problemasDeFicha(ficha)) ctx.addIssue({ code: 'custom', message: mensaje });
});
