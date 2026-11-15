import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// T11o–T11r: prueba de estrés del panel ?debug=1. Cada escalón tarda unos 6 s (1 s de
// calentamiento y 5 s de medida); estas pruebas miden uno y detienen.

async function abrirEstres(page: Page): Promise<void> {
  await page.goto('/jugar?debug=1');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  const panel = page.getByRole('region', { name: 'Métricas de rendimiento' });
  await expect(panel).toHaveAttribute('data-lista', 'true');
  await panel.getByRole('button', { name: 'Prueba de estrés' }).click();
}

const marca = (page: Page) => page.evaluate(() => localStorage.getItem('lup-estres'));

for (const eje of ['Draw calls', 'Texturas'] as const) {
  test(`eje ${eje}: mide un escalón, al detener libera todo y borra la marca`, async ({ page }) => {
    await abrirEstres(page);
    const panel = page.getByRole('region', { name: 'Métricas de rendimiento' });
    const estado = panel.locator('.depuracion-estres');
    await panel.getByRole('button', { name: eje }).click();
    // La marca se escribe antes de subir el escalón.
    await expect.poll(() => marca(page)).toContain('"estado":"en-curso"');
    await expect(estado).toHaveAttribute('data-fase', 'midiendo', { timeout: 30_000 });
    await expect(panel.locator('.depuracion-escalones li').first()).toContainText(/^1\. \+/, {
      timeout: 30_000,
    });
    await panel.getByRole('button', { name: 'Detener prueba' }).click();
    await expect(estado).toHaveAttribute('data-fase', 'terminada');
    await expect(estado).toHaveAttribute('data-motivo', 'detenida');
    // T11r: renderer.info.memory vuelve a lo de antes.
    await expect(panel.locator('[data-memoria]')).toHaveAttribute('data-memoria', 'liberada');
    expect(await marca(page)).toBeNull();

    // El JSON lleva los escalones medidos.
    const descarga = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Exportar JSON' }).click();
    const informe = JSON.parse(await readFile(await (await descarga).path(), 'utf8'));
    expect(informe.estres.eje).toBe(eje === 'Texturas' ? 'texturas' : 'draw-calls');
    expect(informe.estres.escalones[0]).toMatchObject({ escalon: 1, estado: expect.any(String) });
    expect(informe.estres.escalones[0].p95_ms).toBeGreaterThan(0);
    expect(informe.estres.memoria.liberada).toBe(true);
  });
}

test('eje píxeles: baja el pixel ratio a 0,5 y al detener vuelve al del juego', async ({
  page,
}) => {
  await abrirEstres(page);
  const panel = page.getByRole('region', { name: 'Métricas de rendimiento' });
  const canvas = page.getByLabel('Escena del juego');
  const relacion = () => canvas.evaluate((c: HTMLCanvasElement) => c.width / c.clientWidth);
  const antes = await relacion();
  await panel.getByRole('button', { name: 'Píxeles' }).click();
  await expect.poll(relacion).toBeCloseTo(0.5, 1);
  await panel.getByRole('button', { name: 'Detener prueba' }).click();
  await expect.poll(relacion).toBeCloseTo(antes, 1);
});

test('si la pestaña se recargó a mitad de un escalón, el panel lo muestra como recarga por memoria', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sembrada')) return;
    sessionStorage.setItem('sembrada', '1');
    localStorage.setItem(
      'lup-estres',
      JSON.stringify({
        eje: 'texturas',
        escalon: 2,
        estado: 'en-curso',
        escalones: [{ escalon: 1, carga: '+4 texturas', p95_ms: 30, estado: 'estable' }],
      }),
    );
  });
  await page.goto('/jugar');
  const panel = page.getByRole('region', { name: 'Métricas de rendimiento' });
  await expect(panel).toBeVisible({ timeout: 30_000 });
  const estado = panel.locator('.depuracion-estres');
  await expect(estado).toHaveAttribute('data-motivo', 'recarga');
  await expect(estado).toContainText('2. +8 texturas · recarga por memoria');

  const descarga = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Exportar JSON' }).click();
  const informe = JSON.parse(await readFile(await (await descarga).path(), 'utf8'));
  expect(informe.estres).toEqual({
    eje: 'texturas',
    escalones: [
      { escalon: 1, carga: '+4 texturas', p95_ms: 30, estado: 'estable' },
      { escalon: 2, carga: '+8 texturas', estado: 'recarga-por-memoria' },
    ],
    ultimo_estable: 1,
  });
});
