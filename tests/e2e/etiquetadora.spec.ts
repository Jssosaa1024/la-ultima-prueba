import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// T45: la etiquetadora de la sala 1, de punta a punta, como la jugaría un estudiante.

// El WebGL de las pruebas se dibuja con la CPU: todo tarda más que en un teléfono real.
test.slow();

/** La etiquetadora, sobre el mostrador de la cooperativa. */
const ETIQUETADORA: Punto3 = [0.55, 1.15, -0.6];

async function abrirEtiquetadora(page: Page, conDedo: boolean, etapas = 0): Promise<Locator> {
  const caja = await continuarEn(page, { sala: 's1-cooperativa', etapas });
  await tocarObjeto(page, caja, ETIQUETADORA, conDedo, /Usar.*Etiquetadora/);
  await page.getByRole('button', { name: /Usar.*Etiquetadora/ }).click();
  const panel = page.getByRole('dialog', { name: 'La etiquetadora' });
  await expect(panel).toBeVisible();
  return panel;
}

const rodillo = (panel: Locator, texto: string): Locator =>
  panel.getByRole('button', { name: texto, exact: true });

test('las tres etapas de la etiquetadora dan el sello de la sala 1', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  const panel = await abrirEtiquetadora(page, conDedo);
  const palanca = panel.getByRole('button', { name: 'Bajar la palanca' });
  const respuesta = panel.locator('.respuesta');

  // Etapa 1 · Jugo: de $2.000 a $1.600 con el rodillo de −20 %.
  await expect(panel).toContainText('Sala 1 · Etapa 1 de 3');
  await expect(panel).toContainText('Etiqueta del jugo');
  await expect(panel.getByRole('list', { name: 'Ranuras de la máquina' })).toContainText('vacía');
  await rodillo(panel, '−20 %').click();
  await expect(rodillo(panel, '−20 %')).toHaveAttribute('aria-pressed', 'true');
  await palanca.click();
  await expect(respuesta).toContainText('$1.600');
  await expect(respuesta).toContainText('bajó $400');
  await expect(respuesta).toContainText('Es el precio de la pizarra.');
  // En la escena, la máquina imprimió su etiqueta.
  await expect(canvas).toHaveAttribute('data-maquina', 'etiqueta-impresa');
  // La etapa resuelta no se puede cambiar.
  await expect(rodillo(panel, '+20 %')).toBeDisabled();
  await panel.getByRole('button', { name: 'Seguir' }).click();

  // Etapa 2 · Empanada: +20 % no devuelve los $2.000; la máquina muestra lo que pasó.
  await expect(panel).toContainText('Sala 1 · Etapa 2 de 3');
  await expect(panel).toContainText('Etiqueta de la empanada');
  await rodillo(panel, '+20 %').click();
  await palanca.click();
  await expect(respuesta).toContainText('$1.920');
  await expect(respuesta).toContainText('subió $320');
  await expect(respuesta).toContainText('La pizarra dice $2.000');
  await expect(panel).not.toContainText(/incorrect/i);
  await expect(panel).toContainText('Sala 1 · Etapa 2 de 3');
  // Se cambia el rodillo y se prueba otra vez.
  await rodillo(panel, '+20 %').click();
  await rodillo(panel, '+25 %').click();
  await palanca.click();
  await expect(respuesta).toContainText('subió $400');
  await panel.getByRole('button', { name: 'Seguir' }).click();

  // Etapa 3 · Combo: −50 % y +50 % no se anulan, dan $3.000.
  await expect(panel).toContainText('Sala 1 · Etapa 3 de 3');
  await rodillo(panel, '−50 %').click();
  await rodillo(panel, '+50 %').click();
  // Con las dos ranuras llenas no cabe otro rodillo.
  await expect(rodillo(panel, '+25 %')).toBeDisabled();
  await palanca.click();
  await expect(respuesta).toContainText('$3.000');
  await expect(respuesta).toContainText('La registradora se abrió.');
  await expect(panel).toContainText('Conseguiste el sello de esta sala');

  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Sellos: 1 de 5' })).toBeVisible();
  // En la escena, el cajón de la registradora quedó abierto.
  await expect(canvas).toHaveAttribute('data-maquina', 'registradora-abierta');
});

test('en la etapa 3 el orden de los rodillos no cambia el precio', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const panel = await abrirEtiquetadora(page, conDedo, 2);
  await expect(panel).toContainText('Sala 1 · Etapa 3 de 3');
  const ranuras = panel.getByRole('listitem');

  // Primero +50 % y después −50 %: las ranuras guardan el orden.
  await rodillo(panel, '+50 %').click();
  await rodillo(panel, '−50 %').click();
  await expect(ranuras.nth(0)).toContainText('+50 %');
  await expect(ranuras.nth(1)).toContainText('−50 %');
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  await expect(panel.locator('.respuesta')).toContainText(
    'Con los rodillos +50 % y −50 %, la etiqueta pasó de $4.000 a $3.000',
  );
  await expect(panel).toContainText('Conseguiste el sello de esta sala');
});
