import { expect, test } from '@playwright/test';

// T34: subtítulos de La Voz. T42b: con la voz grabada, el subtítulo sigue al audio; si el
// audio no carga, cada línea se ve su duración estimada.

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

test('la voz grabada suena con su subtítulo (T42b)', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/audio/')) pedidos.push(new URL(r.url()).pathname);
  });
  await page.goto('/jugar');
  // El audio se desbloquea con el toque de «Jugar solo»: el motor tiene que estar escuchando.
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
  const subtitulo = page.locator('.subtitulo');
  await expect(subtitulo).toContainText('Buenas noches');
  // El navegador de las pruebas puede no traer el códec AAC: basta con que el audio se pida y
  // el subtítulo sepa si suena o no.
  await expect(subtitulo).toHaveAttribute('data-audio', /^(sonando|sin-audio)$/);
  expect(pedidos).toContain('/assets/audio/es-CO/porteria/voz-intro-1.m4a');
  await expect(subtitulo).toContainText('Cinco salas, cinco sellos', { timeout: 20_000 });
});

test('si el audio no carga, los subtítulos salen igual (T42b)', async ({ page }) => {
  await page.route('**/assets/audio/**', (r) => r.abort());
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
  const subtitulo = page.locator('.subtitulo');
  await expect(subtitulo).toContainText('Buenas noches');
  await expect(subtitulo).toHaveAttribute('data-audio', 'sin-audio');
  await expect(subtitulo).toContainText('Cinco salas, cinco sellos', { timeout: 20_000 });
  await expect(subtitulo).toHaveCount(0, { timeout: 20_000 });
});
