import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { puntoDeEntrada } from '../../src/engine/salas/recorrido';
import { cruzar, salaPorId, volverALaEntrada } from './recorrido';
import { tocar } from './toque';

// Controles del motor (T14, T15). En el perfil celular se usan toques reales por CDP
// (varios dedos a la vez); en escritorio, el ratón.

// El WebGL de las pruebas se dibuja con la CPU (SwiftShader): con la escena en marcha, cada
// evento de entrada tarda más que en un teléfono real. Estas pruebas tienen el triple de tiempo.
test.slow();

interface Punto {
  x: number;
  y: number;
}

interface OpcionesArrastre {
  pasos?: number;
  /** Tiempo con el dedo (o el botón) quieto al final del trazo, en ms. */
  quieto?: number;
  /** Si se da, antes de `quieto` se espera con el dedo abajo hasta que se cumpla. */
  hasta?: () => Promise<void>;
}

/** Arrastra uno o varios dedos a la vez, en `pasos` movimientos, y los deja quietos al final. */
async function arrastrarDedos(
  page: Page,
  trazos: [Punto, Punto][],
  { pasos = 10, quieto = 0, hasta }: OpcionesArrastre = {},
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
  try {
    if (hasta) await hasta();
    if (quieto > 0) await page.waitForTimeout(quieto);
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
}

async function arrastrarRaton(
  page: Page,
  a: Punto,
  b: Punto,
  quieto = 0,
  hasta?: () => Promise<void>,
): Promise<void> {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  try {
    if (hasta) await hasta();
    if (quieto > 0) await page.waitForTimeout(quieto);
  } finally {
    await page.mouse.up();
  }
}

/** Abre /jugar y toca «Jugar solo»: los controles solo funcionan con la partida en marcha. */
async function abrirJuego(page: Page) {
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  // Detrás del menú el motor está listo, pero no dibuja (T20b). Es la espera más larga de cada
  // prueba: descargar el juego y arrancar WebGL por software con el equipo ocupado (T05b).
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  // El menú de inicio (T32) tapa la escena hasta que se toca «Jugar solo». Un solo clic:
  // después del primero el menú desaparece.
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  // La sala ya se dibujó al menos una vez: hay mirada y posición que leer.
  await expect(canvas).toHaveAttribute('data-mirada', /,/);
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

  // Con yaw 0, adelante es −Z. Se suelta cuando ya avanzó, no tras un tiempo fijo (T05b).
  const avanzo = (): Promise<void> =>
    expect.poll(async () => (await leer(page, 'data-posicion'))[1]).toBeLessThan(z0 - 0.3);
  if (info.project.use.hasTouch) await arrastrarDedos(page, [[desde, hasta]], { hasta: avanzo });
  else await arrastrarRaton(page, desde, hasta, 0, avanzo);

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
    {
      // Se sueltan cuando ya caminó, no tras un tiempo fijo (T05b).
      hasta: () =>
        expect
          .poll(async () => {
            const [x1, z1] = await leer(page, 'data-posicion');
            return Math.hypot(x1, z1 - z0);
          })
          .toBeGreaterThan(0.3),
    },
  );

  await expect.poll(async () => (await leer(page, 'data-mirada'))[0]).toBeGreaterThan(yaw0 + 0.1);
});

test('el joystick se dibuja donde toca el dedo y la perilla lo sigue (T15b)', async ({
  page,
}, info) => {
  test.skip(!info.project.use.hasTouch, 'táctil solo en el perfil celular');
  const { caja } = await abrirJuego(page);
  const base = page.locator('.joystick');
  const centro = async (selector: string): Promise<Punto> => {
    const c = await page.locator(selector).boundingBox();
    if (!c) throw new Error(`sin ${selector}`);
    return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  };

  // En reposo, una guía tenue en la mitad izquierda dice dónde poner el pulgar.
  await expect(base).toBeVisible();
  await expect(base).not.toHaveClass(/joystick-activo/);
  expect((await centro('.joystick')).x).toBeLessThan(caja.x + caja.width / 2);
  // El dibujo no recibe toques: no puede estorbar a la escena ni al HUD.
  expect(await base.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

  const dedo = { x: caja.x + caja.width * 0.3, y: caja.y + caja.height * 0.5 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...dedo, id: 1 }],
  });
  // El dedo sube 30 px: menos que el radio, así que la perilla queda justo debajo del dedo.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: dedo.x, y: dedo.y - 30, id: 1 }],
  });
  await expect(base).toHaveClass(/joystick-activo/);
  await expect.poll(async () => (await centro('.joystick-perilla')).y).toBeCloseTo(dedo.y - 30, 0);
  const b = await centro('.joystick');
  expect(b.x).toBeCloseTo(dedo.x, 0);
  expect(b.y).toBeCloseTo(dedo.y, 0);
  expect((await centro('.joystick-perilla')).x).toBeCloseTo(dedo.x, 0);

  // Si el dedo se aleja más que el radio (56 px), la perilla se queda en el borde.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: dedo.x, y: dedo.y - 150, id: 1 }],
  });
  await expect.poll(async () => (await centro('.joystick-perilla')).y).toBeCloseTo(dedo.y - 56, 0);

  // Al soltar, vuelve a la guía en reposo.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(base).not.toHaveClass(/joystick-activo/);
});

/**
 * Espera a que el jugador llegue a la pared del fondo de la portería (z = −5; con 30 cm de
 * radio, queda en −4,7).
 *
 * No se espera un tiempo fijo (T05b). A 2 m/s el pasillo se cruza en unos 4,5 s, pero el motor
 * nunca avanza más de 0,1 s por cuadro (`DT_MAX`): con el WebGL por software y el equipo
 * ocupado, los cuadros tardan más que eso y el jugador camina más despacio que el reloj.
 */
const llegarAlFondo = (page: Page) => (): Promise<void> =>
  expect
    .poll(async () => (await leer(page, 'data-posicion'))[1], { timeout: 45_000 })
    .toBeLessThan(-4.65);
/** Tiempo que se sigue empujando contra la pared, para ver que no se atraviesa. */
const EMPUJE_MS = 500;

/** Camina de frente con el joystick (o el ratón) hasta la pared del fondo de la portería. */
async function caminarAlFondo(page: Page, caja: Caja, conDedo: boolean | undefined) {
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  const trazo: [Punto, Punto] = [
    { x, y },
    { x, y: y - 80 },
  ];
  const hasta = llegarAlFondo(page);
  if (conDedo) await arrastrarDedos(page, [trazo], { quieto: EMPUJE_MS, hasta });
  else await arrastrarRaton(page, trazo[0], trazo[1], EMPUJE_MS, hasta);
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

/**
 * Toca un objeto y espera a que el HUD muestre su botón (T05b). Si el botón no aparece, toca
 * otra vez: volver a tocar el mismo objeto lo deja enfocado, así que repetir no hace daño.
 */
async function tocarHasta(
  page: Page,
  p: Punto,
  conDedo: boolean | undefined,
  boton: Locator,
): Promise<void> {
  await expect(async () => {
    await tocar(page, p, conDedo);
    await expect(boton).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 45_000 });
}

test('tocar la puerta de salida la enfoca y el botón del HUD la usa (T18)', async ({
  page,
}, info) => {
  const { caja } = await abrirJuego(page);
  const conDedo = info.project.use.hasTouch;
  await caminarAlFondo(page, caja, conDedo);

  // El centro de la pantalla apunta a la puerta de salida, a 30 cm.
  const boton = page.getByRole('button', { name: /Usar.*Puerta de salida/ });
  await tocarHasta(
    page,
    { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 },
    conDedo,
    boton,
  );

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
  await llegarAlFondo(page)();
  await page.waitForTimeout(EMPUJE_MS);
  await page.keyboard.up('KeyW');
  const [, z1] = await leer(page, 'data-posicion');
  // Se detiene contra la pared del fondo (T17).
  expect(z1).toBeGreaterThan(-4.75);
  expect(z1).toBeLessThan(-4);

  // Apuntar a la puerta de salida con un clic y usarla con E.
  const boton = page.getByRole('button', { name: /Usar.*Puerta de salida/ });
  await tocarHasta(page, { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }, false, boton);
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
  // Sin el ratón bloqueado no hay mira ni aviso (T15b).
  const aviso = page.getByText('Esc para soltar el ratón');
  await expect(aviso).toHaveCount(0);
  await expect(page.locator('.mira')).toHaveCount(0);
  // El clic lleva su duración (`tocar`, T05b): con la CPU ocupada, un clic normal de Playwright
  // tarda más de lo que cuenta como toque corto y no bloquea. Si aun así no bloqueó, se repite:
  // un clic con el ratón ya bloqueado no hace nada aquí.
  await expect(async () => {
    await tocar(page, { x: caja.x + caja.width * 0.7, y: caja.y + caja.height * 0.9 }, false);
    await expect.poll(bloqueado, { timeout: 5000 }).toBe(true);
  }).toPass({ timeout: 60_000 });
  // Con el ratón bloqueado se ven la mira, en el centro, y el aviso para soltarlo (T15b).
  await expect(aviso).toBeVisible();
  const mira = await page.locator('.mira').boundingBox();
  if (!mira) throw new Error('sin mira');
  expect(mira.x + mira.width / 2).toBeCloseTo(caja.x + caja.width / 2, 0);
  expect(mira.y + mira.height / 2).toBeCloseTo(caja.y + caja.height / 2, 0);
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

test('las puertas llevan a la sala y de vuelta, y la sala que se deja se libera (T20)', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch;
  const { canvas, caja } = await abrirJuego(page);
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');

  // La puerta 1 es la única abierta al empezar (T31b). Desde el pasillo (docs/pasillos.md) se
  // llega caminando por el vano y el tramo 1, como en la partida completa.
  await cruzar(page, caja, conDedo === true, 'porteria-puerta-1');
  // La puerta suena al abrirse (T42c).
  await expect(canvas).toHaveAttribute('data-sonidos', /(^| )puerta( |$)/);
  await volverALaEntrada(page, caja, conDedo === true, 's1-cooperativa');
  await cruzar(page, caja, conDedo === true, 's1-puerta');
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');

  // De vuelta en la portería: frente a la puerta 1, y la cooperativa ya no ocupa memoria.
  // Three sube cada geometría la primera vez que se ve, así que en la GPU puede haber menos
  // geometrías que mallas, pero nunca más: si la cooperativa no se hubiera liberado, sobrarían.
  // `cruzar` ya esperó a estar 1 m delante de la puerta 1, en el pasillo.
  const [xVuelta, zVuelta] = await leer(page, 'data-posicion');
  const vuelta = puntoDeEntrada(salaPorId('porteria'), 's1-cooperativa');
  expect(Math.hypot(xVuelta - vuelta.x, zVuelta - vuelta.z)).toBeLessThan(0.2);
  const mallasPorteria = Number(await canvas.getAttribute('data-mallas'));
  expect(mallasPorteria).toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-geometrias')))
    .toBeLessThanOrEqual(mallasPorteria);
});
