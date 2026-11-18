// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import serviceWorker from './scripts/pwa/integracion.ts';
import csp from './scripts/csp/integracion.ts';

// Sitio 100 % estático (Cloudflare Pages, sin servidor). Ver AGENTS.md.
// `serviceWorker` escribe dist/sw.js al terminar el build (T94).
// `csp` agrega a dist/_headers los hashes de lo que queda en línea y la usa en preview (T02b).
export default defineConfig({
  output: 'static',
  // URL pública (T41h): Open Graph necesita la imagen para compartir con URL absoluta.
  // Si el sitio pasa a un dominio propio (docs/lanzamiento.md), se cambia aquí.
  site: 'https://la-ultima-prueba-duz.pages.dev',
  integrations: [preact(), serviceWorker(), csp()],
});
