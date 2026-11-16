import { expect, test, type Page } from '@playwright/test';

// T81b: en la sala de espera, el alias y el color que ya tiene otro jugador salen «ocupado» y
// no se pueden elegir. Si dos piden lo mismo a la vez, gana el primero que llega al anfitrión
// y al otro se le pide elegir de nuevo. Dos pestañas con el transporte de prueba.

async function crear(page: Page, alias: string, color: string): Promise<string> {
  await page.goto('/jugar?red=pestanas');
  await page.getByRole('button', { name: 'Crear partida' }).click();
  await page.getByText(alias, { exact: true }).click();
  await page.getByText(color, { exact: true }).click();
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
  return (await page.locator('.coop-codigo-grande strong').textContent()) ?? '';
}

async function unirse(page: Page, codigo: string, alias: string, color: string): Promise<void> {
  await page.goto(`/jugar?red=pestanas&codigo=${codigo}`);
  await page.getByText(alias, { exact: true }).click();
  await page.getByText(color, { exact: true }).click();
  await page.getByRole('button', { name: 'Unirse', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
}

const selector = (p: Page) => p.getByRole('form', { name: 'Tu alias y color' });
const jugadores = (p: Page) => p.getByRole('list', { name: 'Jugadores' });

/** Marca un alias y un color en el selector abierto (se toca la etiqueta, como con el dedo). */
async function marcar(p: Page, alias: string, color: string): Promise<void> {
  await selector(p).getByText(alias, { exact: true }).click();
  await selector(p).getByText(color, { exact: true }).click();
}

test('quien se une con el alias y el color de otro los ve ocupados y elige de nuevo', async ({
  page: a,
  context,
}) => {
  const errores: string[] = [];
  a.on('pageerror', (e) => errores.push(e.message));
  const codigo = await crear(a, 'Jaguar', 'Turquesa');

  const b = await context.newPage();
  b.on('pageerror', (e) => errores.push(e.message));
  await unirse(b, codigo, 'Jaguar', 'Turquesa');

  // B: el selector se abre solo, con el aviso y lo de A marcado como ocupado.
  await expect(selector(b)).toBeVisible();
  await expect(selector(b).getByRole('alert')).toHaveText(
    'Otro jugador eligió el alias Jaguar y el color Turquesa antes que tú. Elige otros.',
  );
  await expect(selector(b).getByRole('radio', { name: /^Jaguar/ })).toBeDisabled();
  await expect(selector(b).getByRole('radio', { name: /^Turquesa/ })).toBeDisabled();
  await expect(selector(b).getByText('ocupado')).toHaveCount(2);
  await expect(b.getByRole('button', { name: 'Estoy listo' })).toBeDisabled();
  // Mientras elige no se puede cerrar el selector.
  await expect(selector(b).getByRole('button', { name: 'Cancelar' })).toHaveCount(0);

  // A: nadie se muestra repetido y no puede iniciar.
  await expect(jugadores(a)).toContainText('Jaguar (tú)');
  await expect(jugadores(a).getByRole('listitem').filter({ hasText: 'Sin alias' })).toContainText(
    'eligiendo alias y color',
  );
  await expect(jugadores(a)).not.toContainText(/Jaguar[^]*Jaguar/);
  await expect(a.getByRole('button', { name: 'Iniciar' })).toBeDisabled();

  // B elige Búho y Coral.
  await marcar(b, 'Búho', 'Coral');
  await selector(b).getByRole('button', { name: 'Usar este alias y color' }).click();
  await expect(selector(b)).toHaveCount(0);
  for (const p of [a, b]) {
    await expect(jugadores(p).getByRole('listitem')).toHaveCount(2);
    await expect(jugadores(p)).toContainText('Jaguar');
    await expect(jugadores(p)).toContainText('Búho');
  }
  await b.getByRole('button', { name: 'Estoy listo' }).click();
  await expect(a.getByRole('button', { name: 'Iniciar' })).toBeEnabled();

  // A abre el selector: ahora Búho y Coral son los ocupados.
  await a.getByRole('button', { name: 'Cambiar alias o color' }).click();
  await expect(selector(a).getByRole('radio', { name: /^Búho/ })).toBeDisabled();
  await expect(selector(a).getByRole('radio', { name: /^Coral/ })).toBeDisabled();
  await expect(selector(a).getByRole('radio', { name: /^Jaguar/ })).toBeEnabled();
  await selector(a).getByRole('button', { name: 'Cancelar' }).click();
  await expect(selector(a)).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('si los dos piden lo mismo a la vez, uno se lo queda y el otro elige de nuevo', async ({
  page: a,
  context,
}) => {
  const errores: string[] = [];
  a.on('pageerror', (e) => errores.push(e.message));
  const codigo = await crear(a, 'Jaguar', 'Turquesa');
  const b = await context.newPage();
  b.on('pageerror', (e) => errores.push(e.message));
  await unirse(b, codigo, 'Búho', 'Coral');
  await expect(jugadores(a)).toContainText('Búho');

  // Los dos abren el selector y marcan Oso y Violeta antes de que el otro pida nada.
  for (const p of [a, b]) {
    await p.getByRole('button', { name: 'Cambiar alias o color' }).click();
    await marcar(p, 'Oso', 'Violeta');
  }
  await Promise.all(
    [a, b].map((p) => selector(p).getByRole('button', { name: 'Usar este alias y color' }).click()),
  );

  // Exactamente uno quedó con Oso y Violeta; al otro se le avisa y sigue con lo suyo.
  const aviso = 'Otro jugador eligió el alias Oso y el color Violeta antes que tú. Elige otros.';
  const conAviso = async (): Promise<number[]> =>
    Promise.all([a, b].map((p) => p.getByText(aviso).count()));
  await expect.poll(async () => (await conAviso()).reduce((x, y) => x + y)).toBe(1);
  const perdioA = (await a.getByText(aviso).count()) > 0;
  const [gano, perdio] = perdioA ? [b, a] : [a, b];
  await expect(perdio.getByText(aviso)).toBeVisible();
  await expect(gano.getByText(aviso)).toHaveCount(0);
  await expect(selector(gano)).toHaveCount(0);
  for (const p of [a, b]) {
    await expect(jugadores(p)).toContainText('Oso');
    await expect(jugadores(p)).not.toContainText(/Oso[^]*Oso/);
    await expect(jugadores(p)).toContainText(perdioA ? 'Jaguar' : 'Búho');
  }
  await expect(selector(perdio).getByRole('radio', { name: /^Oso/ })).toBeDisabled();
  await expect(selector(perdio).getByRole('radio', { name: /^Violeta/ })).toBeDisabled();

  // El que perdió elige otro y queda todo distinto.
  await marcar(perdio, 'Rana', 'Ámbar');
  await selector(perdio).getByRole('button', { name: 'Usar este alias y color' }).click();
  await expect(selector(perdio)).toHaveCount(0);
  for (const p of [a, b]) {
    await expect(jugadores(p)).toContainText('Oso');
    await expect(jugadores(p)).toContainText('Rana');
  }
  expect(errores).toEqual([]);
});
