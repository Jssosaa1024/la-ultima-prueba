import { expect, test } from '@playwright/test';
import { continuarEn, salirDeLaPartida, tocarObjeto } from './escena';

// T33: HUD con reloj, sellos, inventario y botón contextual.

test('el HUD muestra reloj, sellos e inventario al empezar', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();

  const reloj = page.getByRole('timer');
  // Puede haber pasado algún segundo si el equipo está lento: basta con 3x:xx o 40:00.
  await expect(reloj).toHaveAttribute('aria-label', /^Tiempo restante: (40|3\d) minutos/);
  await expect(reloj).toHaveText(/^(40:00|3\d:\d\d)$/);
  await expect(page.getByRole('img', { name: 'Sellos: 0 de 5' })).toBeVisible();
  // El inventario empieza vacío y el cuaderno no tiene botón hasta que se recoge (T31b).
  await expect(page.getByRole('list', { name: 'Inventario' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cuaderno' })).toHaveCount(0);
  // Sin objeto enfocado no hay botón contextual.
  await expect(page.getByRole('button', { name: /^(Usar|Recoger|Examinar)/ })).toHaveCount(0);
});

test('al tocar un objeto aparece el botón contextual, con su nombre y de 44 px o más', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Empieza dentro de la sala 1, con la etiquetadora al alcance de la mano.
  const caja = await continuarEn(page, { sala: 's1-cooperativa' });
  await tocarObjeto(page, caja, [0.55, 1.15, -0.6], conDedo, /^Usar/);

  const accion = page.getByRole('button', { name: /^Usar/ });
  await expect(accion).toContainText('Etiquetadora');
  await expect
    .poll(async () => (await accion.boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
});

test('«Pausa» detiene el reloj; «Salir de la partida» pide confirmación y vuelve al menú', async ({
  page,
}) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await page.getByRole('button', { name: 'Pausa' }).click();
  const pausa = page.getByRole('dialog', { name: 'Pausa' });
  await expect(pausa).toBeFocused();
  await expect(pausa).toContainText('El reloj de las 00:40 está detenido');
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /en pausa/);
  // «Seguir jugando» cierra la pausa, el reloj vuelve a correr y el foco vuelve al botón.
  await pausa.getByRole('button', { name: 'Seguir jugando' }).click();
  await expect(pausa).toHaveCount(0);
  await expect(page.getByRole('timer')).not.toHaveAttribute('aria-label', /en pausa/);
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeFocused();
  // Desde la pausa se llega a los ajustes.
  await page.getByRole('button', { name: 'Pausa' }).click();
  await pausa.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('dialog', { name: 'Ajustes del juego' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  // Salir pide confirmación: «No, seguir jugando» no termina la partida.
  await page.getByRole('button', { name: 'Pausa' }).click();
  await pausa.getByRole('button', { name: 'Salir de la partida' }).click();
  const confirmar = page.getByRole('dialog', { name: '¿Salir de la partida?' });
  await expect(confirmar).toBeFocused();
  await confirmar.getByRole('button', { name: 'No, seguir jugando' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await salirDeLaPartida(page);
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
});
