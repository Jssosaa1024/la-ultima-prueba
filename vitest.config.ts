import { defineConfig } from 'vitest/config';

// Tests de unidad: solo lógica sin navegador. Los e2e van en tests/e2e con Playwright.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
