import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// T31b: el controlador real de la partida, visto desde la portería. Se toca cada objeto donde
// se ve en pantalla, como haría un jugador: dedo en el perfil celular y ratón en escritorio.
//
// Las ayudas de abajo repiten las de `controles.spec.ts` (otra sesión lo está cambiando); aquí
// se gira leyendo la mirada que publica el motor, sin depender de la sensibilidad.

// El WebGL de las pruebas se dibuja con la CPU: cada evento de entrada tarda más que en un
// teléfono real.
test.slow();

interface Punto {
  x: number;
  y: number;
}

interface Caja extends Punto {
  width: number;
  height: number;
}

type Punto3 = [number, number, number];

const ALTURA_OJOS = 1.6;

async function arrastrar(page: Page, a: Punto, b: Punto, conDedo: boolean, quieto = 0) {
  if (!conDedo) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    if (quieto > 0) await page.waitForTimeout(quieto);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const punto = (t: number) => [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(0) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(i / 10) });
  }
  if (quieto > 0) await page.waitForTimeout(quieto);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Toque corto en (x, y): dedo en celular, clic en escritorio. */
async function tocar(page: Page, p: Punto, conDedo: boolean): Promise<void> {
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

async function leer(page: Page, atributo: string): Promise<[number, number]> {
  const valor = await page.getByLabel('Escena del juego').getAttribute(atributo);
  const [a = NaN, b = NaN] = (valor ?? '').split(',').map(Number);
  return [a, b];
}

/** Abre /jugar, espera al motor y toca «Jugar solo». */
async function abrirJuego(page: Page): Promise<Caja> {
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  // Detrás del menú el motor está listo, pero no dibuja (T20b).
  await expect(canvas).toHaveAttribute('data-motor', 'pausado');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  // La sala ya se dibujó al menos una vez: hay mirada y posición que leer.
  await expect(canvas).toHaveAttribute('data-mirada', /,/);
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

/** Diferencia entre dos ángulos, entre −π y π. */
const diferencia = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * Gira hasta mirar hacia el punto (en horizontal), arrastrando en la mitad derecha. Lee la
 * mirada después de cada arrastre y corrige, así que no importa cuánto gira cada píxel.
 */
async function mirarHacia(page: Page, caja: Caja, punto: Punto3, conDedo: boolean): Promise<void> {
  const [cx, cz] = await leer(page, 'data-posicion');
  // «Adelante» con yaw es (−sen yaw, −cos yaw).
  const objetivo = Math.atan2(-(punto[0] - cx), -(punto[2] - cz));
  const y = caja.y + caja.height * 0.4;
  let pxPorRadian = 1 / 0.0045;
  for (let i = 0; i < 8; i++) {
    const [yaw] = await leer(page, 'data-mirada');
    const falta = diferencia(objetivo, yaw);
    // Con 0,08 rad el objeto ya queda en pantalla, y un arrastre menor parecería un toque.
    if (Math.abs(falta) < 0.08) return;
    // Arrastrar a la derecha baja el yaw. Cada arrastre cabe en la mitad derecha.
    const dx = Math.max(-caja.width * 0.42, Math.min(caja.width * 0.42, -falta * pxPorRadian));
    const desde = { x: dx > 0 ? caja.x + caja.width * 0.54 : caja.x + caja.width * 0.97, y };
    await arrastrar(page, desde, { x: desde.x + dx, y }, conDedo);
    await expect
      .poll(async () => Math.abs(diferencia((await leer(page, 'data-mirada'))[0], yaw)))
      .toBeGreaterThan(0.005);
    const girado = diferencia((await leer(page, 'data-mirada'))[0], yaw);
    if (Math.abs(girado) > 0.01) pxPorRadian = Math.abs(dx / girado);
  }
  throw new Error('no se pudo girar hacia el punto');
}

/** Camina de frente con el joystick (mitad izquierda) durante `ms`. */
async function caminar(page: Page, caja: Caja, ms: number, conDedo: boolean): Promise<void> {
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  await arrastrar(page, { x, y }, { x, y: y - 80 }, conDedo, ms);
}

/**
 * Dónde se ve en pantalla un punto 3D, con la posición y la mirada que publica el motor
 * (cámara a 1,6 m, campo de visión vertical de 70°).
 */
async function enPantalla(page: Page, caja: Caja, punto: Punto3): Promise<Punto> {
  const [cx, cz] = await leer(page, 'data-posicion');
  const [yaw, pitch] = await leer(page, 'data-mirada');
  const d = [punto[0] - cx, punto[1] - ALTURA_OJOS, punto[2] - cz] as const;
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

/** Mira hacia el objeto y lo toca donde se ve. */
async function tocarObjeto(page: Page, caja: Caja, punto: Punto3, conDedo: boolean) {
  await mirarHacia(page, caja, punto, conDedo);
  await tocar(page, await enPantalla(page, caja, punto), conDedo);
}

// Centros de los objetos de la portería (src/content/salas.json), a la altura donde se tocan.
const CUADERNO: Punto3 = [-2.3, 0.47, 3.55];
const LINTERNA: Punto3 = [2, 0.87, 3.4];
const PUERTA_2: Punto3 = [2.96, 1.1, 1.55];
const INTERCOMUNICADOR: Punto3 = [-2.96, 1.5, -3.9];
/** Cara del casillero de objetos perdidos que se ve desde el fondo del pasillo. */
const CASILLERO: Punto3 = [1.5, 1, -4.7];

test('el cuaderno se activa al recogerlo y la linterna entra una sola vez', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await abrirJuego(page);
  const inventario = page.getByRole('list', { name: 'Inventario' }).getByRole('listitem');
  const cuaderno = page.getByRole('button', { name: 'Cuaderno', exact: true });
  await expect(inventario).toHaveCount(0);
  await expect(cuaderno).toHaveCount(0);

  // El cuaderno está en la silla, a la izquierda de la entrada.
  await tocarObjeto(page, caja, CUADERNO, conDedo);
  await page.getByRole('button', { name: /Recoger.*Cuaderno/ }).click();
  await expect(cuaderno).toBeVisible();
  await expect(inventario).toHaveCount(0);
  await expect(page.locator('[aria-live="polite"]')).toHaveText('Recogiste: Cuaderno.');

  // La linterna está en el escritorio, a la derecha.
  await tocarObjeto(page, caja, LINTERNA, conDedo);
  await page.getByRole('button', { name: /Recoger.*Linterna/ }).click();
  await expect(inventario).toHaveText(['Linterna']);

  // Ya no está en el escritorio: tocar el mismo sitio no ofrece recogerla otra vez.
  await tocar(page, await enPantalla(page, caja, LINTERNA), conDedo);
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: /Recoger/ })).toHaveCount(0);
  await expect(inventario).toHaveText(['Linterna']);
  // En escritorio, ese clic en un sitio vacío bloquea el ratón (T19): se suelta, como con Esc.
  await page.evaluate(() => document.exitPointerLock());

  // El botón del cuaderno abre el cuaderno.
  await cuaderno.click();
  await expect(page.getByRole('dialog', { name: 'Tu cuaderno' })).toBeVisible();
});

test('la puerta 2 sigue cerrada hasta tener el sello de la sala 1', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await abrirJuego(page);

  await mirarHacia(page, caja, PUERTA_2, conDedo);
  await caminar(page, caja, 600, conDedo);
  await tocarObjeto(page, caja, PUERTA_2, conDedo);
  await page.getByRole('button', { name: /Usar.*Puerta 2/ }).click();

  await expect(page.locator('.hud-aviso')).toContainText('La puerta 2 está cerrada');
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 'porteria');
});

test('la puerta de salida pide los sellos y el intercomunicador lleva a «Pedir ayuda»', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await abrirJuego(page);

  // Hasta la pared del fondo: a 2 m/s, 6,5 s alcanzan para los 10 m del pasillo.
  await caminar(page, caja, 6500, conDedo);
  await tocar(page, { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }, conDedo);
  await page.getByRole('button', { name: /Usar.*Puerta de salida/ }).click();

  const salida = page.getByRole('dialog', { name: 'Puerta de salida' });
  await expect(salida).toContainText('En el mural faltan 5 sellos.');
  await expect(salida.getByRole('button', { name: 'Salir' })).toHaveCount(0);
  await salida.getByRole('button', { name: 'Volver' }).click();
  await expect(salida).toHaveCount(0);
  // «Usar» soltó la puerta, así que no hay botón al que volver: el foco queda en el HUD.
  await expect(page.getByRole('heading', { level: 1, name: 'Partida en curso' })).toBeFocused();

  // Al cerrar la ficha de un objeto real, el foco vuelve a su botón «Examinar».
  await tocarObjeto(page, caja, CASILLERO, conDedo);
  const examinar = page.getByRole('button', { name: /Examinar.*Casillero/ });
  await examinar.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(examinar).toBeFocused();

  // El intercomunicador está en la pared izquierda, cerca del fondo.
  await mirarHacia(page, caja, INTERCOMUNICADOR, conDedo);
  await caminar(page, caja, 500, conDedo);
  await tocarObjeto(page, caja, INTERCOMUNICADOR, conDedo);
  await page.getByRole('button', { name: /Usar.*Intercomunicador/ }).click();

  const ayuda = page.getByRole('dialog', { name: 'Intercomunicador de emergencia' });
  await expect(ayuda).toBeVisible();
  // Arrepentirse deja la partida como estaba.
  await ayuda.getByRole('button', { name: 'Seguir intentando' }).click();
  await expect(page.getByRole('timer')).toBeVisible();

  await tocarObjeto(page, caja, INTERCOMUNICADOR, conDedo);
  await page.getByRole('button', { name: /Usar.*Intercomunicador/ }).click();
  await ayuda.getByRole('button', { name: 'Pedir ayuda' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'También vale pedir ayuda' }),
  ).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
});

// T31c: la partida se guarda en el equipo y se puede continuar después de recargar.

test('al recargar, «Continuar partida» devuelve el cuaderno, sus notas y el reloj', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await abrirJuego(page);
  // Sin partida guardada, el menú no ofrecía continuar (ya se tocó «Jugar solo»).
  await tocarObjeto(page, caja, CUADERNO, conDedo);
  await page.getByRole('button', { name: /Recoger.*Cuaderno/ }).click();
  await page.getByRole('button', { name: 'Cuaderno', exact: true }).click();
  let cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await cuaderno.getByLabel('Nueva nota').fill('la puerta 2 sigue cerrada');
  await cuaderno.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(cuaderno.getByRole('listitem')).toHaveCount(1);

  // Recargar, como cuando Safari se queda sin memoria.
  await page.reload();
  await expect(
    page.getByText(/Tienes una partida guardada: te quedan (40:00|3\d:\d\d)/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continuar partida' }).click();

  // El reloj sigue corriendo desde lo que quedaba y el cuaderno conserva la nota.
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^Tiempo restante: 3\d min/);
  await expect(page.getByRole('timer')).not.toHaveAttribute('aria-label', /en pausa/);
  await page.getByRole('button', { name: 'Cuaderno', exact: true }).click();
  cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await expect(cuaderno.getByRole('listitem')).toHaveText(/la puerta 2 sigue cerrada/);

  // Una nota nueva no reemplaza a la guardada (sigue la numeración).
  await cuaderno.getByLabel('Nueva nota').fill('segunda nota');
  await cuaderno.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(cuaderno.getByRole('listitem')).toHaveCount(2);
  await cuaderno.getByRole('button', { name: 'Cerrar' }).click();

  // «Salir» abandona la partida: el menú ya no ofrece continuar.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
});

test('con el almacenamiento bloqueado (pestaña privada) se juega sin errores y sin guardar', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Safari con el almacenamiento bloqueado lanza un error con solo leer `localStorage`.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await abrirJuego(page);
  await expect(page.getByRole('timer')).toBeVisible();
  // Ocultar la pestaña es uno de los momentos en que se guarda.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('timer')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
  expect(errores).toEqual([]);
});
