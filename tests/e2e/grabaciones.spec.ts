import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  caminarHasta,
  continuarEn,
  mirarHacia,
  tocarObjeto,
  type Caja,
  type Punto3,
} from './escena';

// T75: las tres grabaciones escondidas en las salas 2, 3 y 4. Por ahora solo se leen.

// El WebGL de las pruebas se dibuja con la CPU, y hay que cruzar cada sala caminando.
test.slow();

/** La cara del gabinete del laboratorio que mira hacia la sala. */
const GABINETE: Punto3 = [-3.9, 1, -2.4];
/** Los balones naranja y verde, sobre el carro del gimnasio. */
const BALON_NARANJA: Punto3 = [-8.42, 1.02, 0.16];
const BALON_VERDE: Punto3 = [-8.78, 1.02, 0.16];
/** El cactus del estante M de la biblioteca (correcciones del 25 de noviembre). */
const CACTUS: Punto3 = [-4.45, 1.54, 1.5];

/**
 * Camina hacia el objeto hasta tenerlo a menos de `cerca` metros. El objeto (o su mueble) es
 * sólido, así que si la prueba tarda en soltar el joystick el jugador se queda contra él.
 */
async function acercarse(
  page: Page,
  caja: Caja,
  objeto: Punto3,
  cerca: number,
  conDedo: boolean,
): Promise<void> {
  await mirarHacia(page, caja, objeto, conDedo);
  await caminarHasta(
    page,
    caja,
    conDedo,
    (x, z) => Math.hypot(x - objeto[0], z - objeto[2]) < cerca,
  );
}

test('sala 2: con la linterna se ven las flechas y el gabinete entrega la grabación 1', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  const caja = await continuarEn(page, {
    sala: 's2-laboratorio',
    inventario: ['porteria-linterna', 'porteria-cuaderno'],
  });
  // La linterna está en el inventario: las flechas del piso se ven.
  await expect(canvas).toHaveAttribute('data-detalle', 'flechas');

  await acercarse(page, caja, GABINETE, 2.2, conDedo);
  await tocarObjeto(page, caja, GABINETE, conDedo, /Usar.*Gabinete/);
  await page.getByRole('button', { name: /Usar.*Gabinete/ }).click();

  const panel = page.getByRole('dialog', { name: 'Encontraste una grabación' });
  await expect(panel).toContainText('Grabación 1 de 3');
  await expect(panel).toContainText('En el gabinete del laboratorio');
  await expect(panel).toContainText('Soy Tobías Rincón. En 1991 fui el jurado más nuevo.');
  await expect(panel).toContainText('Llevas 1 de 3 grabaciones. Faltan 2, en otras salas.');
  await panel.getByRole('button', { name: 'Seguir' }).click();
  await expect(panel).toHaveCount(0);

  // No abrió la máquina de la sala, y el texto quedó en el cuaderno.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const seccion = cuaderno.getByRole('region', { name: 'Grabaciones' });
  await expect(seccion).toContainText('Grabación 1 de 3');
  await expect(seccion).toContainText('Guardé las pruebas por si alguien quería revisar.');
  await cuaderno.getByRole('button', { name: 'Cerrar' }).click();

  // Usar el gabinete otra vez la muestra de nuevo, sin sumar otra.
  await page.getByRole('button', { name: /Usar.*Gabinete/ }).click();
  await expect(panel).toContainText('Llevas 1 de 3 grabaciones');
});

test('sala 2: sin la linterna no hay flechas en el piso', async ({ page }) => {
  await continuarEn(page, { sala: 's2-laboratorio', inventario: ['porteria-cuaderno'] });
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-detalle', 'sin-flechas');
  // Sin grabaciones, el cuaderno no tiene esa sección.
  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await expect(cuaderno).toBeVisible();
  await expect(cuaderno.getByRole('region', { name: 'Grabaciones' })).toHaveCount(0);
});

test('sala 3: los balones rebotan y el que no rebota entrega la grabación 2', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  const caja = await continuarEn(page, { sala: 's3-gimnasio', grabaciones: ['grab-1'] });
  await acercarse(page, caja, BALON_NARANJA, 1.9, conDedo);

  // Un balón normal rebota y no pasa nada más: ni grabación ni panel de la máquina.
  await tocarObjeto(page, caja, BALON_NARANJA, conDedo, /Usar.*Balón naranja/);
  await page.getByRole('button', { name: /Usar.*Balón naranja/ }).click();
  await expect(canvas).toHaveAttribute('data-detalle', 'rebotando');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // El verde no rebota: está desinflado y guarda la grabación.
  await tocarObjeto(page, caja, BALON_VERDE, conDedo, /Usar.*Balón verde/);
  await page.getByRole('button', { name: /Usar.*Balón verde/ }).click();
  await expect(canvas).toHaveAttribute('data-detalle', 'sin-rebote');
  const panel = page.getByRole('dialog', { name: 'Encontraste una grabación' });
  await expect(panel).toContainText('Grabación 2 de 3');
  await expect(panel).toContainText('Tenía quince años y un filtro de agua para su vereda.');
  await expect(panel).toContainText('Llevas 2 de 3 grabaciones. Falta una, en otras salas.');
});

test('sala 4: el cactus del estante M entrega la grabación 3', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, {
    sala: 's4-biblioteca',
    grabaciones: ['grab-1', 'grab-2'],
  });
  await acercarse(page, caja, CACTUS, 2, conDedo);
  await tocarObjeto(page, caja, CACTUS, conDedo, /Usar.*Cactus del estante M/);
  await page.getByRole('button', { name: /Usar.*Cactus del estante M/ }).click();

  const panel = page.getByRole('dialog', { name: 'Encontraste una grabación' });
  await expect(panel).toContainText('Grabación 3 de 3');
  await expect(panel).toContainText('Él nunca se fue del todo.');
  await expect(panel).toContainText('Ya tienes las tres grabaciones');
});
