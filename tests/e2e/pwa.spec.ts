import { devices, expect, test } from '@playwright/test';

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
  async function listo(page: import('@playwright/test').Page): Promise<string[]> {
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return r?.active?.state === 'activated' && navigator.serviceWorker.controller !== null;
    });
    return page.evaluate(() => caches.keys());
  }

  test('guarda el núcleo y el juego abre sin conexión', async ({ page, context }) => {
    await page.goto('/jugar');
    const cachesGuardadas = await listo(page);
    expect(cachesGuardadas.some((n) => n.startsWith('nucleo-'))).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Jugar' })).toBeVisible();
    await context.setOffline(false);
  });

  test('una versión nueva reemplaza la caché vieja y la partida guardada sigue', async ({
    page,
    context,
  }) => {
    await page.goto('/jugar');
    const antes = await listo(page);
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('la-ultima-prueba:partida') !== null))
      .toBe(true);

    // Un build nuevo: el mismo sw.js con otra versión.
    await context.route('**/sw.js', async (route) => {
      const r = await route.fetch();
      const texto = (await r.text()).replace(/"version":"[0-9a-f]+"/, '"version":"nueva"');
      await route.fulfill({ response: r, body: texto });
    });
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r?.update();
    });
    // La versión nueva espera mientras la pestaña con la partida siga abierta.
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return r?.waiting !== null && r?.waiting !== undefined;
    });
    expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(antes));

    // Al cerrar la pestaña y volver, entra la versión nueva y la vieja se borra.
    await page.close();
    const otra = await context.newPage();
    await otra.goto('/jugar');
    await expect
      .poll(() => otra.evaluate(() => caches.keys()))
      .toEqual(expect.arrayContaining(['nucleo-nueva']));
    const ahora = await otra.evaluate(() => caches.keys());
    expect(ahora.filter((n) => n.startsWith('nucleo-'))).toEqual(['nucleo-nueva']);
    await expect(otra.getByRole('button', { name: 'Continuar partida' })).toBeVisible();
  });
});
