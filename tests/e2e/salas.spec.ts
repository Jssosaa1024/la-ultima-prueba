import { expect, test } from '@playwright/test';

// Salas por código: cada sala de src/content/salas.json se arma en el navegador sin errores.
// `?sala=<id>` elige la primera sala que dibuja el motor (para revisarlas en el celular).

const LUGARES = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
];

test.slow();

for (const lugar of LUGARES) {
  test(`?sala=${lugar} arma la sala sin errores`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto(`/jugar?sala=${lugar}`);
    const canvas = page.getByLabel('Escena del juego');
    await expect(canvas).toHaveAttribute('data-motor', 'activo');
    await expect(canvas).toHaveAttribute('data-sala', lugar);
    // Al empezar la partida se sigue viendo la sala elegida.
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    await expect(canvas).toHaveAttribute('data-sala', lugar);
    expect(errores).toEqual([]);
  });
}

test('sin ?sala, o con un valor que no es una sala, se empieza en la portería', async ({
  page,
}) => {
  await page.goto('/jugar?sala=%3Cscript%3E');
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 'porteria');
});
