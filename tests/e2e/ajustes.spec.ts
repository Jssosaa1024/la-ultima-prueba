import { expect, test, type Page } from '@playwright/test';
import { leer } from './escena';

// T39: ajustes de sensibilidad, modo zurdo, tamaño de texto y volumen, guardados en este equipo.

const CLAVE = 'la-ultima-prueba:ajustes';

async function abrirMenu(page: Page): Promise<void> {
  await page.goto('/jugar');
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
}

test('desde el menú se cambian los ajustes y se recuerdan al recargar', async ({ page }) => {
  await abrirMenu(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const panel = page.getByRole('dialog', { name: 'Ajustes del juego' });
  await expect(panel).toBeFocused();

  await panel.getByRole('button', { name: 'Muy grande' }).click();
  await panel.getByRole('button', { name: 'A la derecha (zurdo)' }).click();
  await panel.getByRole('button', { name: 'Más: Sensibilidad de la mirada' }).click();
  await panel.getByRole('button', { name: 'Menos: Volumen de la voz' }).click();
  await panel.getByRole('button', { name: 'Menos: Volumen del ambiente' }).click();

  await expect(panel.getByRole('button', { name: 'Muy grande' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.getByRole('group', { name: 'Sensibilidad de la mirada' })).toContainText(
    'Rápida',
  );
  await expect(panel.getByRole('group', { name: 'Volumen de la voz' })).toContainText('90 %');
  await expect(panel.getByRole('group', { name: 'Volumen del ambiente' })).toContainText('60 %');
  await expect(page.locator('html')).toHaveAttribute('data-texto', 'muy-grande');

  // Cerrar devuelve el foco al botón «Ajustes», y el menú explica los controles del zurdo.
  await panel.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Ajustes' })).toBeFocused();
  await expect(page.getByText(/joystick de la derecha/)).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-texto', 'muy-grande');
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(panel.getByRole('button', { name: 'A la derecha (zurdo)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.getByRole('group', { name: 'Volumen de la voz' })).toContainText('90 %');

  // «Restablecer» vuelve a los valores iniciales.
  await panel.getByRole('button', { name: 'Restablecer' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-texto', /./);
  await expect(panel.getByRole('group', { name: 'Volumen de la voz' })).toContainText('100 %');
});

test('unos ajustes guardados inválidos no rompen el juego: cada campo malo vuelve al inicial', async ({
  page,
}) => {
  await page.addInitScript(
    ([clave]) => {
      localStorage.setItem(
        clave as string,
        JSON.stringify({ texto: '<img src=x>', zurdo: 'sí', volumenVoz: 30, sensibilidad: 9 }),
      );
    },
    [CLAVE],
  );
  await abrirMenu(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-texto', /./);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const panel = page.getByRole('dialog', { name: 'Ajustes del juego' });
  await expect(panel.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.getByRole('button', { name: 'A la izquierda' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.getByRole('group', { name: 'Volumen de la voz' })).toContainText('30 %');
  await expect(panel.getByRole('group', { name: 'Sensibilidad de la mirada' })).toContainText(
    'Normal',
  );
});

test('en la partida, «Ajustes» pausa el reloj y al cerrar vuelve a la escena', async ({ page }) => {
  await abrirMenu(page);
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const panel = page.getByRole('dialog', { name: 'Ajustes del juego' });
  await expect(panel).toContainText('El reloj está en pausa');
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /en pausa/);
  await panel.getByRole('button', { name: 'Grande', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-texto', 'grande');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ajustes' })).toBeFocused();
  await expect(page.getByRole('timer')).not.toHaveAttribute('aria-label', /en pausa/);
});

test('en modo zurdo, el joystick va a la derecha y se mira arrastrando a la izquierda', async ({
  page,
}, info) => {
  test.skip(!info.project.use.hasTouch, 'el joystick es táctil: solo en el perfil celular');
  test.slow();
  await page.addInitScript(
    ([clave]) => localStorage.setItem(clave as string, JSON.stringify({ zurdo: true })),
    [CLAVE],
  );
  await abrirMenu(page);
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-mirada', /,/);
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');

  // La guía del joystick en reposo está en la mitad derecha.
  const guia = await page.locator('.joystick').boundingBox();
  expect((guia?.x ?? 0) + (guia?.width ?? 0) / 2).toBeGreaterThan(caja.x + caja.width / 2);

  const cdp = await page.context().newCDPSession(page);
  const arrastrar = async (
    desde: { x: number; y: number },
    hasta: { x: number; y: number },
    mientras?: () => Promise<void>,
  ): Promise<void> => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...desde, id: 1 }],
    });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: desde.x + ((hasta.x - desde.x) * i) / 10,
            y: desde.y + ((hasta.y - desde.y) * i) / 10,
            id: 1,
          },
        ],
      });
    }
    try {
      if (mientras) await mientras();
    } finally {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };

  // Mitad izquierda: mirar. Arrastrar a la izquierda gira a la izquierda (yaw mayor).
  const [yaw0] = await leer(page, 'data-mirada');
  const y = caja.y + caja.height / 2;
  await arrastrar({ x: caja.x + caja.width * 0.4, y }, { x: caja.x + caja.width * 0.1, y });
  await expect.poll(async () => (await leer(page, 'data-mirada'))[0]).toBeGreaterThan(yaw0 + 0.1);

  // Mitad derecha: caminar sin girar.
  const [yaw1] = await leer(page, 'data-mirada');
  const [x0, z0] = await leer(page, 'data-posicion');
  const x = caja.x + caja.width * 0.8;
  const yj = caja.y + caja.height * 0.7;
  await arrastrar({ x, y: yj }, { x, y: yj - 80 }, () =>
    expect
      .poll(async () => {
        const [x1, z1] = await leer(page, 'data-posicion');
        return Math.hypot(x1 - x0, z1 - z0);
      })
      .toBeGreaterThan(0.3),
  );
  expect((await leer(page, 'data-mirada'))[0]).toBe(yaw1);
  await cdp.detach();
});
