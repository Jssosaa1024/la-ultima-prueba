import { expect, test } from '@playwright/test';

// T35: vista de inspección 2D con los datos de ejemplo de la sala 1.

test.beforeEach(async ({ page }) => {
  await page.goto('/jugar?ejemplo=1');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
});

test('«Examinar» abre la ficha con los datos en texto y tabla', async ({ page }) => {
  await page.getByRole('button', { name: /^Examinar/ }).click();

  const dialogo = page.getByRole('dialog', { name: 'Factura de la caja' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toBeFocused();
  const tabla = dialogo.getByRole('table', { name: /Factura de venta/ });
  await expect(tabla.getByRole('columnheader', { name: 'Precio unitario' })).toBeVisible();
  await expect(tabla.getByRole('cell', { name: '$5.000' })).toBeVisible();
  // El HUD queda inerte detrás del panel.
  await expect(page.getByRole('timer')).toHaveCount(0);

  await dialogo.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole('timer')).toBeVisible();
  // El foco vuelve al botón contextual, no al principio de la página.
  await expect(page.getByRole('button', { name: /^Examinar/ })).toBeFocused();
});

test('Escape cierra la ficha', async ({ page }) => {
  await page.getByRole('button', { name: /^Examinar/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Examinar/ })).toBeFocused();
});

test('la ficha no hace scroll de la página en celular', async ({ page }) => {
  await page.getByRole('button', { name: /^Examinar/ }).click();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  // El segundo objeto (menú) tiene lista y nota al margen.
  await page.getByRole('button', { name: /^Examinar/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Menú de la cooperativa' });
  await expect(dialogo.getByRole('listitem').first()).toContainText('Refrigerio');
  await expect(dialogo).toContainText('Descuento de 15 %');
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(desborda).toBe(false);
});
