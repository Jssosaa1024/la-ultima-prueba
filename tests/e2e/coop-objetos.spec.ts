import { expect, test } from '@playwright/test';
import { empezarCoop } from './coop';
import { recoger } from './recorrido';

// T84c: en grupo, lo que lleva otro jugador no se ve en la escena; vuelve a su sitio cuando
// queda sin portador (aquí, porque quien la llevaba se fue y pasaron los 60 s de reserva).

test('la linterna que recoge Búho desaparece para Jaguar y vuelve cuando Búho la suelta', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se prueba en celular');
  test.setTimeout(5 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const canvasA = a.getByLabel('Escena del juego');
  const canvasB = b.getByLabel('Escena del juego');
  await expect(canvasA).toHaveAttribute('data-ocultos', '');
  await expect(canvasB).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const cajaB = await canvasB.boundingBox();
  if (!cajaB) throw new Error('sin canvas');

  await recoger(b, cajaB, conDedo, 'porteria-linterna');
  await expect(b.getByRole('list', { name: 'Inventario' })).toContainText('Linterna');
  // Los dos dejan de verla: Búho la lleva en la mano y Jaguar ve que se la llevaron.
  await expect(canvasB).toHaveAttribute('data-ocultos', 'porteria-linterna');
  await expect(canvasA).toHaveAttribute('data-ocultos', 'porteria-linterna');

  // Búho se va: su linterna queda reservada 60 s y luego en el piso, en su sitio.
  await b.close();
  await expect(canvasA).toHaveAttribute('data-ocultos', '', { timeout: 100_000 });
});
