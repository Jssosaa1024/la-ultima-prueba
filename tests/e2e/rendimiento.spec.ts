import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

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

// Corrección del 25 de noviembre: con el panel de una máquina, la cámara se acerca a ella y,
// mientras la máquina se anima, se dibuja a velocidad normal; quieta, otra vez a 10 por segundo.
const ETIQUETADORA: Punto3 = [0.55, 1.15, -0.6];

test('con el panel de la etiquetadora la cámara se acerca, y mientras imprime se dibuja a velocidad normal', async ({
  page,
}, info) => {
  test.slow();
  const conDedo = info.project.use.hasTouch === true;
  await contarCuadros(page);
  const caja = await continuarEn(page, {
    sala: 's1-cooperativa',
    ajustes: { producto: 'jugo', precio: 2000, rodillos: [20] },
  });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  const posicion = await canvas.getAttribute('data-posicion');
  await tocarObjeto(page, caja, ETIQUETADORA, conDedo, /Usar.*Etiquetadora/);
  await page.getByRole('button', { name: /Usar.*Etiquetadora/ }).click();
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  await expect(panel).toBeVisible();
  await expect(canvas).toHaveAttribute('data-encuadre', 'encuadrada');
  // Se acerca la cámara del dibujo, no el jugador.
  expect(await canvas.getAttribute('data-posicion')).toBe(posicion);

  await page.waitForTimeout(300);
  const quieta = await cuadrosEn(page, 1_000);
  expect(quieta).toBeLessThanOrEqual(12);

  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  await expect(canvas).toHaveAttribute('data-maquina', 'imprimiendo');
  const imprimiendo = await cuadrosEn(page, 600);
  // En escritorio el canvas grande se dibuja con la CPU y puede ir lento de por sí: allí solo
  // se comprueba que siga dibujando. En el perfil celular, más que con la máquina quieta.
  if (info.project.use.hasTouch) expect(imprimiendo / 0.6).toBeGreaterThan(quieta);
  else expect(imprimiendo).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(panel).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-encuadre', 'libre');
  expect(await canvas.getAttribute('data-posicion')).toBe(posicion);
});
