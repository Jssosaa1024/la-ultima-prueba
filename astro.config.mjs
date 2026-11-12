// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Sitio 100 % estático (Cloudflare Pages, sin servidor). Ver AGENTS.md.
export default defineConfig({
  output: 'static',
  integrations: [preact()],
});
