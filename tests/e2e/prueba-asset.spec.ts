import { expect, test } from '@playwright/test';

// T10b y T19e: `/jugar?prueba=asset` muestra en la portería la taza que `optimize-models` llevó
// de art/prueba-assets/originales/ a public/assets/salas/porteria/ (meshopt + KTX2), cargada
// por el mismo camino que cualquier modelo de una sala: manifiesto, GLB y ajuste a `tam`.
// Desde T19h la portería trae además sus modelos de Kenney (ver arte-cc0.spec.ts).

const RUTA_TAZA = /^\/assets\/salas\/porteria\/taza\.[0-9a-f]{8}\.glb$/;

test('/jugar?prueba=asset muestra la taza optimizada sobre el escritorio', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const glb = page.waitForResponse((r) => RUTA_TAZA.test(new URL(r.url()).pathname));
  const textura = page.waitForResponse((r) =>
    /\/basis_transcoder[^/]*\.wasm$/.test(new URL(r.url()).pathname),
  );

  await page.goto('/jugar?prueba=asset');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  // El objeto ya muestra su modelo (y su primitiva quedó escondida).
  await expect(canvas).toHaveAttribute('data-modelos', /(^|,)porteria-taza-prueba(,|$)/, {
    timeout: 30_000,
  });
  expect((await glb).ok()).toBe(true);
  // La textura de la taza es KTX2: hizo falta el transcodificador Basis del propio sitio.
  expect((await textura).ok()).toBe(true);
  expect(errores).toEqual([]);
});

test('sin ?prueba=asset la portería no pide la taza', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(new URL(r.url()).pathname));
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  await expect(canvas).toHaveAttribute('data-modelos', /porteria-escritorio/, { timeout: 30_000 });
  await expect(canvas).not.toHaveAttribute('data-modelos', /taza/);
  expect(pedidos.filter((p) => RUTA_TAZA.test(p))).toEqual([]);
});
