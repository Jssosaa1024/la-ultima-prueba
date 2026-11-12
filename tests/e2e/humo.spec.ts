import { expect, test } from '@playwright/test';

// Prueba de humo: las páginas cargan sin errores y lo esencial está a la vista.

test('la portada carga y enlaza a /jugar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'La Última Prueba' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jugar' })).toHaveAttribute('href', '/jugar');
});

test('/jugar muestra el canvas a pantalla completa, sin scroll y sin errores', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/jugar');

  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toBeVisible();

  const vista = page.viewportSize();
  const caja = await canvas.boundingBox();
  expect(vista).not.toBeNull();
  expect(caja).not.toBeNull();
  expect(Math.round(caja?.width ?? 0)).toBe(vista?.width);
  expect(Math.round(caja?.height ?? 0)).toBe(vista?.height);

  const desborda = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight,
  );
  expect(desborda).toBe(false);
  expect(errores).toEqual([]);
});

test('/jugar?sinwebgl2=1 muestra el aviso de equipo no compatible', async ({ page }) => {
  await page.goto('/jugar?sinwebgl2=1');
  await expect(
    page.getByRole('heading', { name: 'Este equipo no puede abrir el juego' }),
  ).toBeVisible();
  await expect(page.getByLabel('Escena del juego')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
});
