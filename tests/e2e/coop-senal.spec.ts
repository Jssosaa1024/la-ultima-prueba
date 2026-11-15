import { expect, test } from '@playwright/test';
import { barra, empezarCoop } from './coop';

// T91, la parte 3D: una frase rápida marca el lugar de quien la dice (o el objeto enfocado),
// y los dos lo ven en la escena unos segundos.

test('al decir «¡Aquí!», los dos ven la señal en la escena y luego se apaga', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se prueba en celular');
  test.setTimeout(4 * 60_000);
  const { a, b } = await empezarCoop(context, page);
  const canvasA = a.getByLabel('Escena del juego');
  const canvasB = b.getByLabel('Escena del juego');
  // El motor ya escribió dónde está Búho: la señal lleva punto.
  await expect(canvasB).toHaveAttribute('data-senales', '0', { timeout: 30_000 });

  await barra(b).getByRole('button', { name: 'Frases' }).click();
  await barra(b).getByRole('button', { name: '¡Aquí!' }).click();
  await expect(barra(a)).toContainText('Búho: ¡Aquí!');
  await expect(canvasA).toHaveAttribute('data-senales', '1');
  await expect(canvasB).toHaveAttribute('data-senales', '1');
  // A los 5 s ya no se ve.
  await expect(canvasA).toHaveAttribute('data-senales', '0', { timeout: 20_000 });
});
