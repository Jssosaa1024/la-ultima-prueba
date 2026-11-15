import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// T35: vista de inspección 2D, con la ficha real de un objeto de la sala 1 (T35c).

/** La caja de rodillos, sobre el mostrador de la cooperativa. */
const CAJA_DE_RODILLOS: Punto3 = [1.55, 1.08, -0.6];
const EXAMINAR = /Examinar.*Caja de rodillos/;

test.beforeEach(async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, { sala: 's1-cooperativa' });
  await tocarObjeto(page, caja, CAJA_DE_RODILLOS, conDedo, EXAMINAR);
});

test('«Examinar» abre la ficha con los datos en lista, texto y nota', async ({ page }) => {
  const examinar = page.getByRole('button', { name: EXAMINAR });
  await examinar.click();

  const dialogo = page.getByRole('dialog', { name: 'Caja de rodillos' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toBeFocused();
  await expect(dialogo).toContainText('Una caja de lata con los rodillos de la etiquetadora.');
  await expect(dialogo.getByRole('listitem')).toHaveCount(5);
  await expect(dialogo.getByRole('listitem').first()).toHaveText('Rodillo −20 %');
  // La ficha ocupa el ancho del panel: los estilos de otra pantalla no la encogen.
  const ancho = (await dialogo.locator('.ficha').boundingBox())?.width ?? 0;
  expect(ancho).toBeGreaterThan(200);
  await expect(dialogo.getByRole('listitem').first()).toBeVisible();
  await expect(dialogo).toContainText('recibe uno o dos rodillos a la vez');
  await expect(dialogo).toContainText('Se perdió el de −25 %');
  // El HUD queda inerte detrás del panel.
  await expect(page.getByRole('timer')).toHaveCount(0);

  await dialogo.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole('timer')).toBeVisible();
  // El objeto sigue enfocado y el foco vuelve a su botón, no al principio de la página.
  await expect(examinar).toBeFocused();
});

test('Escape cierra la ficha', async ({ page }) => {
  const examinar = page.getByRole('button', { name: EXAMINAR });
  await examinar.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(examinar).toBeFocused();
});

test('la ficha no hace scroll de la página en celular', async ({ page }) => {
  await page.getByRole('button', { name: EXAMINAR }).click();
  await expect(page.getByRole('dialog', { name: 'Caja de rodillos' })).toBeVisible();
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(desborda).toBe(false);
});
