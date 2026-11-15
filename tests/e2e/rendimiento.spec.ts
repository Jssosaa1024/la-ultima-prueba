import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { continuarEn } from './escena';

// Punto 21 del hito 1: con un panel abierto el motor dibuja a unos 10 cuadros por segundo,
// lo justo para que la máquina termine de moverse detrás; al cerrarlo vuelve a la normal.

/** Cada cuadro que dibuja Three empieza borrando la pantalla: se cuentan esos borrados. */
async function contarCuadros(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ventana = window as unknown as { cuadros: number };
    ventana.cuadros = 0;
    const gl = WebGL2RenderingContext.prototype;
    const clear = gl.clear;
    gl.clear = function (this: WebGL2RenderingContext, mascara: number): void {
      ventana.cuadros++;
      clear.call(this, mascara);
    };
  });
}

/** Cuadros dibujados en `ms` milisegundos. */
async function cuadrosEn(page: Page, ms: number): Promise<number> {
  const leer = () => page.evaluate(() => (window as unknown as { cuadros: number }).cuadros);
  const antes = await leer();
  await page.waitForTimeout(ms);
  return (await leer()) - antes;
}

test('con un panel abierto se dibuja a unos 10 cuadros por segundo, y al cerrarlo, a la normal', async ({
  page,
}, info) => {
  await contarCuadros(page);
  await continuarEn(page, {
    sala: 's1-cooperativa',
    lugar: 'porteria',
    inventario: ['porteria-cuaderno'],
  });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');

  await page.getByRole('button', { name: 'Cuaderno' }).click();
  await expect(page.getByRole('dialog', { name: 'Tu cuaderno' })).toBeVisible();
  await page.waitForTimeout(300);
  const conPanel = await cuadrosEn(page, 2_000);
  // Unos 20 en 2 s: nunca más de 12 por segundo, y sigue dibujando (la máquina termina).
  expect(conPanel).toBeLessThanOrEqual(24);
  expect(conPanel).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-motor', 'activo');

  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('dialog', { name: 'Tu cuaderno' })).toHaveCount(0);
  await page.waitForTimeout(300);
  const sinPanel = await cuadrosEn(page, 2_000);
  // En escritorio el canvas grande se dibuja con la CPU y puede ir lento de por sí: allí solo
  // se comprueba que siga dibujando. En el perfil celular, que vuelva a ir más rápido.
  if (info.project.use.hasTouch) expect(sinPanel).toBeGreaterThan(conPanel);
  else expect(sinPanel).toBeGreaterThan(0);
});
