// @ts-check
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig(
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'public/',
      'test-results/',
      'playwright-report/',
      // Copia generada del transcodificador Basis de three (T02b, `npm run basis-sin-eval`).
      'src/engine/carga/basis/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettier,
);
