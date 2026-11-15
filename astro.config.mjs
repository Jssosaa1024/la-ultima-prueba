// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import serviceWorker from './scripts/pwa/integracion.ts';

// Sitio 100 % estático (Cloudflare Pages, sin servidor). Ver AGENTS.md.
// `serviceWorker` escribe dist/sw.js al terminar el build (T94).
export default defineConfig({
  output: 'static',
  integrations: [preact(), serviceWorker()],
});
