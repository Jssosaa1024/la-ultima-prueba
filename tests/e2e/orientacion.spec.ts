import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto } from './escena';

// T41b: en celular el juego se juega solo en horizontal. En vertical, un aviso a pantalla
// completa pide girar el teléfono, el reloj se pausa y el motor deja de dibujar.

/** El perfil celular es horizontal; esto lo pone en vertical o lo devuelve. */
async function girar(page: import('@playwright/test').Page, vertical: boolean): Promise<void> {
  const v = page.viewportSize();
  if (!v) throw new Error('sin tamaño de pantalla');
  const corto = Math.min(v.width, v.height);
  const largo = Math.max(v.width, v.height);
  await page.setViewportSize(
    vertical ? { width: corto, height: largo } : { width: largo, height: corto },
  );
}

test('en vertical se pide girar el teléfono, con el reloj en pausa y la escena quieta', async ({
  page,
}, info) => {
  test.skip(!info.project.use.hasTouch, 'el aviso es solo para celulares');
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  const aviso = page.getByRole('dialog', { name: 'Gira el teléfono' });
  const reloj = page.getByRole('timer');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  await expect(aviso).toHaveCount(0);

  await girar(page, true);
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('El reloj está en pausa');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado');
  // El aviso tapa toda la pantalla y el HUD de debajo no se toca.
  const caja = await aviso.boundingBox();
  const vista = page.viewportSize();
  expect(Math.round(caja?.width ?? 0)).toBe(vista?.width);
  expect(Math.round(caja?.height ?? 0)).toBe(vista?.height);
  await expect(page.getByRole('button', { name: 'Pausa' })).toHaveCount(0);
  // El reloj no avanza mientras se ve el aviso.
  const reloj1 = page.locator('.hud-reloj');
  await expect(reloj1).toContainText('en pausa');
  const antes = await reloj1.textContent();
  await page.waitForTimeout(2_200);
  expect(await reloj1.textContent()).toBe(antes);

  await girar(page, false);
  await expect(aviso).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  await expect(reloj).not.toHaveAttribute('aria-label', /en pausa/);
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
});

test('el cuaderno abierto sigue igual después de girar, y el reloj sigue en pausa', async ({
  page,
}, info) => {
  test.skip(!info.project.use.hasTouch, 'el aviso es solo para celulares');
  await continuarEn(page, {
    sala: 's1-cooperativa',
    lugar: 'porteria',
    inventario: ['porteria-cuaderno'],
  });
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await cuaderno.getByLabel('Nueva nota').fill('El precio sube 25 %');

  await girar(page, true);
  await expect(page.getByRole('dialog', { name: 'Gira el teléfono' })).toBeVisible();
  await girar(page, false);
  await expect(page.getByRole('dialog', { name: 'Gira el teléfono' })).toHaveCount(0);
  // El borrador sigue ahí y el reloj sigue en pausa: el cuaderno sigue abierto.
  await expect(cuaderno.getByLabel('Nueva nota')).toHaveValue('El precio sube 25 %');
  await expect(page.locator('.hud-reloj')).toContainText('en pausa');
});

test('en horizontal, los botones de un panel de máquina quedan a la vista', async ({
  page,
}, info) => {
  test.skip(!info.project.use.hasTouch, 'el perfil celular es el de poca altura');
  const caja = await continuarEn(page, { sala: 's1-cooperativa' });
  await tocarObjeto(page, caja, [0.55, 1.15, -0.6], true, /Usar.*Etiquetadora/);
  await page.getByRole('button', { name: /Usar.*Etiquetadora/ }).click();
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  // El pie con la palanca y el botón de cerrar no se sale de la pantalla: lo que se desplaza
  // es el cuerpo del panel.
  await expect(panel.getByRole('button', { name: 'Bajar la palanca' })).toBeInViewport({
    ratio: 1,
  });
  await expect(panel.locator('.dialogo-pie')).toBeInViewport({ ratio: 1 });
  const rodillo = panel.getByRole('button', { name: '−20 %', exact: true });
  await rodillo.scrollIntoViewIfNeeded();
  await expect(rodillo).toBeInViewport({ ratio: 1 });
  await expect(panel.locator('.dialogo-titulo')).toBeInViewport({ ratio: 1 });
});

test('en un PC, una ventana angosta no pide girar nada', async ({ page }, info) => {
  test.skip(info.project.use.hasTouch === true, 'solo con ratón');
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  await expect(page.getByRole('dialog', { name: 'Gira el teléfono' })).toHaveCount(0);
});
