import { expect, test } from '@playwright/test';

// T99 · Guía para docentes: carga, muestra las cinco salas con proceso y grado, cuenta qué
// datos guarda y se lee en un celular sin desplazarse a los lados.

test('la guía para docentes muestra las cinco salas con proceso y grado', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/docentes');

  await expect(page).toHaveTitle('Guía para docentes · La Última Prueba');
  await expect(page.getByRole('heading', { level: 1, name: 'Guía para docentes' })).toBeVisible();
  for (const seccion of [
    'Qué es',
    'Para quién es',
    'Cuánto dura',
    'Qué matemática trabaja cada sala',
    'Cómo usarlo en clase',
    'Qué datos guarda',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: seccion })).toBeVisible();
  }

  const salas = page.locator('.sala');
  await expect(salas).toHaveCount(5);
  await expect(salas.nth(0)).toContainText('Sala 1 · La cooperativa: La etiquetadora');
  await expect(salas.nth(0)).toContainText('El porcentaje como multiplicador');
  await expect(salas.nth(0)).toContainText('Formular, comparar y ejercitar procedimientos');
  await expect(salas.nth(4)).toContainText('Probabilidad sin reemplazo');
  await expect(salas.nth(4)).toContainText('10°');

  // T99b: el cooperativo ya no figura como «en construcción».
  await expect(page.locator('body')).toContainText('de 2 a 4 estudiantes en el mismo salón');
  await expect(page.locator('body')).toContainText('«Unirse con código»');
  await expect(page.locator('body')).not.toContainText(/en construcción/i);

  await expect(page.getByText('Ningún dato personal.')).toBeVisible();
  expect(errores).toEqual([]);
});

test('la guía no nombra el ICFES ni el Saber 11', async ({ page }) => {
  await page.goto('/docentes');
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(/icfes|saber\s*11/i);
});

test('la guía se lee sin desplazarse a los lados y sus enlaces se tocan bien', async ({ page }) => {
  await page.goto('/docentes');
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(desborda).toBe(false);

  const jugar = page.getByRole('link', { name: 'Probar el juego' }).first();
  await expect(jugar).toHaveAttribute('href', '/jugar');
  const caja = await jugar.boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('link', { name: 'Volver a la portada' }).first()).toHaveAttribute(
    'href',
    '/',
  );
});
