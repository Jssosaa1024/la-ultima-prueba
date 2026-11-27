import { expect, test } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// T36: cuaderno con datos encontrados y notas (T36b: abrirlo ya no pausa el reloj). La partida empieza en la
// sala 1, con el cuaderno ya recogido.

/** La caja de rodillos, sobre el mostrador de la cooperativa. */
const CAJA_DE_RODILLOS: Punto3 = [1.55, 1.08, -0.6];

test('con el cuaderno abierto el reloj sigue corriendo', async ({ page }) => {
  await continuarEn(page, { sala: 's1-cooperativa', inventario: ['porteria-cuaderno'] });
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await expect(cuaderno).toBeVisible();
  await expect(cuaderno).not.toContainText('El reloj está en pausa');
  await expect(cuaderno).toContainText('Todavía no hay datos');
  // Sin sellos, el expediente ya cuenta el caso y las cinco acusaciones están pendientes.
  const expediente = cuaderno.getByRole('region', { name: 'Expediente 1991' });
  await expect(expediente).toContainText('En la feria de ciencias de 1991 acusaron');
  await expect(expediente).toContainText('Tienes 0 de 5 pruebas.');
  await expect(expediente).toContainText('Prueba 1 · La cooperativa: pendiente');
  // Con un panel abierto el HUD queda inerte: se lee el reloj por su clase. No dice «en pausa»
  // y la cuenta baja mientras el cuaderno sigue abierto.
  const reloj = page.locator('.hud-reloj');
  await expect(reloj).not.toContainText('en pausa');
  const antes = await reloj.innerText();
  await expect(reloj).not.toHaveText(antes, { timeout: 3000 });

  await cuaderno.getByRole('button', { name: 'Cerrar' }).click();
  // El foco vuelve al botón que abrió el cuaderno.
  await expect(page.getByRole('button', { name: 'Cuaderno' })).toBeFocused();
  await expect(page.getByRole('timer')).not.toHaveAttribute('aria-label', /en pausa/);
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^Tiempo restante/);
});

test('lo que se examina aparece en «Datos encontrados»', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, {
    sala: 's1-cooperativa',
    inventario: ['porteria-cuaderno'],
  });
  await tocarObjeto(page, caja, CAJA_DE_RODILLOS, conDedo, /Examinar.*Caja de rodillos/);
  await page.getByRole('button', { name: /Examinar.*Caja de rodillos/ }).click();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Cuaderno' }).click();

  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const dato = cuaderno.getByText('Caja de rodillos');
  await expect(dato).toBeVisible();
  await dato.click();
  await expect(cuaderno.getByText('Rodillo +25 %')).toBeVisible();
});

test('un dato con tabla se lee en el cuaderno, con sus encabezados', async ({ page }) => {
  // La pizarra de precios ya se había examinado antes de guardar la partida.
  await continuarEn(page, {
    sala: 's1-cooperativa',
    inventario: ['porteria-cuaderno'],
    datos: ['s1-pizarra'],
  });
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await cuaderno.getByText('Pizarra de precios').click();
  const tabla = cuaderno.getByRole('table', { name: 'Precios de hoy' });
  await expect(tabla.getByRole('columnheader', { name: 'Precio' })).toBeVisible();
  await expect(tabla.getByRole('cell', { name: '$1.600' })).toBeVisible();
  await expect(cuaderno).toContainText('Promo de la semana: solo el jugo');
});

test('se pueden escribir y borrar notas', async ({ page }) => {
  await continuarEn(page, { sala: 's1-cooperativa', inventario: ['porteria-cuaderno'] });
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const guardar = cuaderno.getByRole('button', { name: 'Guardar nota' });
  await expect(guardar).toBeDisabled();

  await cuaderno.getByLabel('Nueva nota').fill('4 × $5.000 = $20.000');
  await expect(cuaderno).toContainText('20 de 280 caracteres');
  await guardar.click();
  await expect(cuaderno.locator('.cuaderno-nota')).toHaveText(/4 × \$5\.000 = \$20\.000/);
  await expect(cuaderno.getByLabel('Nueva nota')).toHaveValue('');

  await cuaderno.getByRole('button', { name: 'Borrar nota: 4 × $5.000 = $20.000' }).click();
  await expect(cuaderno.locator('.cuaderno-nota')).toHaveCount(0);
});

test('cada sello trae su prueba del caso de 1991 al cuaderno', async ({ page }) => {
  // Historia B (docs/historia.md): con las salas 1 y 2 resueltas hay dos pruebas.
  await continuarEn(page, { sala: 's3-gimnasio', inventario: ['porteria-cuaderno'] });
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const expediente = cuaderno.getByRole('region', { name: 'Expediente 1991' });
  await expect(expediente).toContainText('Tienes 2 de 5 pruebas.');
  await expect(expediente).toContainText('Prueba 3 · El gimnasio: pendiente');
  await expediente.getByText('Prueba 2 · La bitácora').click();
  await expect(expediente).toContainText('Dos rectas distintas se cruzan en un solo punto');
  await expect(expediente).toContainText('E. C., 10-B');
  // Historia · sesión C: la bitácora dibuja sus dos rectas y dice dónde se cruzan.
  await expect(expediente.locator('.cuaderno-grafica')).toContainText(
    'Se cruzan una sola vez, en el minuto 15.',
  );
});
