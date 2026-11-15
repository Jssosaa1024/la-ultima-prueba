import { expect, test } from '@playwright/test';

// T34: subtítulos de La Voz. Sin audio todavía, cada línea se ve su duración estimada.

test('al empezar, La Voz se presenta con dos subtítulos seguidos', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();

  const subtitulo = page.locator('.subtitulo');
  await expect(subtitulo).toContainText('La Voz: Buenas noches. Llegas tarde');
  // La primera línea dura 4 s; luego sigue la segunda (con margen para un equipo lento).
  await expect(subtitulo).toContainText('Cinco salas, cinco sellos', { timeout: 20_000 });
  await expect(subtitulo).toHaveCount(0, { timeout: 20_000 });
});

test('con un panel abierto el subtítulo espera, y sigue al cerrarlo', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.locator('.subtitulo')).toContainText('Buenas noches');
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.locator('.subtitulo')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.subtitulo')).toContainText('La Voz:');
});
