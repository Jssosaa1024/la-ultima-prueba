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
