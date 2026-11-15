import { defineConfig } from 'vitest/config';

// Tests de unidad: solo lógica sin navegador. Los e2e van en tests/e2e con Playwright.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Varias sesiones prueban a la vez en el mismo equipo: 5 s no alcanzan para las pruebas que
    // lanzan un proceso o cargan wasm (check-credits, optimize-models).
    testTimeout: 20_000,
  },
});
