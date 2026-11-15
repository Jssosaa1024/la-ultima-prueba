import { expect, test } from '@playwright/test';
import { continuarEn } from './escena';

// Hito 1, punto 16: el mural de la portería muestra cada sello ganado (una pieza que se
// enciende en su hueco) y se enciende la luz sobre la puerta que toca abrir.

test('al empezar, el mural está vacío y la luz está sobre la puerta 1', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  await expect(canvas).toHaveAttribute('data-maquina', 'mural-0');
  await expect(canvas).toHaveAttribute('data-detalle', 'luz-puerta-1');
});

test('al volver con dos sellos, sus piezas se encienden y la luz pasa a la puerta 3', async ({
  page,
}) => {
  await continuarEn(page, { sala: 's3-gimnasio', lugar: 'porteria' });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-maquina', 'mural-2');
  await expect(canvas).toHaveAttribute('data-detalle', 'luz-puerta-3');
});

test('con los cinco sellos se encienden las cinco piezas y la luz de la salida', async ({
  page,
}) => {
  await continuarEn(page, { sala: 's5-rectoria', etapas: 3, lugar: 'porteria' });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-maquina', 'mural-5');
  await expect(canvas).toHaveAttribute('data-detalle', 'luz-salida');
});
