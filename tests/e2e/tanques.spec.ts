import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { caminarHasta, continuarEn, mirarHacia, tocarObjeto, type Punto3 } from './escena';

// T52: los tanques de la sala 2, de punta a punta. Las corridas duran lo que tarda la campana
// de cada etapa (10, 8 y 12 segundos), en tiempo real.
// Corrección del 25 de noviembre: cada etapa tiene su estación (su tanque o sus tanques, su
// tablero y su palanca), y solo esa estación la resuelve.

// El WebGL de las pruebas se dibuja con la CPU, y las corridas suman casi un minuto.
test.slow();

/** El tablero de cada estación: el mueble con la perilla y la palanca. Su cara mira a la puerta. */
const TABLEROS: readonly Punto3[] = [
  [-2, 0.55, -0.85],
  [-0.4, 0.55, -0.85],
  [2, 0.55, -0.85],
];
/** Lo que se espera a que suene la campana más larga, con el equipo ocupado. */
const HASTA_LA_CAMPANA = { timeout: 40_000 };
const TITULO = 'Los tanques y el graficador';

interface Opciones {
  etapas?: number;
  inventario?: readonly string[];
}

/** Entra a la sala con esas etapas resueltas y camina hasta el tablero de la estación `n` (1 a 3). */
async function acercarseA(page: Page, conDedo: boolean, n: number, opciones: Opciones = {}) {
  const caja = await continuarEn(page, { sala: 's2-laboratorio', ...opciones });
  const tablero = TABLEROS[n - 1];
  if (!tablero) throw new Error(`no hay estación ${n}`);
  // Desde la puerta, el tablero queda a más de 3 m: hay que acercarse. Se camina hacia él, así
  // que si la prueba tarda en soltar el joystick, el propio tablero detiene al jugador.
  await mirarHacia(page, caja, tablero, conDedo);
  await caminarHasta(page, caja, conDedo, (_x, z) => z < 0.9);
  return { caja, tablero };
}

async function abrirEstacion(page: Page, conDedo: boolean, n: number, opciones: Opciones = {}) {
  const { caja, tablero } = await acercarseA(page, conDedo, n, opciones);
  const nombre = new RegExp(`Usar.*Tablero de la estación ${n}`);
  const usar = page.getByRole('button', { name: nombre });
  const panel = page.getByRole('dialog', { name: TITULO });
  // Con el equipo ocupado, el botón puede cambiar entre que aparece y el toque: se repite.
  for (let intento = 0; intento < 3 && !(await panel.isVisible()); intento++) {
    await tocarObjeto(page, caja, tablero, conDedo, nombre);
    await usar.click({ timeout: 5000 }).catch(() => undefined);
    await panel.waitFor({ timeout: 10_000 }).catch(() => undefined);
  }
  await expect(panel).toBeVisible();
  return panel;
}

/** Sube el caudal de A, de a un toque, hasta `caudal` cm/s. */
async function ponerCaudal(panel: Locator, caudal: number): Promise<void> {
  const mas = panel.getByRole('button', { name: 'Más: Perilla verde: caudal del tanque A' });
  const valor = panel.locator('.pasos-valor');
  for (let i = 0; i < 6 && (await valor.textContent()) !== `${caudal} cm/s`; i++) await mas.click();
  await expect(valor).toHaveText(`${caudal} cm/s`);
}

test('estación 1: una corrida que no llega y otra que sí; al resolverla se vuelve a la sala', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  const panel = await abrirEstacion(page, conDedo, 1);
  const palanca = panel.getByRole('button', { name: 'Bajar la palanca' });
  const respuesta = panel.locator('.respuesta');

  // Etapa 1 · A debe llegar a la línea roja de 30 cm a los 10 s.
  await expect(panel).toContainText('Sala 2 · Etapa 1 de 3');
  await expect(panel).toContainText('La campana suena a los 10 segundos.');
  await expect(panel.locator('.tanque')).toHaveCount(1);
  await ponerCaudal(panel, 2);
  await palanca.click();
  // Durante la corrida no se puede accionar ni mover la perilla, y la máquina aún no dice nada.
  await expect(panel).toContainText('Corriendo:');
  await expect(palanca).toHaveCount(0);
  await expect(respuesta).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^Más:/ })).toBeDisabled();
  await expect(canvas).toHaveAttribute('data-maquina', 'corriendo');
  // Al sonar la campana, la máquina muestra lo que pasó, sin decir «incorrecto».
  await expect(respuesta).toContainText('el tanque A estaba en 20 cm', HASTA_LA_CAMPANA);
  await expect(respuesta).toContainText('La línea roja está en 30 cm.');
  await expect(panel).not.toContainText(/incorrect/i);
  // Los tanques se vacían, vuelve la palanca y el trazo queda en el papel, más tenue.
  await expect(palanca).toBeVisible();
  await expect(panel.locator('.trazos-anteriores .trazo-a')).toHaveCount(1);

  await ponerCaudal(panel, 3);
  await palanca.click();
  await expect(respuesta).toContainText('estaba en 30 cm', HASTA_LA_CAMPANA);
  await expect(respuesta).toContainText('Justo en la línea roja.');
  // La etapa siguiente está en otra estación: el panel lo dice y vuelve a la sala.
  await expect(panel).toContainText('Ahora se encendió la estación 2');
  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Sellos: 1 de 5' })).toBeVisible();
});

test('estación 2: los dos tanques se cruzan a la misma altura', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const panel = await abrirEstacion(page, conDedo, 2, { etapas: 1 });
  const respuesta = panel.locator('.respuesta');

  // Etapa 2 · B baja 2 cm/s desde 50 cm; A sube desde 10 cm. Se cruzan en 34 cm a los 8 s.
  await expect(panel).toContainText('Sala 2 · Etapa 2 de 3');
  await expect(panel.locator('.tanque')).toHaveCount(2);
  await expect(panel).toContainText('El tanque B empieza en 50 cm y baja 2 cm cada segundo.');
  await expect(panel.locator('.trazo')).toHaveCount(0);
  await ponerCaudal(panel, 3);
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  await expect(respuesta).toContainText(
    'los tanques A y B estaban en 34 cm: a la misma altura',
    HASTA_LA_CAMPANA,
  );
  await expect(panel).toContainText('Ahora se encendió la estación 3');
  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
});

test('estación 3: con el tanque B tapado y la hoja de ayer se gana el sello', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  // La hoja de ayer ya está recogida: sus marcas deben salir en el graficador de la etapa 3.
  const panel = await abrirEstacion(page, conDedo, 3, {
    etapas: 2,
    inventario: ['s2-hoja-ayer'],
  });
  const respuesta = panel.locator('.respuesta');

  // Etapa 3 · B está tapado; la hoja de ayer da dos marcas. Se cruzan en 24 cm a los 12 s.
  await expect(panel).toContainText('Sala 2 · Etapa 3 de 3');
  await expect(panel).toContainText('tapado con cinta');
  await expect(panel.locator('.marca-ayer')).toHaveCount(2);
  await ponerCaudal(panel, 2);
  await panel.getByRole('button', { name: 'Bajar la palanca' }).click();
  await expect(respuesta).toContainText('el tanque A estaba en 24 cm', HASTA_LA_CAMPANA);
  // El tanque tapado no se dibuja.
  await expect(panel.locator('.trazo-b')).toHaveCount(0);
  await expect(respuesta).toContainText('Las tres estaciones quedaron resueltas.');
  await expect(panel).toContainText('Conseguiste el sello de esta sala');

  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Sellos: 2 de 5' })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-maquina', 'sellada');
});

test('una estación que todavía está apagada no abre el panel y dice por qué', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const { caja, tablero } = await acercarseA(page, conDedo, 2);
  const nombre = /Usar.*Tablero de la estación 2/;
  await tocarObjeto(page, caja, tablero, conDedo, nombre);
  await page.getByRole('button', { name: nombre }).click();
  // El aviso sale en el HUD (y repetido para el lector de pantalla).
  await expect(page.locator('.hud-aviso')).toHaveText(
    'La estación 2 todavía está apagada. La que está encendida es la 1.',
  );
  await expect(page.getByRole('dialog', { name: TITULO })).toHaveCount(0);
});

test('sin la hoja de ayer, el graficador de la etapa 3 no tiene marcas', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const panel = await abrirEstacion(page, conDedo, 3, { etapas: 2 });
  await expect(panel).toContainText('Sala 2 · Etapa 3 de 3');
  await expect(panel).toContainText('tapado con cinta');
  await expect(panel.locator('.marca-ayer')).toHaveCount(0);
  // El nivel y el caudal de B no se dicen en ninguna parte.
  await expect(panel).not.toContainText('48 cm');
  await expect(panel).not.toContainText('baja 2 cm');
});
