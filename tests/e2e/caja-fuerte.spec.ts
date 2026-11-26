import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// Hito 1, punto 17: la caja fuerte de la sala 5 se abre en 3D al resolver.

/** La urna, sobre la mesa de la rectoría. */
const URNA: Punto3 = [-0.6, 0.98, -0.5];

test('al resolver la última etapa de la urna, la caja fuerte se abre con el panel recogido', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Última etapa, con la urna ya cargada con la solución: solo falta tirar de la manija.
  const caja = await continuarEn(page, {
    sala: 's5-rectoria',
    etapas: 2,
    ajustes: { azules: 6, amarillas: 3 },
  });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-detalle', 'caja-cerrada');

  await tocarObjeto(page, caja, URNA, conDedo, /Usar.*Urna/);
  await page.getByRole('button', { name: /Usar.*Urna/ }).click();
  const panel = page.getByRole('dialog', { name: 'El juego justo de La Voz' });
  await panel.getByRole('button', { name: 'Tirar de la manija' }).click();
  // Correcciones del 25 nov: el panel se recoge a su pestaña mientras la mano saca las fichas,
  // y la caja se abre a la vista. Después el panel vuelve con lo que pasó.
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Mostrar los controles' })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-detalle', 'caja-abierta', { timeout: 20_000 });
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await expect(panel).toContainText('Conseguiste el último sello');

  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
});

test('al volver a la rectoría ya resuelta, la caja fuerte sigue abierta', async ({ page }) => {
  await continuarEn(page, { sala: 's5-rectoria', etapas: 3 });
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-detalle', 'caja-abierta');
});
