import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import type { Caja } from './escena';
import { cruzar, usar } from './recorrido';

// T88c: en grupo, una pista nueva se avisa a todos apenas el anfitrión la ofrece (T88b), no con
// la foto de cada 15 s. Búho (D, que no es anfitrión) baja la palanca tres veces sin resolver la
// etapa 1 de la etiquetadora; al tercer intento la máquina ofrece la primera pista.

async function cajaDe(p: Page): Promise<Caja> {
  const canvas = p.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

/** Cuándo (ms desde el inicio de la página) aparece el aviso «Pista nueva» en el HUD. */
async function cuandoHayPista(p: Page): Promise<number> {
  // Con el panel abierto el HUD queda oculto al lector de pantalla: se busca por su clase.
  await expect(p.locator('.hud-boton-aviso')).toHaveText('Pista nueva', { timeout: 60_000 });
  return p.evaluate(() => performance.timeOrigin + performance.now());
}

test('la pista ofrecida llega a todos a la vez', async ({ page, context }, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se juega en celular');
  test.setTimeout(6 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const [cajaA, cajaB] = [await cajaDe(a), await cajaDe(b)];

  // Jaguar (anfitrión) cruza la puerta 1 y Búho acepta: Búho queda con C y D.
  await Promise.all([
    cruzar(a, cajaA, conDedo, 'porteria-puerta-1'),
    (async () => {
      await expect(barra(b)).toContainText('Jaguar propone ir a La cooperativa', {
        timeout: 120_000,
      });
      await barra(b).getByRole('button', { name: 'Aceptar' }).click();
    })(),
  ]);
  await expect(b.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 's1-cooperativa');
  await expect(barra(b).getByRole('button', { name: 'Tus encargos: C y D' })).toBeVisible();
  await expect(a.locator('.hud-boton-aviso')).toHaveCount(0);

  await usar(b, cajaB, conDedo, 's1-etiquetadora');
  const panelB = b.getByRole('dialog', { name: 'La etiquetadora' });
  const panelA = a.getByRole('dialog', { name: 'La etiquetadora' });
  const palanca = panelB.getByRole('button', { name: 'Bajar la palanca' });
  const rodillo = (texto: string) => panelB.getByRole('button', { name: texto, exact: true });

  // Tres intentos que no dan los $1.600 de la pizarra: +20 %, luego +25 % y luego +50 %.
  const intentos: [string | null, string, string][] = [
    [null, '+20 %', '$2.400'],
    ['+20 %', '+25 %', '$2.500'],
    ['+25 %', '+50 %', '$3.000'],
  ];
  let hayPista: Promise<[number, number]> | null = null;
  for (const [n, [quitar, poner, precio]] of intentos.entries()) {
    if (quitar) await rodillo(quitar).click();
    await rodillo(poner).click();
    await expect(rodillo(poner)).toHaveAttribute('aria-pressed', 'true');
    await palanca.click();
    if (n === 0) {
      await barra(a).getByRole('button', { name: 'Ver propuesta' }).click({ timeout: 60_000 });
    }
    if (n === intentos.length - 1) {
      // Desde antes de aceptar el último: se mide cuándo lo ve cada uno.
      hayPista = Promise.all([cuandoHayPista(a), cuandoHayPista(b)]);
    } else {
      await expect(a.locator('.hud-boton-aviso')).toHaveCount(0);
    }
    await panelA.getByRole('button', { name: 'Aceptar', exact: true }).click({ timeout: 60_000 });
    await expect(panelB.locator('.respuesta')).toContainText(precio, { timeout: 60_000 });
  }
  if (!hayPista) throw new Error('sin intentos');
  const [enA, enB] = await hayPista;
  // Antes de T88b, quien no es anfitrión la veía hasta 15 s después.
  expect(Math.abs(enB - enA), 'diferencia entre las dos pestañas (ms)').toBeLessThan(4000);

  // Búho la abre y la pista queda vista para los dos.
  await panelB.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await b.getByRole('button', { name: 'Pista nueva' }).click();
  await b.getByRole('dialog').getByRole('button', { name: 'Ver pista' }).click();
  await expect(a.locator('.hud-boton-aviso')).toHaveCount(0, { timeout: 20_000 });
});
