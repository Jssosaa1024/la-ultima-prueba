import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { continuarEn, tocarObjeto, type Caja, type Punto3 } from './escena';
import { caminarHasta } from './maquinas';

// T58: sala 3, el reflector. Se entra con una partida guardada en el gimnasio, se camina hasta
// la cancha y se abre el panel tocando el poste de 2 m, como haría un jugador.

// El WebGL de las pruebas se dibuja con la CPU: cada evento de entrada tarda más que en un
// teléfono real.
test.slow();

/** El poste de 2 m, a la altura de los ojos: está en la cancha en las etapas 1 y 3. */
const POSTE_2M: Punto3 = [2, 1.3, -1];

/** Camina de la puerta a la cancha y abre el panel del reflector tocando el poste de 2 m. */
async function abrirPanel(page: Page, caja: Caja, conDedo: boolean) {
  // De frente hasta que el riel de los postes (z = −1) detenga al jugador: queda a 2 m del poste.
  await caminarHasta(page, caja, conDedo, (_x, z) => z <= -0.55);
  await tocarObjeto(page, caja, POSTE_2M, conDedo, /Usar.*Postes de voleibol/);
  await page.getByRole('button', { name: /Usar.*Postes de voleibol/ }).click();
  const panel = page.getByRole('dialog', { name: 'El reflector y las sombras' });
  await expect(panel).toBeVisible();
  return panel;
}

test('presentar: al inclinar el reflector, la sombra toca el sensor y la etapa se resuelve sola', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, { sala: 's3-gimnasio' });
  const panel = await abrirPanel(page, caja, conDedo);

  await expect(panel).toContainText('Sala 3 · Etapa 1 de 3');
  // Con la muesca inicial (63°) la sombra queda corta: la máquina lo cuenta, sin calificar.
  await expect(panel).toContainText('Poste de 2 m: su sombra mide 1 m.');
  await expect(panel).toContainText('La punta se queda antes del sensor, que está a 2 m.');
  await expect(panel.getByRole('button', { name: '63°' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('Sensor del poste de 2 m: apagado');
  // Esta etapa responde sola: no hay nada que accionar.
  await expect(panel.getByRole('button', { name: 'Soltar la polea' })).toHaveCount(0);

  await panel.getByRole('button', { name: '27°' }).click();
  await expect(panel).toContainText('su sombra mide 4 m. La punta pasa de largo del sensor');

  await panel.getByRole('button', { name: '45°' }).click();
  await expect(panel).toContainText('su sombra mide 2 m. La punta toca el sensor y suena.');
  await expect(panel).toContainText('Sensor del poste de 2 m: encendido');

  // Tras 5 segundos quieta, la máquina acepta los ajustes y el panel espera el «Seguir».
  await expect(panel).toContainText('La máquina aceptó los ajustes', { timeout: 30_000 });
  await expect(panel).toContainText('A 45° la sombra mide lo mismo que el poste.');
  await expect(panel).not.toContainText('tangente');
  await panel.getByRole('button', { name: 'Seguir' }).click();

  // Etapa 2: dos postes, y el de 3 m se desliza.
  await expect(panel).toContainText('Sala 3 · Etapa 2 de 3');
  await expect(panel).toContainText('Poste de 1 m: su sombra mide 1 m.');
  await expect(panel).toContainText('Poste de 3 m: su sombra mide 3 m.');
  await panel.getByRole('button', { name: 'Más: Poste de 3 m: distancia a su sensor' }).click();
  await expect(panel).toContainText('que está a 5 m');
});

test('dominar: la polea muestra hasta dónde subió el gancho y con 8 m se gana el sello', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, { sala: 's3-gimnasio', etapas: 2 });
  const panel = await abrirPanel(page, caja, conDedo);

  await expect(panel).toContainText('Sala 3 · Etapa 3 de 3');
  await panel.getByRole('button', { name: '53°' }).click();
  await expect(panel).toContainText('Poste de 2 m: su sombra mide 1,5 m.');
  await expect(panel).toContainText(
    'Marcador: su sombra llega hasta los 6 m de la cinta del piso.',
  );

  // La polea empieza en 3 m: con 5 m el gancho queda corto, y la máquina lo muestra.
  const mas = panel.getByRole('button', { name: 'Más: Cuerda de la polea' });
  const cuerda = panel.getByRole('group', { name: 'Cuerda de la polea' }).locator('output');
  await expect(cuerda).toHaveText('3 m');
  await mas.click();
  await expect(cuerda).toHaveText('4 m');
  await mas.click();
  await expect(cuerda).toHaveText('5 m');
  await panel.getByRole('button', { name: 'Soltar la polea' }).click();
  await expect(panel).toContainText('Soltaste 5 m de cuerda y el gancho subió 5 m.');
  await expect(panel).toContainText('Quedó colgando por debajo del marcador');
  await expect(panel).toContainText('Sala 3 · Etapa 3 de 3');

  for (const metros of ['6 m', '7 m', '8 m']) {
    await mas.click();
    await expect(cuerda).toHaveText(metros);
  }
  await panel.getByRole('button', { name: 'Soltar la polea' }).click();
  await expect(panel).toContainText('Quedó justo en el marcador y lo enganchó');
  await expect(panel).toContainText('Conseguiste el sello de esta sala');
  // El concepto se nombra solo ahora, con la sala resuelta.
  await expect(panel).toContainText('Triángulos semejantes y tangente');

  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Sellos: 3 de 5' })).toBeVisible();
});
