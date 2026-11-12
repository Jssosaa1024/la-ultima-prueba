import { defineConfig, devices } from '@playwright/test';

// PUERTO_E2E permite correr dos sesiones de pruebas a la vez en el mismo equipo sin chocar.
const PUERTO = Number(process.env['PUERTO_E2E'] ?? 4321);

// Pruebas e2e con emulación de celular (especificación, T05). Se prueba el sitio ya
// construido (`astro build` + `astro preview`), que es lo que se publica en Cloudflare Pages.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    // Las trazas cuestan CPU; para depurar un fallo: `npx playwright test --trace on`.
    trace: 'off',
  },
  projects: [
    // Celular de gama media-baja con pantalla pequeña (el juego es celular primero).
    { name: 'celular', use: { ...devices['Pixel 5'] } },
    // Soporte secundario: teclado y ratón.
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
