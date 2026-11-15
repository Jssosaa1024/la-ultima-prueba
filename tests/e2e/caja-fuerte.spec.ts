import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// Hito 1, punto 17: la caja fuerte de la sala 5 se abre en 3D al resolver.

/** La urna, sobre la mesa de la rectoría. */
const URNA: Punto3 = [-0.6, 0.98, -0.5];

test('al resolver la última etapa de la urna, la caja fuerte se abre al cerrar el panel', async ({
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
  await expect(panel).toContainText('Conseguiste el último sello');
  // Detrás del panel la caja espera: el jugador no la vería abrirse.
  await expect(canvas).toHaveAttribute('data-detalle', 'caja-cerrada');

  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(canvas).toHaveAttribute('data-detalle', 'caja-abierta');
});

test('al volver a la rectoría ya resuelta, la caja fuerte sigue abierta', async ({ page }) => {
  await continuarEn(page, { sala: 's5-rectoria', etapas: 3 });
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-detalle', 'caja-abierta');
});
