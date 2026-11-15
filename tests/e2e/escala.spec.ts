import { expect, test } from '@playwright/test';

// T13: si el equipo no alcanza los 30 fps, el motor dibuja con menos píxeles (escala de 0,5
// a 1,0 sobre el DPR limitado a 1,25). Para no depender de la velocidad del equipo de
// pruebas, cada cuadro se frena a propósito unos 60 ms (unos 15 fps).

test('con el juego lento, la resolución baja hasta 0,5 y el canvas sigue a pantalla completa', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const gl = WebGL2RenderingContext.prototype;
    const clear = gl.clear;
    gl.clear = function (this: WebGL2RenderingContext, mascara: number): void {
      const fin = performance.now() + 60;
      while (performance.now() < fin) {
        // Espera activa: así el cuadro tarda de verdad.
      }
      clear.call(this, mascara);
    };
  });
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-escala', '1');
  const antes = await canvas.evaluate((c: HTMLCanvasElement) => c.width / c.clientWidth);
  await page.getByRole('button', { name: 'Jugar solo' }).click();

  // Baja cada 2 s: en unos 8 s llega al mínimo.
  await expect(canvas).toHaveAttribute('data-escala', '0.5', { timeout: 30_000 });
  const despues = await canvas.evaluate((c: HTMLCanvasElement) => ({
    relacion: c.width / c.clientWidth,
    cssAncho: c.clientWidth,
  }));
  expect(despues.relacion).toBeCloseTo(antes * 0.5, 1);
  expect(despues.cssAncho).toBe(page.viewportSize()?.width);
});
