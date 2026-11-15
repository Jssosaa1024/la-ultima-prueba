import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { continuarEn } from './escena';

// T11m y T11n: panel de métricas con ?debug=1 o con 3 toques en la esquina superior izquierda,
// colores contra el presupuesto y exportación en JSON.

/** Tres toques seguidos en (x, y), con su hora fija para no depender del equipo. */
async function tresToques(page: Page, x: number, y: number, conDedo: boolean): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const inicio = Date.now() / 1000;
  for (let i = 0; i < 3; i++) {
    const t = inicio + i * 0.15;
    if (conDedo) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id: 1 }],
        timestamp: t,
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
        timestamp: t + 0.05,
      });
    } else {
      const boton = { x, y, button: 'left', clickCount: 1 } as const;
      await cdp.send('Input.dispatchMouseEvent', { ...boton, type: 'mousePressed', timestamp: t });
      await cdp.send('Input.dispatchMouseEvent', {
        ...boton,
        type: 'mouseReleased',
        timestamp: t + 0.05,
      });
    }
  }
  await cdp.detach();
}

test('con ?debug=1 el panel mide la sala y exporta el JSON de la especificación', async ({
  page,
}) => {
  await page.goto('/jugar?debug=1');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  const panel = page.getByRole('region', { name: 'Métricas de rendimiento' });
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-motor', 'activo');

  // Las métricas llegan cada 500 ms con el motor dibujando.
  await expect(panel).toHaveAttribute('data-lista', 'true');
  await expect(panel).toContainText('porteria');
  await expect(panel.locator('[data-color]').first()).toBeVisible();
  await expect(panel).toContainText(/\d+ geometrías/);

  const descarga = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Exportar JSON' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^metricas-porteria-\d{14}\.json$/);
  const ruta = await archivo.path();
  const informe = JSON.parse(await readFile(ruta, 'utf8'));
  expect(informe.version).toBe(1);
  expect(informe.sala).toBe('porteria');
  expect(informe.fecha).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  expect(informe.dispositivo.userAgent).toBeTruthy();
  expect(informe.dispositivo.pantalla).toHaveLength(2);
  expect(informe.metricas.triangulos).toBeGreaterThan(0);
  expect(informe.metricas.draw_calls).toBeGreaterThan(0);
  expect(informe.metricas.p95_ms).toBeGreaterThan(0);
  expect(informe.metricas.carga_ms).toBeGreaterThanOrEqual(0);
  expect(informe.estres).toBeNull();
  await expect(panel.getByRole('status')).toHaveText('JSON exportado.');

  await panel.getByRole('button', { name: 'Cerrar métricas' }).click();
  await expect(panel).toBeHidden();
});

test('3 toques en la esquina superior izquierda abren el panel', async ({ page }, info) => {
  await continuarEn(page, { sala: 's1-cooperativa' });
  const panel = page.getByRole('region', { name: 'Métricas de rendimiento' });
  await expect(panel).toBeHidden();
  await tresToques(page, 12, 12, info.project.name === 'celular');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('s1-cooperativa');
  // El panel no tapa el juego: los toques fuera de sus botones siguen llegando a la escena.
  const estilo = await panel.evaluate((e) => getComputedStyle(e).pointerEvents);
  expect(estilo).toBe('none');
});
