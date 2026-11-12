import { expect, test } from '@playwright/test';

// T40: pantallas de final, créditos y poscréditos (con ?ejemplo=1&final=<id>).

const FINALES = [
  ['justo_a_tiempo', 'Justo a tiempo'],
  ['el_legado', 'El legado'],
  ['pedir_ayuda', 'También vale pedir ayuda'],
  ['tiempo_cumplido', 'Tiempo cumplido'],
] as const;

for (const [id, titulo] of FINALES) {
  test(`final «${titulo}»`, async ({ page }) => {
    await page.goto(`/jugar?ejemplo=1&final=${id}`);
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    const encabezado = page.getByRole('heading', { level: 1, name: titulo });
    await expect(encabezado).toBeVisible();
    await expect(encabezado).toBeFocused();
    await expect(page.getByRole('timer')).toHaveCount(0);
  });
}

test('del final se pasa a créditos, poscréditos y de vuelta al menú', async ({ page }) => {
  await page.goto('/jugar?ejemplo=1&final=el_legado');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByText('5 de 5')).toBeVisible();
  await expect(page.getByText('3 de 3')).toBeVisible();

  await page.getByRole('button', { name: 'Ver créditos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La Última Prueba' })).toBeFocused();
  await expect(page.getByText(/tenía la llave desde el principio/)).toBeVisible();

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La fotocopiadora' })).toBeVisible();
  await expect(page.getByText(/Pregunta 6/)).toBeVisible();

  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
});

test('un final que no existe se ignora', async ({ page }) => {
  await page.goto('/jugar?ejemplo=1&final=otro');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
});
