import { expect, test, type Page } from '@playwright/test';

// T02b · CSP. `astro preview` envía la misma política que `dist/_headers` (la integración
// `scripts/csp/integracion.ts`), así que toda la suite corre con ella. Esta prueba revisa la
// cabecera y que nada quede bloqueado en lo que más usa el navegador: la isla del juego, el
// audio, el GLB de prueba con meshopt y KTX2 (WebAssembly y worker desde un blob) y el panel
// de depuración.

/** Escucha las violaciones de la CSP desde antes de que cargue la página. */
async function vigilar(page: Page): Promise<() => Promise<string[]>> {
  const consola: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) consola.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      w.__csp.push(`${e.effectiveDirective} ${e.blockedURI || '(en línea)'}`),
    );
  });
  return async () => [
    ...consola,
    ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
  ];
}

test('cada página llega con la CSP, con hashes y sin unsafe-inline', async ({ page }) => {
  for (const ruta of ['/', '/jugar/', '/docentes/']) {
    const r = await page.goto(ruta);
    const csp = r?.headers()['content-security-policy'] ?? '';
    expect(csp, ruta).toContain("default-src 'self'");
    expect(csp, ruta).toContain("frame-ancestors 'none'");
    expect(csp, ruta).toMatch(/script-src 'self' 'wasm-unsafe-eval'( 'sha256-[^']+')+;/);
    expect(csp, ruta).toMatch(/style-src 'self'( 'sha256-[^']+')+;/);
    expect(csp, ruta).not.toContain('unsafe-inline');
  }
});

test('portada y guía para docentes: nada bloqueado', async ({ page }) => {
  const violaciones = await vigilar(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'La Última Prueba' })).toBeVisible();
  await page.goto('/docentes');
  await expect(page.getByRole('heading', { name: 'Guía para docentes' })).toBeVisible();
  expect(await violaciones()).toEqual([]);
});

test('jugar solo en la sala 1, con audio: nada bloqueado', async ({ page }) => {
  const violaciones = await vigilar(page);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/jugar?sala=s1-cooperativa');
  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-sala', 's1-cooperativa');
  // El toque a «Jugar solo» arranca el audio (T11).
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-motor', 'activo');
  await page.waitForTimeout(1500);
  expect(errores).toEqual([]);
  expect(await violaciones()).toEqual([]);
});

test('GLB de prueba con meshopt y KTX2 (WebAssembly y worker): nada bloqueado', async ({
  page,
}) => {
  const violaciones = await vigilar(page);
  await page.goto('/jugar?prueba=glb');
  await expect(page.getByRole('status')).toContainText('Modelo de prueba listo', {
    timeout: 20_000,
  });
  expect(await violaciones()).toEqual([]);
});

test('panel ?debug=1: nada bloqueado', async ({ page }) => {
  const violaciones = await vigilar(page);
  await page.goto('/jugar?debug=1');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-motor', 'activo');
  await page.waitForTimeout(1500);
  expect(await violaciones()).toEqual([]);
});
