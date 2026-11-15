import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// T43: el audio arranca con el primer toque y las máquinas suenan al responder.

const ETIQUETADORA: Punto3 = [0.55, 1.15, -0.6];

test('el audio espera al primer toque del jugador', async ({ page }) => {
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-audio', 'bloqueado');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
});

test('la palanca de la etiquetadora suena, y el sello también', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Última etapa, con los rodillos que la resuelven ya puestos.
  const caja = await continuarEn(page, {
    sala: 's1-cooperativa',
    etapas: 2,
    ajustes: { producto: 'combo', precio: 4000, rodillos: [-50, 50] },
  });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
  await tocarObjeto(page, caja, ETIQUETADORA, conDedo, /Usar.*Etiquetadora/);
  await page.getByRole('button', { name: /Usar.*Etiquetadora/ }).click();
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  // Primero la palanca y, medio segundo después, el arpegio del sello.
  await expect(canvas).toHaveAttribute('data-sonido', /^(palanca|sello)$/);
  await expect(canvas).toHaveAttribute('data-sonido', 'sello');
});
