import { expect, test, type Page } from '@playwright/test';

// T32 y T81: crear partida, unirse con código y sala de espera, con dos pestañas del mismo
// navegador (transporte de prueba con BroadcastChannel, `?red=pestanas`).

async function crear(page: Page): Promise<string> {
  await page.goto('/jugar?red=pestanas');
  await page.getByRole('button', { name: 'Crear partida' }).click();
  await page.getByText('Jaguar', { exact: true }).click();
  await page.getByText('Turquesa', { exact: true }).click();
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
  const codigo = (await page.locator('.coop-codigo-grande strong').textContent()) ?? '';
  expect(codigo).toMatch(/^[A-Z2-9]{4}$/);
  return codigo;
}

test('dos pestañas: crear, unirse con ?codigo=, listo e iniciar', async ({ page, context }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const codigo = await crear(page);
  const jugadores = page.getByRole('list', { name: 'Jugadores' });
  await expect(jugadores.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeDisabled();

  const otra = await context.newPage();
  otra.on('pageerror', (e) => errores.push(e.message));
  await otra.goto(`/jugar?red=pestanas&codigo=${codigo.toLowerCase()}`);
  // El código de la URL ya está escrito (en mayúsculas) en «Unirse con código».
  await expect(otra.getByRole('heading', { name: 'Unirse con código' })).toBeVisible();
  await expect(otra.getByRole('textbox')).toHaveValue(codigo);
  await otra.getByText('Búho', { exact: true }).click();
  await otra.getByRole('button', { name: 'Unirse', exact: true }).click();

  await expect(jugadores.getByRole('listitem')).toHaveCount(2);
  await expect(jugadores).toContainText('Jaguar (tú)');
  await expect(jugadores).toContainText('Búho');
  await expect(otra.getByRole('list', { name: 'Jugadores' })).toContainText('Búho (tú)');
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeDisabled();

  await otra.getByRole('button', { name: 'Estoy listo' }).click();
  await expect(otra.getByRole('button', { name: 'Ya no estoy listo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Iniciar' }).click();

  // Los dos entran a la partida.
  for (const p of [page, otra]) {
    await expect(p.getByRole('heading', { name: 'Sala de espera' })).toHaveCount(0);
    await expect(p.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 'porteria');
  }
  expect(errores).toEqual([]);
});

test('un código que no está en uso avisa que no se encontró la partida', async ({ page }) => {
  await page.goto('/jugar?red=pestanas');
  await page.getByRole('button', { name: 'Unirse con código' }).click();
  const campo = page.getByRole('textbox');
  await campo.fill('k0mp');
  // El 0 no existe en el alfabeto: se avisa y no deja unirse.
  await expect(page.getByText(/no lleva 0, O, 1, I ni L/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unirse', exact: true })).toBeDisabled();
  await campo.fill('zzzz');
  await page.getByRole('button', { name: 'Unirse', exact: true }).click();
  await expect(page.getByText('No encontramos esa partida', { exact: false })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
});
