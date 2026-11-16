import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  CABECERA,
  enLinea,
  leerPolitica,
  noCubiertos,
  politicaConHashes,
  reemplazarPolitica,
  type EnLinea,
} from './csp';

/**
 * CSP del sitio (T02b), como integración de Astro:
 *
 * - `astro build`: al terminar, agrega a `dist/_headers` los hashes de los scripts y estilos en
 *   línea de todas las páginas (Cloudflare Pages sirve ese archivo). Si una página tiene algo en
 *   línea que un hash no cubre, el build falla y dice dónde.
 * - `astro preview`: envía la misma cabecera, así las e2e prueban el sitio con la CSP real.
 * - `astro dev` no la usa: Vite necesita scripts en línea para recargar en caliente.
 */

/** Todas las páginas `.html` de `dist/`. */
async function paginas(raiz: string): Promise<string[]> {
  const entradas = await readdir(raiz, { withFileTypes: true, recursive: true });
  return entradas
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

/** Agrega los hashes a `dist/_headers` y devuelve la política final. */
export async function escribirCsp(raiz: string): Promise<{ politica: string; paginas: number }> {
  const archivo = path.join(raiz, '_headers');
  const headers = await readFile(archivo, 'utf8');
  const base = leerPolitica(headers);
  if (!base) throw new Error('public/_headers no tiene la CSP de /* (T02b)');
  const lista: EnLinea[] = [];
  const problemas: string[] = [];
  for (const pagina of await paginas(raiz)) {
    const html = await readFile(pagina, 'utf8');
    lista.push(enLinea(html));
    const malos = noCubiertos(html);
    if (malos.length > 0) problemas.push(`${path.relative(raiz, pagina)}: ${malos.join(', ')}`);
  }
  if (problemas.length > 0) {
    throw new Error(
      `La CSP no permite esto en línea (usa una clase o un archivo):\n  ${problemas.join('\n  ')}`,
    );
  }
  const politica = politicaConHashes(base, lista);
  await writeFile(archivo, reemplazarPolitica(headers, politica));
  return { politica, paginas: lista.length };
}

/** La política de `dist/_headers`, si ya hay un build. */
function politicaDelBuild(raiz: string): string | null {
  const archivo = path.join(raiz, '_headers');
  return existsSync(archivo) ? leerPolitica(readFileSync(archivo, 'utf8')) : null;
}

export default function csp(): AstroIntegration {
  return {
    name: 'la-ultima-prueba:csp',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig, logger }) => {
        if (command !== 'preview') return;
        const politica = politicaDelBuild(fileURLToPath(config.outDir));
        if (!politica) {
          logger.warn('Sin dist/_headers: astro preview va sin CSP');
          return;
        }
        updateConfig({ server: { headers: { [CABECERA]: politica } } });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const { politica, paginas } = await escribirCsp(fileURLToPath(dir));
        const hashes = politica.match(/'sha256-/g)?.length ?? 0;
        logger.info(`CSP en _headers: ${hashes} hashes de ${paginas} páginas`);
      },
    },
  };
}
