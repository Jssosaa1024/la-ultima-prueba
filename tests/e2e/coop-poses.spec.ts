import { expect, test, type Page } from '@playwright/test';
import { empezarCoop } from './coop';
import { caminarHasta, leer } from './escena';

// T82: cada jugador ve a los demás donde están. La pose viaja a 4 Hz en movimiento y una más
// al detenerse; quien la recibe interpola con 150 ms de retraso.

/** Dónde ve `p` al compañero `alias` (atributo `data-companeros` del canvas), o null. */
async function companero(p: Page, alias: string): Promise<[number, number] | null> {
  const valor = (await p.getByLabel('Escena del juego').getAttribute('data-companeros')) ?? '';
  for (const parte of valor.split(';')) {
    const [nombre, xz] = parte.split(':');
    if (nombre === alias && xz) {
      const [x = NaN, z = NaN] = xz.split(',').map(Number);
      return [x, z];
    }
  }
  return null;
}

test('cuando Búho camina, Jaguar lo ve llegar a donde se detuvo', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se prueba en celular');
  test.setTimeout(4 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const canvasB = b.getByLabel('Escena del juego');
  await expect(canvasB).toHaveAttribute('data-posicion', /,/);

  // Antes de moverse, Jaguar ya ve a Búho donde apareció (la primera pose sale de una vez).
  const [x0, z0] = await leer(b, 'data-posicion');
  await expect
    .poll(async () => {
      const visto = await companero(a, 'buho');
      return visto ? Math.hypot(visto[0] - x0, visto[1] - z0) : Infinity;
    })
    .toBeLessThan(0.05);

  // Búho camina al menos 1,5 m.
  const caja = await canvasB.boundingBox();
  if (!caja) throw new Error('sin canvas');
  await caminarHasta(b, caja, conDedo, (x, z) => Math.hypot(x - x0, z - z0) > 1.5);

  // Al detenerse, sale su última pose: Jaguar lo ve exactamente ahí (al centímetro).
  await expect
    .poll(
      async () => {
        const [x, z] = await leer(b, 'data-posicion');
        const visto = await companero(a, 'buho');
        return visto ? Math.hypot(visto[0] - x, visto[1] - z) : Infinity;
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(0.02);
  // Y Búho ve a Jaguar, que no se movió.
  await expect.poll(() => companero(b, 'jaguar')).not.toBeNull();
});
