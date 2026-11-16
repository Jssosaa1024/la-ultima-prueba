/**
 * Lista de lo que se publica desde los paquetes de `art/` (T11a): `art/modelos.json`.
 *
 * Cada entrada dice qué archivo de `public/assets/salas/` se arma y de dónde sale:
 *
 * - Un modelo (`.glb`) se arma con una o más `piezas` de un paquete, cada una con su posición
 *   y su giro (en las unidades del paquete), más un `estirar` por eje o una `caja` en metros
 *   opcionales para acercar sus proporciones a la caja del objeto en `salas.json`. El motor
 *   lo ajusta después a esa caja sin deformarlo (T19e).
 * - Una textura (`.ktx2`) sale de una sola imagen.
 *
 * El `original` es la ruta de un archivo de `art/`, o de un archivo dentro de un zip de `art/`
 * con `#`: `art/compartido/originales/kenney-furniture-kit/kenney_furniture-kit.zip#Models/GLTF format/desk.glb`.
 * Los zips se leen sin descomprimirlos en el repositorio: el original no se toca.
 *
 * La licencia y la `fuente` (que elige el perfil de limpieza) siguen en `art/credits.json`.
 */
import { readFile } from 'node:fs/promises';
import { z } from 'astro/zod';

export const LISTA_MODELOS = 'art/modelos.json';

/** Carpetas de `public/assets/salas/`: los lugares del juego y `compartido`. */
const CARPETA = '(porteria|s[1-5]-[a-z]+|compartido)';
const NOMBRE = '[a-z0-9]+(-[a-z0-9]+)*';
export const ARCHIVO_MODELO = new RegExp(`^public/assets/salas/${CARPETA}/${NOMBRE}\\.glb$`);
export const ARCHIVO_TEXTURA = new RegExp(`^public/assets/salas/${CARPETA}/${NOMBRE}\\.ktx2$`);

/** `art/...` sin `..` ni `\`, con una ruta interna opcional tras `#`. */
const ORIGINAL = /^art\/(?:[^\\#/.][^\\#/]*\/)*[^\\#/]+?(?:#(?:[^\\#/.][^\\#/]*\/)*[^\\#/]+)?$/;

const original = z
  .string()
  .regex(ORIGINAL, 'Original: art/<carpeta>/<archivo>, o art/<...>.zip#<ruta dentro del zip>')
  .refine((r) => !r.split(/[/#]/).includes('..'), 'El original no puede salir de art/');

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const positivo = z.number().positive().max(10);

const pieza = z.strictObject({
  original,
  /** Posición de la pieza, en unidades del paquete. */
  pos: vec3.optional(),
  /** Giro alrededor del eje vertical, en grados. */
  giro: z.number().min(-360).max(360).optional(),
});

export const esquemaEntradaModelo = z
  .strictObject({
    archivo: z.string().regex(ARCHIVO_MODELO, 'public/assets/salas/<carpeta>/<nombre>.glb'),
    piezas: z.array(pieza).min(1).max(16),
    /** Giro de todo el modelo, en grados, para que su frente mire a +Z como la primitiva. */
    giro: z.number().min(-360).max(360).optional(),
    /** Factor por eje (x, y, z) después de pasar a metros: acerca las proporciones a la caja. */
    estirar: z.tuple([positivo, positivo, positivo]).optional(),
    /**
     * Medidas finales en metros (ancho, alto, fondo), las de `tam` en `salas.json`: el perfil
     * estira cada eje para calzar justo. `null` en un eje = proporcional (el fondo de un plano).
     */
    caja: z.tuple([positivo.nullable(), positivo.nullable(), positivo.nullable()]).optional(),
    /** Por qué se eligió así (se lee en el PR, no lo usa el script). */
    nota: z.string().max(300).optional(),
  })
  .refine((e) => !(e.estirar && e.caja), 'Usa «estirar» o «caja», no los dos');

export const esquemaEntradaTextura = z.strictObject({
  archivo: z.string().regex(ARCHIVO_TEXTURA, 'public/assets/salas/<carpeta>/<nombre>.ktx2'),
  original,
  nota: z.string().max(300).optional(),
});

export const esquemaLista = z
  .array(z.union([esquemaEntradaModelo, esquemaEntradaTextura]))
  .superRefine((lista, ctx) => {
    const vistos = new Set<string>();
    lista.forEach((e, i) => {
      if (vistos.has(e.archivo)) {
        ctx.addIssue({ code: 'custom', path: [i, 'archivo'], message: `Repetido: ${e.archivo}` });
      }
      vistos.add(e.archivo);
    });
  });

export type EntradaModelo = z.infer<typeof esquemaEntradaModelo>;
export type EntradaTextura = z.infer<typeof esquemaEntradaTextura>;
export type EntradaLista = EntradaModelo | EntradaTextura;

export const esModelo = (e: EntradaLista): e is EntradaModelo => 'piezas' in e;

/** Separa `art/x.zip#ruta/interna.glb` en el zip y la ruta interna (`null` si no es un zip). */
export function partirOriginal(ruta: string): { archivo: string; interna: string | null } {
  const i = ruta.indexOf('#');
  return i < 0
    ? { archivo: ruta, interna: null }
    : { archivo: ruta.slice(0, i), interna: ruta.slice(i + 1) };
}

/** La carpeta de `public/assets/salas/` de una entrada: `porteria`, `s1-cooperativa`… */
export const carpetaDe = (archivo: string): string => archivo.split('/')[3] ?? '';

/** Lee y valida la lista. Falla con un mensaje claro si está mal escrita. */
export async function leerLista(archivo = LISTA_MODELOS): Promise<EntradaLista[]> {
  const texto = await readFile(archivo, 'utf8');
  const r = esquemaLista.safeParse(JSON.parse(texto));
  if (!r.success) {
    const detalle = r.error.issues.map((p) => `  - [${p.path.join('.')}] ${p.message}`);
    throw new Error(`${archivo} no cumple el esquema:\n${detalle.join('\n')}`);
  }
  return r.data;
}
