/**
 * Esquema de `art/credits.json` (T11g): una entrada por cada archivo publicado bajo
 * `public/assets/salas/` y `public/assets/audio/`.
 *
 * La forma sigue la especificación v1.1 («Créditos y licencias»). El esquema solo revisa la
 * FORMA de cada entrada; las reglas de licencia (qué se puede publicar) las aplica
 * `check-credits` en `reglas.ts`, para que el mensaje diga exactamente qué falla.
 *
 * Anotar la licencia es manual, un minuto por asset el día de la descarga: copiar los datos
 * de la página del asset y guardar la captura de su licencia en `art/evidencia/`.
 */
import { z } from 'astro/zod';

export const TIPOS = ['modelo', 'textura', 'imagen', 'audio', 'voz'] as const;

/**
 * De dónde sale el asset. Elige el perfil de limpieza de `optimize-models` (T11a).
 * `tripo` está para poder rechazarlo con un mensaje claro si llega en plan gratis.
 */
export const FUENTES = [
  'kenney',
  'meshy',
  'tripo',
  'sketchfab',
  'polyhaven',
  'ambientcg',
  'ia-imagen',
  'freesound',
  'elevenlabs',
  'codigo',
  'propio',
] as const;
export type Fuente = (typeof FUENTES)[number];

/** Dónde se usa: la portería, una sala o en varias (`compartido`). */
export const SALAS_CREDITO = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
  'compartido',
] as const;

/** Licencias que se pueden publicar (especificación v1.1 y AGENTS.md). */
export const LICENCIAS_PERMITIDAS = [
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-3.0',
  'propio',
  'meshy-pago',
  'tripo-pago',
  'elevenlabs-pago',
  'openai',
] as const;

/** Texto corto, sin saltos de línea: va en la página de créditos y dentro del GLB. */
const linea = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\r\n]*$/, 'sin saltos de línea');

/** Solo enlaces https: la página de créditos los pone en un `href`. */
const enlace = z
  .string()
  .max(500)
  .regex(/^https:\/\/[^\s"'<>]+$/, 'un enlace https sin espacios ni comillas');

export const esquemaCredito = z.strictObject({
  /**
   * El archivo publicado, sin el hash que le pone `build-manifest`:
   * `public/assets/salas/s3-gimnasio/graderia.glb` vale para `graderia.1a2b3c4d.glb`.
   */
  archivo: z
    .string()
    .regex(
      /^public\/assets\/(salas|audio)(\/[A-Za-z0-9-]+)+\/[a-z0-9-]+\.[a-z0-9]+$/,
      'ruta bajo public/assets/salas/ o public/assets/audio/, nombre en minúsculas y sin hash',
    ),
  sala: z.enum(SALAS_CREDITO),
  tipo: z.enum(TIPOS),
  titulo: linea(120),
  /** Obligatorio en CC BY. En Meshy con plan gratis, «Meshy». */
  autor: linea(120).nullable(),
  fuente: z.enum(FUENTES),
  /** La página del asset. Obligatoria en CC BY. */
  url: enlace.nullable(),
  /** Se revisa en `check-credits` contra `LICENCIAS_PERMITIDAS`. */
  licencia: linea(60),
  licencia_url: enlace.nullable(),
  /** Qué se le cambió al original. Obligatorio en CC BY: la licencia exige indicarlo. */
  cambios: linea(300).nullable(),
  /** Día de la descarga o de la generación. */
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha AAAA-MM-DD'),
  /** Plan activo el día de la generación: obligatorio en Meshy, Tripo y ElevenLabs. */
  plan: z.enum(['gratis', 'pago']).nullable(),
  /** Para lo generado con IA: el prompt o el texto que se usó. */
  prompt: z.string().trim().min(1).max(2000).optional(),
  /** Captura de la licencia: `art/evidencia/<nombre>.png|jpg|webp|pdf`. */
  evidencia: z
    .string()
    .regex(
      /^art\/evidencia\/[a-z0-9-]+\.(png|jpg|jpeg|webp|pdf)$/,
      'un archivo de art/evidencia/ en minúsculas',
    )
    .nullable(),
});

export type Credito = z.infer<typeof esquemaCredito>;

export const esquemaCreditos = z.array(esquemaCredito);
