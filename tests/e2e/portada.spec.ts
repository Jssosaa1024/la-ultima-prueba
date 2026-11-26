import { expect, test, type Page } from '@playwright/test';

// T03b · La portada: título, la historia en una frase, «Jugar» grande y la guía para docentes.
// T41h · Portada nueva con el tema del archivo: la portería de fondo, el reloj de las 23:59, la
// ficha del expediente, metas para compartir y nada pedido fuera del sitio.

test('la portada muestra el título, la historia y lleva a jugar y a la guía', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'La Última Prueba' })).toBeVisible();
  await expect(page.getByText('feria de ciencias')).toBeVisible();
  await expect(page.getByText('a las 00:40 el archivo se borra')).toBeVisible();
  for (const dato of ['40 minutos', 'Solo o en grupo de 2 a 4']) {
    await expect(page.getByText(dato)).toBeVisible();
  }
  // Correcciones del 25 de noviembre: Alex quitó estas dos frases de la portada.
  await expect(page.getByText('sin instalar ni crear cuenta')).toHaveCount(0);
  await expect(page.getByText(/en adelante/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Jugar' })).toHaveAttribute('href', '/jugar');
  await expect(page.getByRole('link', { name: 'Guía para docentes' })).toHaveAttribute(
    'href',
    '/docentes',
  );
  await expect(page.getByText('Colegio y personajes ficticios')).toBeVisible();
  // Ya no queda nada de la demo de T01.
  await expect(page.getByRole('button', { name: /Toques/ })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('en un celular en horizontal todo cabe sin desplazarse y «Jugar» se toca fácil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 851, height: 393 });
  await page.goto('/');

  const desborda = await page.evaluate(() => ({
    alto: document.documentElement.scrollHeight > window.innerHeight,
    ancho: document.documentElement.scrollWidth > window.innerWidth,
  }));
  expect(desborda).toEqual({ alto: false, ancho: false });

  const jugar = await page.getByRole('link', { name: 'Jugar' }).boundingBox();
  const guia = await page.getByRole('link', { name: 'Guía para docentes' }).boundingBox();
  expect(jugar?.height ?? 0).toBeGreaterThanOrEqual(64);
  expect(guia?.height ?? 0).toBeGreaterThanOrEqual(48);
  // Los dos enlaces quedan dentro de la pantalla.
  for (const caja of [jugar, guia]) {
    expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(393);
  }
});

test('en un celular en vertical «Jugar» se ve sin desplazarse y no hay scroll horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const jugar = await page.getByRole('link', { name: 'Jugar' }).boundingBox();
  expect(jugar?.height ?? 0).toBeGreaterThanOrEqual(64);
  expect((jugar?.y ?? 0) + (jugar?.height ?? 0)).toBeLessThanOrEqual(844);
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(ancho).toBe(false);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('en un computador ancho la portería cubre toda la pantalla, sin franjas vacías', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const fondo = page.locator('.portada-fondo img');
  await expect(fondo).toHaveJSProperty('complete', true);
  const imagen = await fondo.evaluate((img: HTMLImageElement) => ({
    ancho: img.naturalWidth,
    fuente: img.currentSrc,
    prioridad: img.getAttribute('fetchpriority'),
  }));
  expect(imagen.ancho).toBeGreaterThan(0);
  expect(imagen.fuente).toMatch(/\/portada\/porteria-(960|1600)\.webp$/);
  expect(imagen.prioridad).toBe('high');

  const caja = await fondo.boundingBox();
  expect(caja?.x ?? 1).toBeLessThanOrEqual(0);
  expect(caja?.y ?? 1).toBeLessThanOrEqual(0);
  expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeGreaterThanOrEqual(1920);
  expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeGreaterThanOrEqual(1080);

  // El contenido no pasa de ~76 rem y queda centrado.
  const contenido = await page.locator('.portada-contenido').boundingBox();
  expect(contenido?.width ?? 0).toBeLessThanOrEqual(76 * 16 + 1);
  expect(Math.abs((contenido?.x ?? 0) * 2 + (contenido?.width ?? 0) - 1920)).toBeLessThan(2);
});

/** Animaciones CSS en curso y los segundos del reloj, después de `ms`. */
async function movimiento(page: Page, ms: number): Promise<{ animaciones: number; seg: string }> {
  await page.waitForTimeout(ms);
  return page.evaluate(() => ({
    animaciones: document.getAnimations().filter((a) => a.playState === 'running').length,
    seg: document.querySelector('[data-segundos]')?.textContent ?? '',
  }));
}

test('el reloj avanza y la linterna se mueve; con menos movimiento, todo quieto', async ({
  page,
}) => {
  await page.goto('/');
  const conMovimiento = await movimiento(page, 2200);
  expect(conMovimiento.animaciones).toBeGreaterThan(0);
  expect(conMovimiento.seg).not.toBe('00');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const quieto = await movimiento(page, 2200);
  expect(quieto).toEqual({ animaciones: 0, seg: '00' });
});

test('trae la descripción y las metas para compartir con imagen absoluta', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');

  expect(await meta('meta[name="description"]')).toContain('feria de ciencias');
  expect(await meta('meta[name="theme-color"]')).toBe('#14110d');
  expect(await meta('meta[property="og:title"]')).toBe('La Última Prueba');
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[property="og:description"]')).toBeTruthy();
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  const imagen = (await meta('meta[property="og:image"]')) ?? '';
  expect(imagen).toMatch(/^https:\/\/[^/]+\/portada\/compartir-1200x630\.jpg$/);
  expect(await meta('meta[name="twitter:image"]')).toBe(imagen);
  // La imagen existe en el sitio.
  const r = await request.get(new URL(imagen).pathname);
  expect(r.ok()).toBe(true);
  expect(r.headers()['content-type']).toContain('image/jpeg');

  // Las demás páginas llevan la descripción por defecto, sin metas para compartir.
  await page.goto('/docentes');
  expect(await meta('meta[name="description"]')).toBeTruthy();
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
});

test('no pide nada fuera del sitio y pesa menos de 250 KB sin las fuentes', async ({ page }) => {
  const origen = new URL(test.info().project.use.baseURL ?? '').origin;
  const fuera: string[] = [];
  const pesos = new Map<string, number>();
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('data:') && new URL(url).origin !== origen) fuera.push(url);
  });
  page.on('response', async (r) => {
    try {
      pesos.set(r.url(), (await r.body()).length);
    } catch {
      // Redirecciones y respuestas sin cuerpo.
    }
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  expect(fuera).toEqual([]);
  // Nada del juego: la portada no lo precarga.
  expect([...pesos.keys()].filter((u) => /\/assets\/|\.glb|\/decoders\//.test(u))).toEqual([]);
  const total = [...pesos]
    .filter(([url]) => !new URL(url).pathname.startsWith('/fonts/'))
    .reduce((suma, [, bytes]) => suma + bytes, 0);
  test.info().annotations.push({ type: 'peso sin fuentes', description: `${total} bytes` });
  expect(total).toBeLessThanOrEqual(250 * 1024);
});

test('todo el texto mide 14 px o más', async ({ page }) => {
  await page.goto('/');
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()))
      .filter((e) => !e.closest('.solo-lector'))
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 14)
      .map((e) => `${e.tagName} ${e.textContent?.trim().slice(0, 30)}`),
  );
  expect(pequenos).toEqual([]);
});

test('«Jugar» abre el juego', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Jugar' }).click();
  await expect(page).toHaveURL(/\/jugar\/?$/);
  await expect(page.getByLabel('Escena del juego')).toBeVisible();
});

// Tráiler en la portada: el botón abre un diálogo con el video, que no se descarga antes.
test('«Ver el tráiler» abre el video en un diálogo y «Cerrar» lo detiene', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await page.goto('/');

  const video = page.locator('[data-trailer-video]');
  await expect(video).toHaveAttribute('preload', 'none');
  expect(pedidos.some((u) => u.endsWith('.mp4'))).toBe(false);

  await page.getByRole('button', { name: /Ver el tráiler/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Tráiler de La Última Prueba' });
  await expect(dialogo).toBeVisible();
  await expect(video).toBeVisible();
  const fuente = await video.evaluate((v: HTMLVideoElement) => v.currentSrc);
  expect(fuente).toMatch(/\/trailer\/trailer-(horizontal|vertical)\.mp4$/);

  await dialogo.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialogo).toBeHidden();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  expect(errores).toEqual([]);
});

// Correcciones del 25 nov: el logo de Sinapsis, pequeño, al pie de la portada y en la pantalla
// de carga del juego.
test('al pie va «Un proyecto de» con el logo de Sinapsis, pequeño', async ({ page }) => {
  await page.goto('/');
  const pie = page.getByRole('contentinfo');
  await expect(pie).toContainText('Un proyecto de');
  const logo = pie.getByRole('img', { name: 'Sinapsis' });
  await expect(logo).toBeVisible();
  const caja = await logo.boundingBox();
  expect(caja?.height ?? 0).toBeLessThanOrEqual(32);
  expect(await logo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('la pantalla de carga del juego lleva el logo de Sinapsis', async ({ page }) => {
  const html = await (await page.request.get('/jugar')).text();
  // Es lo que se ve mientras baja el juego (`slot="fallback"` de la isla).
  const logo = html.match(/<img[^>]*sinapsis\.webp[^>]*>/)?.[0] ?? '';
  expect(logo).toContain('src="/marca/sinapsis.webp"');
  expect(logo).toContain('alt="Sinapsis"');
});
