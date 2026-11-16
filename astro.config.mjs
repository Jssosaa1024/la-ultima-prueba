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
  integrations: [preact(), serviceWorker(), csp()],
});
