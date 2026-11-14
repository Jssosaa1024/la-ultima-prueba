import { expect, test } from '@playwright/test';

// Prueba de humo: las páginas cargan sin errores y lo esencial está a la vista.

test('la portada carga y enlaza a /jugar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'La Última Prueba' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jugar' })).toHaveAttribute('href', '/jugar');
});

test('/jugar muestra el canvas a pantalla completa, sin scroll y sin errores', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/jugar');

  const canvas = page.getByLabel('Escena del juego');
  await expect(canvas).toBeVisible();

  const vista = page.viewportSize();
  const caja = await canvas.boundingBox();
  expect(vista).not.toBeNull();
  expect(caja).not.toBeNull();
  expect(Math.round(caja?.width ?? 0)).toBe(vista?.width);
  expect(Math.round(caja?.height ?? 0)).toBe(vista?.height);

  const desborda = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight,
  );
  expect(desborda).toBe(false);
  expect(errores).toEqual([]);
});

test('/jugar arranca el motor 3D, que solo dibuja en la partida y con la pestaña a la vista', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  // Detrás del menú no dibuja (T20b); la portería se arma y queda lista.
  await expect(canvas).toHaveAttribute('data-motor', 'pausado');
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-motor', 'activo');

  const cambiarVisibilidad = (oculta: boolean) =>
    page.evaluate((oculta) => {
      Object.defineProperty(document, 'hidden', { value: oculta, configurable: true });
      Object.defineProperty(document, 'visibilityState', {
        value: oculta ? 'hidden' : 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, oculta);

  await cambiarVisibilidad(true);
  await expect(canvas).toHaveAttribute('data-motor', 'pausado');
  await cambiarVisibilidad(false);
  await expect(canvas).toHaveAttribute('data-motor', 'activo');

  // Al salir al menú vuelve a detenerse, y volver a la pestaña no lo arranca.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-motor', 'pausado');
  await cambiarVisibilidad(true);
  await cambiarVisibilidad(false);
  await expect(canvas).toHaveAttribute('data-motor', 'pausado');

  // El canvas tiene contexto WebGL2 y el búfer respeta el DPR máximo de 1,25.
  const info = await canvas.evaluate((c: HTMLCanvasElement) => ({
    webgl2: c.getContext('webgl2') !== null,
    relacion: c.width / c.clientWidth,
  }));
  expect(info.webgl2).toBe(true);
  expect(info.relacion).toBeLessThanOrEqual(1.26);
  expect(errores).toEqual([]);
});

test('mientras una sala se prepara se ve «Cargando sala…», y se quita al terminar (T20b)', async ({
  page,
}) => {
  // Las salas por código cargan en milisegundos. Para ver el aviso se frena la compilación de
  // shaders: Three espera a `COMPLETION_STATUS_KHR` (extensión KHR_parallel_shader_compile).
  await page.addInitScript(() => {
    const ventana = window as unknown as { cargaLenta: boolean };
    ventana.cargaLenta = true;
    const COMPLETION_STATUS_KHR = 0x91b1;
    const gl = WebGL2RenderingContext.prototype;
    const extension = gl.getExtension as (this: WebGL2RenderingContext, nombre: string) => unknown;
    gl.getExtension = function (this: WebGL2RenderingContext, nombre: string): unknown {
      if (nombre === 'KHR_parallel_shader_compile') return { COMPLETION_STATUS_KHR };
      return extension.call(this, nombre);
    } as typeof gl.getExtension;
    const parametro = gl.getProgramParameter;
    gl.getProgramParameter = function (
      this: WebGL2RenderingContext,
      programa: WebGLProgram,
      nombre: number,
    ): unknown {
      if (nombre === COMPLETION_STATUS_KHR) return !ventana.cargaLenta;
      return parametro.call(this, programa, nombre);
    };
  });
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  const aviso = page.getByRole('status').filter({ hasText: 'Cargando sala' });

  // En el menú no hay aviso, aunque la portería todavía se esté preparando.
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(aviso).toHaveCount(0);

  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(aviso).toBeVisible();
  await expect(canvas).not.toHaveAttribute('data-sala', 'porteria');
  // El aviso no recibe toques.
  expect(await aviso.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

  await page.evaluate(() => {
    (window as unknown as { cargaLenta: boolean }).cargaLenta = false;
  });
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  await expect(aviso).toHaveCount(0);
});

test('/jugar?prueba=glb carga el GLB de prueba con meshopt y KTX2 desde el propio sitio', async ({
  page,
  baseURL,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const transcodificador = page.waitForResponse((r) =>
    /\/basis_transcoder[^/]*\.wasm$/.test(new URL(r.url()).pathname),
  );
  await page.goto('/jugar?prueba=glb');

  await expect(page.getByRole('status')).toContainText('Modelo de prueba listo', {
    timeout: 20_000,
  });
  await expect(page.getByRole('status')).toContainText('12 triángulos');
  // Dos texturas (color y normal), cada una con el formato de GPU que eligió el equipo.
  await expect(page.getByRole('status')).toContainText(/Texturas: [^,]+, [^,]+/);

  // El transcodificador Basis se sirve desde el sitio, con hash en /_astro/ (sin CDN).
  const wasm = await transcodificador;
  expect(wasm.ok()).toBe(true);
  expect(wasm.url()).toMatch(new RegExp(`^${baseURL}/_astro/basis_transcoder\\.[^/]+\\.wasm$`));
  expect(errores).toEqual([]);
});

test('/jugar?prueba=otra no carga three.js', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(new URL(r.url()).pathname));
  await page.goto('/jugar?prueba=otra');
  await expect(page.getByLabel('Escena del juego')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(pedidos.filter((p) => p.includes('basis') || p.endsWith('.glb'))).toEqual([]);
});

test('/jugar?sinwebgl2=1 muestra el aviso de equipo no compatible', async ({ page }) => {
  await page.goto('/jugar?sinwebgl2=1');
  await expect(
    page.getByRole('heading', { name: 'Este equipo no puede abrir el juego' }),
  ).toBeVisible();
  await expect(page.getByLabel('Escena del juego')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
});
