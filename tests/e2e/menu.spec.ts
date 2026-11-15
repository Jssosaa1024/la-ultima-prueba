import { expect, test } from '@playwright/test';

// T32: menú de inicio: jugar solo, crear partida y unirse con código.

test('/jugar abre el menú de inicio con «Jugar solo», «Crear partida» y «Unirse con código»', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/jugar');

  await expect(page.getByRole('heading', { name: 'La Última Prueba' })).toBeVisible();
  const jugar = page.getByRole('button', { name: 'Jugar solo' });
  await expect(jugar).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear partida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unirse con código' })).toBeVisible();

  // Objetivo táctil de al menos 44 px de alto.
  const caja = await jugar.boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(errores).toEqual([]);
});

test('«Jugar solo» cierra el menú y deja ver la escena', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByRole('heading', { name: 'La Última Prueba' })).toHaveCount(0);
  await expect(page.getByLabel('Escena del juego')).toBeVisible();
});
