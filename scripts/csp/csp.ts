import { createHash } from 'node:crypto';

/**
 * Política de seguridad de contenido (CSP, T02b). La política vive en `public/_headers`, sin
 * `'unsafe-inline'`. Astro deja unos pocos scripts y estilos en línea en el HTML (la isla del
 * juego, el registro del service worker y el CSS pequeño de cada página): al terminar el build
 * se calcula el hash SHA-256 de cada uno y se agrega a `script-src` y `style-src` en
 * `dist/_headers`. Si el HTML tiene algo en línea que un hash no puede cubrir (atributos
 * `on…=`, `style="…"` o enlaces `javascript:`), el build falla.
 *
 * Funciones puras: las usa la integración (`integracion.ts`) y las prueba Vitest.
 */

/** Nombre de la cabecera en `_headers`. */
export const CABECERA = 'Content-Security-Policy';

export interface EnLinea {
  scripts: string[];
  estilos: string[];
}

/** Hash en el formato de CSP: `'sha256-…'` (base64 del SHA-256 del texto exacto). */
export const hashCsp = (texto: string): string =>
  `'sha256-${createHash('sha256').update(texto, 'utf8').digest('base64')}'`;

/** Scripts y estilos en línea de una página (sin `src`), con su texto exacto. */
export function enLinea(html: string): EnLinea {
  const scripts: string[] = [];
  const estilos: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const atributos = m[1] ?? '';
    // Un script con `src` es un archivo: lo cubre 'self'. JSON de datos no se ejecuta.
    if (/\bsrc\s*=/i.test(atributos) || /type\s*=\s*["']?application\/(ld\+)?json/i.test(atributos))
      continue;
    scripts.push(m[2] ?? '');
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) estilos.push(m[1] ?? '');
  return { scripts, estilos };
}

/**
 * Lo que un hash no cubre: manejadores `on…=`, atributos `style="…"` y enlaces
 * `javascript:`. Con la política sin `'unsafe-inline'` el navegador los bloquearía.
 */
export function noCubiertos(html: string): string[] {
  // Fuera del texto de scripts y estilos, que pueden contener esas palabras sin problema.
  const marcado = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const hallados = new Set<string>();
  for (const m of marcado.matchAll(/<[a-z][^>]*?\s(on[a-z]+)\s*=/gi)) hallados.add(`${m[1]}=`);
  if (/<[a-z][^>]*?\sstyle\s*=/i.test(marcado)) hallados.add('style=');
  if (/(?:href|src|action)\s*=\s*["']?\s*javascript:/i.test(marcado)) hallados.add('javascript:');
  return [...hallados].sort();
}

/** La política de `/*` en un `_headers` (o `null` si no está). */
export function leerPolitica(headers: string): string | null {
  let enTodo = false;
  for (const linea of headers.split(/\r?\n/)) {
    if (/^\S/.test(linea)) enTodo = linea.trim() === '/*';
    else if (enTodo) {
      const m = linea.match(/^\s+Content-Security-Policy:\s*(.+)$/i);
      if (m?.[1]) return m[1].trim();
    }
  }
  return null;
}

/** Agrega fuentes a una directiva de la política, sin repetir. Falla si la directiva no está. */
export function agregarFuentes(politica: string, directiva: string, fuentes: readonly string[]) {
  const partes = politica.split(';').map((p) => p.trim());
  const i = partes.findIndex((p) => p.split(/\s+/)[0] === directiva);
  if (i < 0) throw new Error(`La CSP no tiene ${directiva}`);
  const actuales = (partes[i] ?? '').split(/\s+/);
  const nuevas = [...new Set(fuentes)].filter((f) => !actuales.includes(f)).sort();
  partes[i] = [...actuales, ...nuevas].join(' ');
  return partes.filter((p) => p !== '').join('; ');
}

/**
 * La política con los hashes de lo que hay en línea en todas las páginas. `script-src` y
 * `style-src` deben estar escritas en `public/_headers`.
 */
export function politicaConHashes(politica: string, paginas: readonly EnLinea[]): string {
  const scripts = paginas.flatMap((p) => p.scripts.map(hashCsp));
  const estilos = paginas.flatMap((p) => p.estilos.map(hashCsp));
  return agregarFuentes(agregarFuentes(politica, 'script-src', scripts), 'style-src', estilos);
}

/** El `_headers` con la política de `/*` reemplazada. */
export function reemplazarPolitica(headers: string, politica: string): string {
  if (leerPolitica(headers) === null) throw new Error('_headers no tiene la CSP de /*');
  let enTodo = false;
  return headers
    .split('\n')
    .map((linea) => {
      if (/^\S/.test(linea)) enTodo = linea.trim() === '/*';
      else if (enTodo && /^\s+Content-Security-Policy:/i.test(linea)) {
        return `  ${CABECERA}: ${politica}`;
      }
      return linea;
    })
    .join('\n');
}
