import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Controles del motor (T14+). En el perfil celular se usan toques reales por CDP
// (varios dedos a la vez); en escritorio, el ratón.

// El WebGL de las pruebas se dibuja con la CPU (SwiftShader): con la escena en marcha, cada
// evento de entrada tarda más que en un teléfono real. Estas pruebas tienen el triple de tiempo.
test.slow();

interface Punto {
  x: number;
  y: number;
}

/** Arrastra uno o varios dedos a la vez, en `pasos` movimientos. */
async function arrastrarDedos(page: Page, trazos: [Punto, Punto][], pasos = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const puntos = (t: number) =>
    trazos.map(([a, b], i) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      id: i + 1,
    }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: puntos(0) });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: puntos(i / pasos),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function arrastrarRaton(page: Page, a: Punto, b: Punto): Promise<void> {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
}

async function abrirJuego(page: Page) {
  await page.goto('/jugar');
  // El menú de inicio (T32) tapa la escena hasta que se toca «Jugar solo».
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return { canvas, caja };
}

const mirada = async (page: Page): Promise<[number, number]> => {
  const valor = await page.getByLabel('Escena del juego').getAttribute('data-mirada');
  const [yaw = 0, pitch = 0] = (valor ?? '0,-0.12').split(',').map(Number);
  return [yaw, pitch];
};

test('arrastrar en la mitad derecha gira la cámara', async ({ page }, info) => {
  const { caja } = await abrirJuego(page);
  const y = caja.y + caja.height / 2;
  const desde = { x: caja.x + caja.width * 0.6, y };
  const hasta = { x: caja.x + caja.width * 0.9, y: y + 40 };

  if (info.project.use.hasTouch) await arrastrarDedos(page, [[desde, hasta]]);
  else await arrastrarRaton(page, desde, hasta);

  // Derecha → yaw negativo; abajo → pitch menor que el inicial (−0,12).
  await expect.poll(async () => (await mirada(page))[0]).toBeLessThan(-0.1);
  expect((await mirada(page))[1]).toBeLessThan(-0.12);
});

test('arrastrar en la mitad izquierda no gira la cámara', async ({ page }, info) => {
  const { canvas, caja } = await abrirJuego(page);
  const y = caja.y + caja.height / 2;
  const desde = { x: caja.x + caja.width * 0.1, y };
  const hasta = { x: caja.x + caja.width * 0.4, y };

  if (info.project.use.hasTouch) await arrastrarDedos(page, [[desde, hasta]]);
  else await arrastrarRaton(page, desde, hasta);
  // Deja pasar algunos cuadros.
  await page.waitForTimeout(200);
  await expect(canvas).not.toHaveAttribute('data-mirada', /.+/);
});
