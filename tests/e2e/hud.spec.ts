import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto } from './escena';

// T33: HUD con reloj, sellos, inventario y botón contextual.

test('el HUD muestra reloj, sellos e inventario al empezar', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();

  const reloj = page.getByRole('timer');
  // Puede haber pasado algún segundo si el equipo está lento: basta con 3x:xx o 40:00.
  await expect(reloj).toHaveAttribute('aria-label', /^Tiempo restante: (40|3\d) minutos/);
  await expect(reloj).toHaveText(/^(40:00|3\d:\d\d)$/);
  await expect(page.getByRole('img', { name: 'Sellos: 0 de 5' })).toBeVisible();
  // El inventario empieza vacío y el cuaderno no tiene botón hasta que se recoge (T31b).
  await expect(page.getByRole('list', { name: 'Inventario' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cuaderno' })).toHaveCount(0);
  // Sin objeto enfocado no hay botón contextual.
  await expect(page.getByRole('button', { name: /^(Usar|Recoger|Examinar)/ })).toHaveCount(0);
});

test('al tocar un objeto aparece el botón contextual, con su nombre y de 44 px o más', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Empieza dentro de la sala 1, con la etiquetadora al alcance de la mano.
  const caja = await continuarEn(page, { sala: 's1-cooperativa' });
  await tocarObjeto(page, caja, [0.55, 1.15, -0.6], conDedo, /^Usar/);

  const accion = page.getByRole('button', { name: /^Usar/ });
  await expect(accion).toContainText('Etiquetadora');
  await expect
    .poll(async () => (await accion.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
});

test('«Salir» pide confirmación y vuelve al menú', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
});
