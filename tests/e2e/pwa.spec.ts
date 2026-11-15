import { devices, expect, test, type BrowserContext, type Page } from '@playwright/test';

// T95: manifiesto e iconos de la app instalada, y la sugerencia de instalar en iPhone.

test('las páginas enlazan el manifiesto y el icono del iPhone, y ambos cargan', async ({
  page,
  request,
}) => {
  for (const ruta of ['/', '/jugar']) {
    await page.goto(ruta);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes',
    );
  }
  const manifiesto = await request.get('/manifest.webmanifest');
  expect(manifiesto.ok()).toBe(true);
  const datos = (await manifiesto.json()) as { icons: { src: string }[] };
  for (const src of [...datos.icons.map((i) => i.src), '/iconos/icono-180.png']) {
    const r = await request.get(src);
    expect(r.ok(), src).toBe(true);
    expect(r.headers()['content-type']).toContain('image/png');
  }
});

test('en Android el menú no sugiere «Agregar a inicio»', async ({ page }) => {
  await page.goto('/jugar');
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(page.getByText('Agregar a inicio', { exact: false })).toHaveCount(0);
});

test.describe('en iPhone', () => {
  test.use({ userAgent: devices['iPhone 13 landscape'].userAgent });

  test('el menú sugiere agregar el juego a la pantalla de inicio', async ({ page }) => {
    await page.goto('/jugar');
    await expect(page.getByText(/toca Compartir y luego «Agregar a inicio»/)).toBeVisible();
  });
});

// T94: service worker propio. Las demás pruebas lo bloquean (playwright.config.ts).
test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  /** Espera a que el service worker controle la página y termine de guardar el núcleo. */
  async function listo(page: Page): Promise<string[]> {
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const r = await navigator.serviceWorker.getRegistration();
          return r?.active?.state === 'activated' && navigator.serviceWorker.controller !== null;
        }),
      )
      .toBe(true);
    return page.evaluate(() => caches.keys());
  }

  /**
   * Sin red: toda petición que salga a la red (también las del service worker) falla. Así la
   * página solo puede salir de la caché del service worker.
   */
  async function sinRed(context: BrowserContext): Promise<void> {
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
  }

  test('guarda el núcleo y el juego abre sin conexión', async ({ page, context }) => {
    await page.goto('/jugar');
    const cachesGuardadas = await listo(page);
    expect(cachesGuardadas.some((n) => n.startsWith('nucleo-'))).toBe(true);

    await sinRed(context);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Jugar' })).toBeVisible();
  });

  // Que una versión nueva reemplace a la vieja lo prueban las pruebas de unidad
  // (`service-worker.test.ts`): Playwright no deja cambiar el sw.js que el navegador revisa.
  test('con el service worker, la partida guardada sigue al recargar', async ({ page }) => {
    await page.goto('/jugar');
    await listo(page);
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('la-ultima-prueba:partida') !== null))
      .toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Continuar partida' })).toBeVisible();
  });
});
