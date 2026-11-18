import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// T43: el audio arranca con el primer toque y las máquinas suenan al responder.
// T42c: también suenan los objetos al usarlos y la registradora al abrirse.

const ETIQUETADORA: Punto3 = [0.55, 1.15, -0.6];
const REGISTRADORA: Punto3 = [2.15, 1.175, -0.6];

test('el audio espera al primer toque del jugador', async ({ page }) => {
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-audio', 'bloqueado');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
});

test('la etiquetadora suena al usarla y al imprimir; con el sello, la registradora', async ({
  page,
}, info) => {
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
  // Usarla abre su panel con el pestillo de la máquina (T42c).
  await expect(canvas).toHaveAttribute('data-sonidos', /clac/);
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  // La palanca, la imprenta, el arpegio del sello y, cuando termina la impresión, la campanita
  // del cajón de la registradora. La Voz puede hablar en medio.
  await expect(canvas).toHaveAttribute('data-sonidos', /palanca imprenta sello.*registradora/);
});

test('la registradora suena con sus teclas al usarla', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, { sala: 's1-cooperativa' });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
  await tocarObjeto(page, caja, REGISTRADORA, conDedo, /Usar.*Registradora/);
  await page.getByRole('button', { name: /Usar.*Registradora/ }).click();
  await expect(page.getByRole('dialog', { name: 'La etiquetadora' })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-sonidos', /teclas/);
});
