import { expect, test } from '@playwright/test';

// T36: cuaderno con datos encontrados, notas y pausa del reloj.

test.beforeEach(async ({ page }) => {
  await page.goto('/jugar?ejemplo=1');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
});

test('abrir el cuaderno pausa el reloj y cerrarlo lo reanuda', async ({ page }) => {
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await expect(cuaderno).toBeVisible();
  await expect(cuaderno.getByRole('status')).toContainText('El reloj está en pausa');
  await expect(cuaderno).toContainText('Todavía no hay datos');

  await cuaderno.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('timer')).not.toHaveAttribute('aria-label', /en pausa/);
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^Tiempo restante/);
});

test('lo que se examina aparece en «Datos encontrados»', async ({ page }) => {
  await page.getByRole('button', { name: /^Examinar/ }).click();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Cuaderno' }).click();

  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const dato = cuaderno.getByText('Factura de la caja');
  await expect(dato).toBeVisible();
  await dato.click();
  await expect(cuaderno.getByRole('cell', { name: '$5.000' })).toBeVisible();
});

test('se pueden escribir y borrar notas', async ({ page }) => {
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const guardar = cuaderno.getByRole('button', { name: 'Guardar nota' });
  await expect(guardar).toBeDisabled();

  await cuaderno.getByLabel('Nueva nota').fill('4 × $5.000 = $20.000');
  await expect(cuaderno).toContainText('20 de 280 caracteres');
  await guardar.click();
  await expect(cuaderno.getByRole('listitem')).toHaveText(/4 × \$5\.000 = \$20\.000/);
  await expect(cuaderno.getByLabel('Nueva nota')).toHaveValue('');

  await cuaderno.getByRole('button', { name: 'Borrar nota: 4 × $5.000 = $20.000' }).click();
  await expect(cuaderno.getByRole('listitem')).toHaveCount(0);
});
