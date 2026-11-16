import { expect, test } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import { recoger } from './recorrido';

// T84d: en grupo, quien lleva un objeto se lo pasa a un compañero desde la barra del grupo.
// Viaja la intención `pasar` (ids) y el anfitrión decide; a quien lo recibe le llega un aviso.

test('Búho le pasa la linterna a Jaguar y a Jaguar le avisan', async ({ page, context }, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se prueba en celular');
  test.setTimeout(4 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const canvasB = b.getByLabel('Escena del juego');
  await expect(canvasB).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const cajaB = await canvasB.boundingBox();
  if (!cajaB) throw new Error('sin canvas');

  // Sin nada en la mano no hay qué pasar.
  await expect(barra(b).getByRole('button', { name: 'Pasar objeto' })).toHaveCount(0);

  await recoger(b, cajaB, conDedo, 'porteria-linterna');
  await expect(b.getByRole('list', { name: 'Inventario' })).toContainText('Linterna');

  await barra(b).getByRole('button', { name: 'Pasar objeto' }).click();
  const pasar = barra(b).getByRole('group', { name: 'Pasar objeto' });
  await expect(pasar).toContainText('Pasas: Linterna');
  // Solo aparecen los compañeros, con su alias y su color.
  const aQuien = pasar.getByRole('group', { name: '¿A quién?' }).getByRole('button');
  await expect(aQuien).toHaveCount(1);
  await aQuien.filter({ hasText: 'Jaguar' }).click();

  await expect(a.getByRole('list', { name: 'Inventario' })).toContainText('Linterna');
  await expect(a.locator('.hud-aviso')).toHaveText(
    'Búho te pasó: Linterna. Ya está en lo que llevas.',
  );
  await expect(b.getByRole('list', { name: 'Inventario' })).not.toContainText('Linterna');
  await expect(b.locator('.hud-aviso')).toHaveText('Le pasaste a Jaguar: Linterna.');
  // La lista se cerró y Búho ya no tiene qué pasar.
  await expect(barra(b).getByRole('button', { name: 'Pasar objeto' })).toHaveCount(0);
  // La linterna sigue fuera de la escena: ahora la lleva Jaguar.
  await expect(a.getByLabel('Escena del juego')).toHaveAttribute(
    'data-ocultos',
    'porteria-linterna',
  );
});
