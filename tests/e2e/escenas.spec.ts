import { expect, test } from '@playwright/test';
import { continuarEn } from './escena';

// Historia A: las escenas de la intro y de los finales del caso de Don Efraín. Las demás e2e
// las apagan con `lup:sin-escenas` (playwright.config.ts); estas empiezan sin esa clave.
test.use({ storageState: { cookies: [], origins: [] } });

const escenaDelCanvas = (page: import('@playwright/test').Page) =>
  page.getByLabel('Escena del juego');

test('la intro cuenta el caso, se salta con un toque y sale en cada partida', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();

  const intro = page.getByRole('region', { name: 'Intro: el caso de 1991' });
  await expect(intro).toBeVisible();
  await expect(intro).toContainText('Institución Educativa Los Almendros');
  await expect(escenaDelCanvas(page)).toHaveAttribute('data-escena', 'intro');
  // Mientras se ve, el HUD no está y el reloj de la partida no corre.
  await expect(page.getByRole('timer')).toHaveCount(0);

  const saltar = intro.getByRole('button', { name: 'Saltar' });
  await expect(saltar).toBeFocused();
  const caja = await saltar.boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
  await saltar.click();

  await expect(intro).toHaveCount(0);
  await expect(escenaDelCanvas(page)).not.toHaveAttribute('data-escena', /.+/);
  // La Voz se presenta como siempre, ya en la portería.
  await expect(page.locator('.subtitulo')).toContainText('Buenas noches.');
  // Otra partida: la intro sale otra vez (decisión de Alex: siempre).
  await page.reload();
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(intro).toBeVisible();
});

test('la intro avanza por sus planos: la foto de 1991 y La Voz con subtítulo', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const intro = page.getByRole('region', { name: 'Intro: el caso de 1991' });
  // El tercer plano empieza a los 10 s: la foto del filtro y la primera línea del caso.
  await expect(intro.locator('[data-tarjeta="foto-1991"]')).toBeVisible({ timeout: 20_000 });
  await expect(intro.getByRole('img', { name: /filtro de agua/ })).toBeVisible();
  await expect(intro.locator('.subtitulo')).toContainText('En 1991, un estudiante');
  await expect(intro).not.toContainText('Efraín');
});

test('con movimiento reducido no hay acercamientos y Escape la salta', async ({ page }, info) => {
  test.skip(info.project.use.hasTouch === true, 'Escape es del teclado: solo en escritorio');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const intro = page.getByRole('region', { name: 'Intro: el caso de 1991' });
  await expect(intro.locator('[data-tarjeta="titulo"]')).toBeVisible();
  const animacion = await intro
    .locator('.escena-tarjeta')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animacion).toBe('none');
  await page.keyboard.press('Escape');
  await expect(intro).toHaveCount(0);
});

test('al acabarse el tiempo, la escena de «Tiempo cumplido» y después la pantalla de final', async ({
  page,
}) => {
  // Una partida guardada no vuelve a mostrar la intro: se continúa donde iba.
  await continuarEn(page, { sala: 's1-cooperativa', lugar: 'porteria', restanteMs: 2_000 });

  const escena = page.getByRole('region', { name: 'Final: Tiempo cumplido' });
  await expect(escena).toBeVisible({ timeout: 15_000 });
  await expect(escenaDelCanvas(page)).toHaveAttribute('data-escena', 'tiempo_cumplido');
  await expect(escena.getByRole('timer')).toBeVisible();
  // El motor sigue dibujando detrás de la escena, aunque la partida ya terminó.
  await expect(escenaDelCanvas(page)).toHaveAttribute('data-motor', 'activo');

  await escena.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tiempo cumplido' })).toBeVisible();
});
