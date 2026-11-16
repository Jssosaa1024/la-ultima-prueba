/**
 * Reglas de licencia de `check-credits` (T11h) y texto de `asset.copyright` (T11g).
 *
 * Funciones puras: reciben las entradas de `art/credits.json`, la lista de archivos
 * publicados y la de capturas de licencia, y dicen qué impide publicar. El build falla si:
 *
 * - un archivo bajo `public/assets/salas/` o `public/assets/audio/` no tiene entrada;
 * - la licencia es NC o ND, es Freesound con Sampling+ o no está en la lista permitida;
 * - es de Quaternius (su licencia QAL prohíbe redistribuir los assets; ola 6);
 * - es Tripo o ElevenLabs con plan gratis (o les falta el plan, igual que a Meshy);
 * - es CC BY sin autor, URL, cambios o enlace a la licencia;
 * - es Meshy con plan gratis y el autor no es «Meshy»;
 * - falta la captura de la licencia donde es obligatoria (Sketchfab, Meshy y ElevenLabs) o
 *   la captura anotada no existe en `art/evidencia/`.
 */
import path from 'node:path';
import { separarHash } from '../manifiesto/construir.ts';
import { esquemaCreditos, LICENCIAS_PERMITIDAS, type Credito, type Fuente } from './esquema.ts';

/** Fuentes cuya licencia depende del plan activo el día de la generación. */
const CON_PLAN: readonly Fuente[] = ['meshy', 'tripo', 'elevenlabs'];
/** Fuentes que exigen la captura de la licencia del día de la descarga. */
const CON_EVIDENCIA: readonly Fuente[] = ['sketchfab', 'meshy', 'elevenlabs'];
/** Fuentes de IA: se anota el prompt (o el texto, en la voz). */
const CON_PROMPT: readonly Fuente[] = ['meshy', 'tripo', 'ia-imagen', 'elevenlabs'];

/** Licencias que solo valen con una fuente. */
const LICENCIA_DE_FUENTE: Readonly<Record<string, readonly Fuente[]>> = {
  'meshy-pago': ['meshy'],
  'tripo-pago': ['tripo'],
  'elevenlabs-pago': ['elevenlabs'],
  openai: ['ia-imagen'],
  propio: ['propio', 'codigo'],
};

/** Partes de una licencia: `CC-BY-NC-4.0` → `CC`, `BY`, `NC`, `4`, `0`. */
const partes = (licencia: string): string[] => licencia.toUpperCase().split(/[^A-Z0-9+]+/);

export const esCcBy = (licencia: string): boolean => /^CC-BY-\d\.\d$/.test(licencia);

/** Problemas de una entrada sola. `evidencias` son las capturas que existen en el disco. */
export function problemasDeCredito(c: Credito, evidencias: ReadonlySet<string>): string[] {
  const p: string[] = [];
  const decir = (mensaje: string): void => {
    p.push(`${c.archivo}: ${mensaje}`);
  };
  const trozos = partes(c.licencia);

  // Licencia
  if (trozos.includes('NC')) decir(`la licencia ${c.licencia} es no comercial (NC)`);
  if (trozos.includes('ND')) decir(`la licencia ${c.licencia} no permite modificar (ND)`);
  if (trozos.some((t) => t.startsWith('SAMPLING'))) {
    decir('Sampling+ se trata como no comercial: solo CC0 o CC BY');
  }
  const permitida = (LICENCIAS_PERMITIDAS as readonly string[]).includes(c.licencia);
  if (!permitida && p.length === 0) {
    decir(`la licencia «${c.licencia}» no está en la lista: ${LICENCIAS_PERMITIDAS.join(', ')}`);
  }
  const soloCon = LICENCIA_DE_FUENTE[c.licencia];
  if (soloCon && !soloCon.includes(c.fuente)) {
    decir(`la licencia ${c.licencia} no corresponde a la fuente ${c.fuente}`);
  }
  if (c.fuente === 'freesound' && permitida && !(c.licencia === 'CC0-1.0' || esCcBy(c.licencia))) {
    decir('de Freesound solo se publica CC0 o CC BY');
  }
  if (c.fuente === 'quaternius') {
    decir(
      'Quaternius no se usa (decisión del 16-11-2026): su licencia QAL prohíbe redistribuir los assets y el repositorio es público',
    );
  }

  // Plan
  if (CON_PLAN.includes(c.fuente) && c.plan === null) {
    decir(`falta «plan» (gratis o pago): la licencia de ${c.fuente} depende del plan de ese día`);
  }
  if ((c.fuente === 'tripo' || c.fuente === 'elevenlabs') && c.plan === 'gratis') {
    decir(
      `${c.fuente} en plan gratis no permite uso comercial: hay que regenerarlo con plan de pago`,
    );
  }
  if (c.fuente === 'meshy' && c.plan === 'gratis') {
    if (c.licencia !== 'CC-BY-4.0') decir('Meshy en plan gratis es CC-BY-4.0');
    if (c.autor !== 'Meshy') decir('Meshy en plan gratis exige el crédito: autor «Meshy»');
  }
  if (c.fuente === 'meshy' && c.plan === 'pago' && c.licencia !== 'meshy-pago') {
    decir('Meshy en plan de pago se anota como meshy-pago');
  }

  // Atribución CC BY
  if (esCcBy(c.licencia)) {
    if (!c.autor) decir('CC BY exige el autor');
    if (!c.url) decir('CC BY exige la URL del original');
    if (!c.cambios) decir('CC BY exige indicar los cambios');
    if (!c.licencia_url) decir('CC BY exige el enlace a la licencia');
  }

  // Evidencia y prompt
  if (CON_EVIDENCIA.includes(c.fuente) && c.evidencia === null) {
    decir(`falta la captura de la licencia en art/evidencia/ (obligatoria para ${c.fuente})`);
  }
  if (c.evidencia !== null && !evidencias.has(c.evidencia)) {
    decir(`no existe la captura ${c.evidencia}`);
  }
  if (CON_PROMPT.includes(c.fuente) && !c.prompt) {
    decir('falta el prompt con que se generó');
  }

  if (Number.isNaN(Date.parse(`${c.fecha}T00:00:00Z`))) decir(`la fecha ${c.fecha} no existe`);
  return p;
}

/**
 * El nombre con el que se anota un archivo publicado: sin el hash de `build-manifest`.
 * `public/assets/salas/s1-cooperativa/escena.1a2b3c4d.glb` → `…/escena.glb`.
 */
export function sinHash(archivo: string): string {
  const { base, ext } = separarHash(path.posix.basename(archivo));
  return path.posix.join(path.posix.dirname(archivo), `${base}${ext}`);
}

export interface Revision {
  problemas: string[];
  /** Entradas sin archivo publicado todavía: no fallan, pero conviene saberlo. */
  avisos: string[];
  creditos: Credito[];
}

/**
 * Revisa el manifiesto completo.
 * @param crudo el contenido de `art/credits.json`, ya leído como JSON
 * @param publicados archivos bajo `public/assets/salas/` y `public/assets/audio/`, con `/`
 * @param evidencias capturas que existen, como `art/evidencia/graderia.png`
 */
export function revisarCreditos(
  crudo: unknown,
  publicados: readonly string[],
  evidencias: ReadonlySet<string>,
): Revision {
  const leido = esquemaCreditos.safeParse(crudo);
  if (!leido.success) {
    return {
      problemas: leido.error.issues.map((i) => {
        const donde = i.path.length > 0 ? `[${i.path.join('.')}] ` : '';
        return `art/credits.json ${donde}${i.message}`;
      }),
      avisos: [],
      creditos: [],
    };
  }
  const creditos = leido.data;
  const problemas: string[] = [];

  const vistos = new Set<string>();
  for (const c of creditos) {
    if (vistos.has(c.archivo)) problemas.push(`${c.archivo}: tiene dos entradas`);
    vistos.add(c.archivo);
    problemas.push(...problemasDeCredito(c, evidencias));
  }

  const anotados = new Set(publicados.map(sinHash));
  for (const archivo of publicados) {
    if (!vistos.has(sinHash(archivo))) {
      problemas.push(`${archivo}: no tiene entrada en art/credits.json`);
    }
  }
  const avisos = creditos
    .filter((c) => !anotados.has(c.archivo))
    .map((c) => `${c.archivo}: tiene entrada, pero no está publicado`);
  return { problemas, avisos, creditos };
}

/** Cómo se escribe cada licencia en el crédito. */
const NOMBRE_LICENCIA: Readonly<Record<string, string>> = {
  'CC0-1.0': 'CC0 1.0',
  'CC-BY-4.0': 'CC BY 4.0',
  'CC-BY-3.0': 'CC BY 3.0',
  propio: 'La Última Prueba',
  'meshy-pago': 'generado con Meshy (plan de pago)',
  'tripo-pago': 'generado con Tripo (plan de pago)',
  'elevenlabs-pago': 'voz generada con ElevenLabs (plan de pago)',
  openai: 'imagen generada con OpenAI',
};

/**
 * El crédito que viaja dentro del GLB (`asset.copyright`): título, autor, página del
 * original, licencia con su enlace y si se modificó. Por ejemplo:
 * `“Bleachers”, autora, https://sketchfab.com/…, CC BY 4.0 https://creativecommons.org/…, modificado`.
 */
export function textoCopyright(c: Credito): string {
  const licencia = [NOMBRE_LICENCIA[c.licencia] ?? c.licencia, c.licencia_url]
    .filter(Boolean)
    .join(' ');
  return [`“${c.titulo}”`, c.autor, c.url, licencia, c.cambios ? 'modificado' : null]
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .join(', ');
}

/** La entrada de un archivo (con o sin hash en el nombre), o `null`. */
export function creditoDe(creditos: readonly Credito[], archivo: string): Credito | null {
  const buscado = sinHash(archivo.split(path.sep).join('/'));
  return creditos.find((c) => c.archivo === buscado) ?? null;
}
