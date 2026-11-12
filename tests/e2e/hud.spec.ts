import { expect, test } from '@playwright/test';

// T33: HUD con reloj, sellos, inventario y botón contextual (con datos de ejemplo).

test('el HUD muestra reloj, sellos e inventario al empezar', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();

  const reloj = page.getByRole('timer');
  // Puede haber pasado algún segundo si el equipo está lento: basta con 3x:xx o 40:00.
  await expect(reloj).toHaveAttribute('aria-label', /^Tiempo restante: (40|3\d) minutos/);
  await expect(reloj).toHaveText(/^(40:00|3\d:\d\d)$/);
  await expect(page.getByRole('img', { name: 'Sellos: 0 de 5' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Inventario' })).toContainText('Linterna');
  // Sin objeto enfocado no hay botón contextual.
  await expect(page.getByRole('button', { name: /^(Usar|Recoger|Examinar)/ })).toHaveCount(0);
});

test('con ?ejemplo=1 aparece el botón contextual y recoger llena el inventario', async ({
  page,
}) => {
  await page.goto('/jugar?ejemplo=1');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByRole('img', { name: 'Sellos: 1 de 5' })).toBeVisible();

  const accion = page.getByRole('button', { name: /^Examinar/ });
  await expect(accion).toContainText('Factura de la caja');
  await expect
    .poll(async () => (await accion.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
});

test('«Salir» pide confirmación y vuelve al menú', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
});
