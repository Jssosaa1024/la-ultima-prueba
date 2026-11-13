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
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  // El menú de inicio (T32) tapa la escena hasta que se toca «Jugar solo». Un solo clic:
  // después del primero el menú desaparece.
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

/** Camina de frente con el joystick (o el ratón) hasta la pared del fondo de la portería. */
async function caminarAlFondo(page: Page, caja: Caja, conDedo: boolean | undefined) {
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  const trazo: [Punto, Punto] = [
    { x, y },
    { x, y: y - 80 },
  ];
  // A 2 m/s, 6,5 s alcanzan para 13 m; el pasillo mide 10 m.
  if (conDedo) await arrastrarDedos(page, [trazo], { quieto: 6500 });
  else await arrastrarRaton(page, trazo[0], trazo[1], 6500);
}

interface Caja {
  x: number;
  y: number;
  width: number;
  height: number;
}

test('caminar de frente se detiene contra la pared del fondo sin atravesarla (T17)', async ({
  page,
}, info) => {
  const { caja } = await abrirJuego(page);
  await caminarAlFondo(page, caja, info.project.use.hasTouch);

  // La pared del fondo de la portería está en z = −5; con 30 cm de radio, el jugador queda en −4,7.
  const [px, pz] = await leer(page, 'data-posicion');
  expect(pz).toBeGreaterThan(-4.75);
  expect(pz).toBeLessThan(-4);
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

test('tocar la puerta de salida la enfoca y el botón del HUD la usa (T18)', async ({
  page,
}, info) => {
  const { caja } = await abrirJuego(page);
  const conDedo = info.project.use.hasTouch;
  await caminarAlFondo(page, caja, conDedo);

  // El centro de la pantalla apunta a la puerta de salida, a 30 cm.
  await tocar(page, { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }, conDedo);
  const boton = page.getByRole('button', { name: /Usar.*Puerta de salida/ });
  await expect(boton).toBeVisible();

  // La orden va por el puente; el controlador la atiende y suelta el objeto.
  await boton.click();
  await expect(boton).toHaveCount(0);
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

test('en escritorio, W camina hacia adelante y E usa lo enfocado (T19)', async ({ page }, info) => {
  test.skip(!!info.project.use.hasTouch, 'teclado solo en el perfil de escritorio');
  const { caja } = await abrirJuego(page);

  // Las flechas y WASD no deben hacer scroll de la página.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(6500);
  await page.keyboard.up('KeyW');
  const [, z1] = await leer(page, 'data-posicion');
  // Se detiene contra la pared del fondo (T17).
  expect(z1).toBeGreaterThan(-4.75);
  expect(z1).toBeLessThan(-4);

  // Apuntar a la puerta de salida con un clic y usarla con E.
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  const boton = page.getByRole('button', { name: /Usar.*Puerta de salida/ });
  await expect(boton).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(boton).toHaveCount(0);
});

test('en escritorio, un clic en el piso bloquea el ratón y el ratón mira (T19)', async ({
  page,
}, info) => {
  test.skip(!!info.project.use.hasTouch, 'ratón solo en el perfil de escritorio');
  const { canvas, caja } = await abrirJuego(page);
  const bloqueado = () => canvas.evaluate((c) => document.pointerLockElement === c);

  // Arrastrar con el ratón (caminar) no bloquea, aunque al soltar el navegador dispare `click`.
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  await arrastrarRaton(page, { x, y }, { x, y: y - 80 }, 200);
  expect(await bloqueado()).toBe(false);

  // Un clic corto en el piso sí bloquea, y entonces mover el ratón gira la cámara.
  // (Esc lo suelta el propio navegador; una tecla simulada no lo hace, por eso no se prueba.)
  await page.mouse.click(caja.x + caja.width * 0.7, caja.y + caja.height * 0.9);
  await expect.poll(bloqueado).toBe(true);
  const [yaw0] = await leer(page, 'data-mirada');
  await page.mouse.move(caja.x + caja.width * 0.9, caja.y + caja.height * 0.9, { steps: 5 });
  await expect.poll(async () => (await leer(page, 'data-mirada'))[0]).not.toBe(yaw0);
});

test('en celular, tocar la escena nunca bloquea el puntero (T19)', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'táctil solo en el perfil celular');
  const { canvas, caja } = await abrirJuego(page);
  const cdp = await page.context().newCDPSession(page);
  const p = { x: caja.x + caja.width * 0.7, y: caja.y + caja.height * 0.9, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(300);
  expect(await canvas.evaluate((c) => document.pointerLockElement === c)).toBe(false);
});

/**
 * Dónde se ve en pantalla un punto 3D, con la posición y la mirada que publica el motor
 * (cámara a 1,6 m, campo de visión vertical de 70°).
 */
async function enPantalla(page: Page, caja: Caja, punto: [number, number, number]): Promise<Punto> {
  const [cx, cz] = await leer(page, 'data-posicion');
  const [yaw, pitch] = await leer(page, 'data-mirada');
  const d = [punto[0] - cx, punto[1] - 1.6, punto[2] - cz] as const;
  const f = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
  const punto3 = (v: readonly number[]) =>
    d[0] * (v[0] ?? 0) + d[1] * (v[1] ?? 0) + d[2] * (v[2] ?? 0);
  const profundidad = punto3(f);
  const t = Math.tan((35 * Math.PI) / 180);
  const ndcX = punto3(r) / (profundidad * t * (caja.width / caja.height));
  const ndcY = punto3(u) / (profundidad * t);
  return { x: caja.x + ((ndcX + 1) / 2) * caja.width, y: caja.y + ((1 - ndcY) / 2) * caja.height };
}

/** Gira la cámara arrastrando en horizontal (negativo: a la izquierda). */
async function girarCamara(page: Page, caja: Caja, dx: number, conDedo: boolean | undefined) {
  const y = caja.y + caja.height * 0.4;
  const desde = { x: dx > 0 ? caja.x + caja.width * 0.52 : caja.x + caja.width * 0.97, y };
  const hasta = { x: desde.x + dx, y };
  if (conDedo) await arrastrarDedos(page, [[desde, hasta]]);
  else await arrastrarRaton(page, desde, hasta);
}

test('las puertas llevan a la sala y de vuelta, y la sala que se deja se libera (T20)', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch;
  const { canvas, caja } = await abrirJuego(page);
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');

  // Girar hacia la puerta 2 (pared este) y acercarse un poco.
  await girarCamara(page, caja, Math.min(187, caja.width * 0.46), conDedo);
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
      { quieto: 600 },
    );
  else await arrastrarRaton(page, { x, y }, { x, y: y - 80 }, 600);

  // Tocar la puerta 2 donde se ve en pantalla y usarla.
  await tocar(page, await enPantalla(page, caja, [2.96, 1.1, 1.55]), conDedo);
  const puerta2 = page.getByRole('button', { name: /Usar.*Puerta 2/ });
  await expect(puerta2).toBeVisible();
  await puerta2.click();
  await expect(canvas).toHaveAttribute('data-sala', 's2-laboratorio');

  // En el laboratorio se aparece frente a la puerta, de espaldas a ella: dar media vuelta.
  const [, zLab] = await leer(page, 'data-posicion');
  expect(zLab).toBeCloseTo(1.98, 1);
  const media = -Math.min(353, caja.width * 0.9);
  await girarCamara(page, caja, media, conDedo);
  await girarCamara(page, caja, -Math.PI / 0.0045 - media, conDedo);
  await tocar(page, await enPantalla(page, caja, [0, 1.1, 2.96]), conDedo);
  const volver = page.getByRole('button', { name: /Usar.*Puerta a la portería/ });
  await expect(volver).toBeVisible();
  await volver.click();
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');

  // De vuelta en la portería: frente a la puerta 2, y el laboratorio ya no ocupa memoria.
  // Three sube cada geometría la primera vez que se ve, así que en la GPU puede haber menos
  // geometrías que mallas, pero nunca más: si el laboratorio no se hubiera liberado, sobrarían.
  const [xP, zP] = await leer(page, 'data-posicion');
  expect(xP).toBeCloseTo(1.98, 1);
  expect(zP).toBeCloseTo(1.55, 1);
  const mallasPorteria = Number(await canvas.getAttribute('data-mallas'));
  expect(mallasPorteria).toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-geometrias')))
    .toBeLessThanOrEqual(mallasPorteria);
});
