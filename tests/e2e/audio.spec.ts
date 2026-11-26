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
  await expect(canvas).toHaveAttribute('data-sonidos', /(^| )clac( |$)/);
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  // La palanca y la imprenta; cuando termina la impresión, la campanita del cajón de la
  // registradora; con la máquina quieta, el acierto y, después, el arpegio del sello
  // (corrección del 25 de noviembre). La Voz puede hablar en medio.
  await expect(canvas).toHaveAttribute(
    'data-sonidos',
    /(^| )palanca imprenta( .*)? registradora( .*)? acierto( .*)? sello( |$)/,
  );
});

test('una etapa que no se resuelve suena con el error, después de la impresión', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Primera etapa con un rodillo que sube el precio: imprime, pero no la etiqueta pedida.
  const caja = await continuarEn(page, {
    sala: 's1-cooperativa',
    ajustes: { producto: 'jugo', precio: 2000, rodillos: [20] },
  });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
  await tocarObjeto(page, caja, ETIQUETADORA, conDedo, /Usar.*Etiquetadora/);
  await page.getByRole('button', { name: /Usar.*Etiquetadora/ }).click();
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  await expect(canvas).toHaveAttribute('data-sonidos', /(^| )palanca imprenta( .*)? error( |$)/);
  expect(await canvas.getAttribute('data-sonidos')).not.toMatch(/(^| )(acierto|sello)( |$)/);
});

test('la registradora suena con sus teclas al usarla', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Después del primer toque se bajan los efectos grabados con ElevenLabs (T42c).
  const grabado = page.waitForResponse((r) => r.url().endsWith('/compartido/efecto-teclas.m4a'));
  const caja = await continuarEn(page, { sala: 's1-cooperativa' });
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-audio', 'listo');
  expect((await grabado).status()).toBe(200);
  await tocarObjeto(page, caja, REGISTRADORA, conDedo, /Usar.*Registradora/);
  await page.getByRole('button', { name: /Usar.*Registradora/ }).click();
  await expect(page.getByRole('dialog', { name: 'La etiquetadora' })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-sonidos', /(^| )teclas( |$)/);
});
