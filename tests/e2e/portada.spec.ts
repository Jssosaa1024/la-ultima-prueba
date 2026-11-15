import { expect, test } from '@playwright/test';

// T03b · La portada: título, la historia en una frase, «Jugar» grande y la guía para docentes.
// Pensada para un celular en horizontal: todo cabe en la pantalla sin desplazarse.

test('la portada muestra el título, la historia y lleva a jugar y a la guía', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'La Última Prueba' })).toBeVisible();
  await expect(page.getByText('feria de ciencias')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jugar' })).toHaveAttribute('href', '/jugar');
  await expect(page.getByRole('link', { name: 'Guía para docentes' })).toHaveAttribute(
    'href',
    '/docentes',
  );
  // Ya no queda nada de la demo de T01.
  await expect(page.getByRole('button', { name: /Toques/ })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('en un celular en horizontal todo cabe sin desplazarse y «Jugar» se toca fácil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/');

  const desborda = await page.evaluate(() => ({
    alto: document.documentElement.scrollHeight > window.innerHeight,
    ancho: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(desborda).toEqual({ alto: false, ancho: false });

  const jugar = await page.getByRole('link', { name: 'Jugar' }).boundingBox();
  const guia = await page.getByRole('link', { name: 'Guía para docentes' }).boundingBox();
  expect(jugar?.height ?? 0).toBeGreaterThanOrEqual(60);
  expect(guia?.height ?? 0).toBeGreaterThanOrEqual(44);
  // Los dos enlaces quedan dentro de la pantalla.
  for (const caja of [jugar, guia]) {
    expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(393);
  }
});

test('«Jugar» abre el juego', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Jugar' }).click();
  await expect(page).toHaveURL(/\/jugar\/?$/);
  await expect(page.getByLabel('Escena del juego')).toBeVisible();
});
