import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Controles del motor (T14, T15). En el perfil celular se usan toques reales por CDP
// (varios dedos a la vez); en escritorio, el ratón.

// El WebGL de las pruebas se dibuja con la CPU (SwiftShader): con la escena en marcha, cada
// evento de entrada tarda más que en un teléfono real. Estas pruebas tienen el triple de tiempo.
test.slow();

interface Punto {
  x: number;
  y: number;
}

/** Arrastra uno o varios dedos a la vez, en `pasos` movimientos, y los deja quietos `quieto` ms. */
async function arrastrarDedos(
  page: Page,
  trazos: [Punto, Punto][],
  { pasos = 10, quieto = 0 } = {},
): Promise<void> {
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
  if (quieto > 0) await page.waitForTimeout(quieto);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function arrastrarRaton(page: Page, a: Punto, b: Punto, quieto = 0): Promise<void> {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  if (quieto > 0) await page.waitForTimeout(quieto);
  await page.mouse.up();
}

/** Abre /jugar y toca «Jugar solo»: los controles solo funcionan con la partida en marcha. */
async function abrirJuego(page: Page) {
  await page.goto('/jugar');
  // El menú de inicio (T32) tapa la escena hasta que se toca «Jugar solo».
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return { canvas, caja };
}

const leer = async (page: Page, atributo: string): Promise<[number, number]> => {
  const valor = await page.getByLabel('Escena del juego').getAttribute(atributo);
  const [a = NaN, b = NaN] = (valor ?? '').split(',').map(Number);
  return [a, b];
};

test('arrastrar en la mitad derecha gira la cámara', async ({ page }, info) => {
  const { caja } = await abrirJuego(page);
  const [yaw0, pitch0] = await leer(page, 'data-mirada');
  const y = caja.y + caja.height / 2;
  const desde = { x: caja.x + caja.width * 0.6, y };
  const hasta = { x: caja.x + caja.width * 0.9, y: y + 40 };

  if (info.project.use.hasTouch) await arrastrarDedos(page, [[desde, hasta]]);
  else await arrastrarRaton(page, desde, hasta);

  // Derecha → yaw menor; abajo → pitch menor.
  await expect.poll(async () => (await leer(page, 'data-mirada'))[0]).toBeLessThan(yaw0 - 0.1);
  expect((await leer(page, 'data-mirada'))[1]).toBeLessThan(pitch0);
});

test('el joystick de la mitad izquierda camina hacia adelante sin girar', async ({
  page,
}, info) => {
  const { caja } = await abrirJuego(page);
  const [yaw0] = await leer(page, 'data-mirada');
  const [, z0] = await leer(page, 'data-posicion');
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  const desde = { x, y };
  const hasta = { x, y: y - 80 };

  if (info.project.use.hasTouch) await arrastrarDedos(page, [[desde, hasta]], { quieto: 600 });
  else await arrastrarRaton(page, desde, hasta, 600);

  // Con yaw 0, adelante es −Z.
  await expect.poll(async () => (await leer(page, 'data-posicion'))[1]).toBeLessThan(z0 - 0.3);
  expect((await leer(page, 'data-mirada'))[0]).toBe(yaw0);
});

test('con dos dedos se camina y se mira a la vez', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'multitáctil solo en el perfil celular');
  const { caja } = await abrirJuego(page);
  const [yaw0] = await leer(page, 'data-mirada');
  const [, z0] = await leer(page, 'data-posicion');
  const izq = { x: caja.x + caja.width * 0.2, y: caja.y + caja.height * 0.7 };
  const der = { x: caja.x + caja.width * 0.7, y: caja.y + caja.height * 0.5 };

  await arrastrarDedos(
    page,
    [
      [izq, { x: izq.x, y: izq.y - 80 }],
      [der, { x: der.x - 60, y: der.y }],
    ],
    { quieto: 600 },
  );

  await expect.poll(async () => (await leer(page, 'data-mirada'))[0]).toBeGreaterThan(yaw0 + 0.1);
  const [x1, z1] = await leer(page, 'data-posicion');
  expect(Math.hypot(x1, z1 - z0)).toBeGreaterThan(0.3);
});

test('caminar de frente se detiene contra la mesa sin atravesarla (T17)', async ({
  page,
}, info) => {
  const { caja } = await abrirJuego(page);
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  const desde = { x, y };
  const hasta = { x, y: y - 80 };

  // Joystick a fondo durante 3,5 s: sin colisión llegaría a z ≈ −4,8, detrás de la pared.
  if (info.project.use.hasTouch) await arrastrarDedos(page, [[desde, hasta]], { quieto: 3500 });
  else await arrastrarRaton(page, desde, hasta, 3500);

  // La mesa va de z = −1,9 a −1,1; con 30 cm de radio, el jugador se queda en z = −0,8.
  const [px, pz] = await leer(page, 'data-posicion');
  expect(pz).toBeGreaterThan(-0.85);
  expect(pz).toBeLessThan(0);
  expect(Math.abs(px)).toBeLessThan(0.05);
});

/** Toque corto en (x, y): dedo en celular, clic en escritorio. */
async function tocar(page: Page, p: Punto, conDedo: boolean | undefined): Promise<void> {
  if (!conDedo) {
    await page.mouse.click(p.x, p.y);
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: p.x, y: p.y, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('tocar el cartel lo enfoca y el botón del HUD abre su ficha (T18)', async ({ page }, info) => {
  const { caja } = await abrirJuego(page);
  const conDedo = info.project.use.hasTouch;

  // Caminar hasta la mesa: desde ahí el cartel de la pared del fondo queda a 2,2 m.
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  if (conDedo)
    await arrastrarDedos(
      page,
      [
        [
          { x, y },
          { x, y: y - 80 },
        ],
      ],
      { quieto: 3000 },
    );
  else await arrastrarRaton(page, { x, y }, { x, y: y - 80 }, 3000);

  // El centro de la pantalla apunta al cartel.
  await tocar(page, { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }, conDedo);
  const boton = page.getByRole('button', { name: /Examinar.*Cartel de la pared/ });
  await expect(boton).toBeVisible();

  await boton.click();
  await expect(page.getByText('No hay nada escrito en este objeto.')).toBeVisible();
});

test('tocar el piso no enfoca nada', async ({ page }, info) => {
  const { caja } = await abrirJuego(page);
  await tocar(
    page,
    { x: caja.x + caja.width * 0.7, y: caja.y + caja.height * 0.9 },
    info.project.use.hasTouch,
  );
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: /Examinar|Recoger|Usar/ })).toHaveCount(0);
});
