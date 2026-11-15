import { expect, test, type Page } from '@playwright/test';
import { barra } from './coop';
import { caminarHasta, mirarHacia } from './escena';

// T83b: con 4 jugadores (3 avatares en cada pantalla, con su alias) y sus señales, el panel
// ?debug=1 sigue por debajo de los 40 draw calls del presupuesto (AGENTS.md).

/** Los que se unen a la partida de Jaguar: alias y color. */
const OTROS = [
  ['Búho', 'Coral'],
  ['Colibrí', 'Turquesa'],
  ['Tortuga', 'Violeta'],
] as const;

/** Donde aparece el grupo en la portería (`salas.json`). */
const INICIO_PORTERIA = { x: 0, z: 4.2 };

async function decirAqui(p: Page): Promise<void> {
  await barra(p).getByRole('button', { name: 'Frases' }).click();
  await barra(p).getByRole('button', { name: '¡Aquí!' }).click();
}

test('con 4 jugadores y sus señales, los draw calls siguen dentro del presupuesto', async ({
  page: a,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se prueba en celular');
  test.setTimeout(8 * 60_000);
  const conDedo = info.project.use.hasTouch === true;

  // Jaguar crea la partida con el panel de métricas abierto; los otros tres se unen.
  await a.goto('/jugar?red=pestanas&debug=1');
  await a.getByRole('button', { name: 'Crear partida' }).click();
  await a.getByText('Jaguar', { exact: true }).click();
  await a.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
  const codigo = (await a.locator('.coop-codigo-grande strong').textContent()) ?? '';
  const otros: Page[] = [];
  for (const [alias, color] of OTROS) {
    const p = await context.newPage();
    await p.goto(`/jugar?red=pestanas&codigo=${codigo}`);
    await p.getByText(alias, { exact: true }).click();
    await p.getByText(color, { exact: true }).click();
    await p.getByRole('button', { name: 'Unirse', exact: true }).click();
    await p.getByRole('button', { name: 'Estoy listo' }).click();
    otros.push(p);
  }
  await a.getByRole('button', { name: 'Iniciar' }).click({ timeout: 60_000 });
  for (const p of [a, ...otros]) {
    await expect(p.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 'porteria', {
      timeout: 60_000,
    });
  }

  // Jaguar se aleja un poco y se voltea: los tres avatares y sus alias quedan a la vista.
  const canvas = a.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  await caminarHasta(a, caja, conDedo, (_x, z) => z < INICIO_PORTERIA.z - 2);
  await mirarHacia(a, caja, [INICIO_PORTERIA.x, 1, INICIO_PORTERIA.z], conDedo);
  await expect(canvas).toHaveAttribute('data-companeros', /^[^;]+;[^;]+;[^;]+$/, {
    timeout: 30_000,
  });

  const panel = a.getByRole('region', { name: 'Métricas de rendimiento' });
  await expect(panel).toHaveAttribute('data-lista', 'true');
  const fila = panel.locator('.depuracion-fila', { hasText: 'Draw calls' }).locator('dd');
  const dibujos = async (): Promise<number> =>
    Number(/\d+/.exec((await fila.textContent()) ?? '')?.[0] ?? NaN);
  // El panel escribe cada 500 ms: se espera a que mida la escena ya volteada.
  await a.waitForTimeout(1500);
  const conAvatares = await dibujos();

  // Los cuatro dicen «¡Aquí!» a la vez (cada señal dura 5 s): cuatro marcadores, que son un
  // solo draw call.
  await Promise.all([a, ...otros].map(decirAqui));
  await expect(canvas).toHaveAttribute('data-senales', '4');
  let conSenales = 0;
  for (let i = 0; i < 4; i++) {
    conSenales = Math.max(conSenales, await dibujos());
    await a.waitForTimeout(500);
  }

  const medida = `portería con 3 avatares: ${conAvatares}; con 4 señales: ${conSenales}`;
  test.info().annotations.push({ type: 'draw calls', description: medida });
  // En la salida de la corrida, para el reporte.
  console.log(`Draw calls (T83b): ${medida} (límite 40)`);
  expect(conAvatares).toBeGreaterThan(0);
  expect(conSenales).toBeGreaterThanOrEqual(conAvatares);
  expect(conSenales).toBeLessThanOrEqual(40);
});
