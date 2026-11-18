/**
 * capturar-portada (T41h): fotografía la portería del juego y escribe las imágenes de la
 * portada en `public/portada/`.
 *
 *   npm run dev                      (en otra terminal; o `npm run preview` tras un build)
 *   npm run capturar-portada         (o PORTADA_URL=http://127.0.0.1:4533 npm run …)
 *
 * - Abre `/jugar` en Chromium (Playwright), toca «Jugar solo», espera a que la portería esté
 *   dibujada, oculta el HUD y toma la captura desde donde aparece el jugador: de frente a la
 *   puerta de salida, con el reloj encima.
 * - Con sharp (el que ya trae Astro) escribe el fondo en WebP a 960 y 1600 px de ancho, bajando
 *   la calidad hasta que quepa en su límite, y la imagen para compartir (Open Graph) de
 *   1200 × 630 en JPEG, con el título encima en Courier Prime (las fuentes de `public/fonts/`).
 *
 * Las imágenes se suben al repositorio: solo hay que volver a correrlo si cambia la portería.
 * Los modelos de la portería son CC0 (Kenney y Quaternius), así que las capturas no piden
 * crédito nuevo; `npm run check-credits` lo confirma.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import sharp from 'sharp';

const BASE = process.env['PORTADA_URL'] ?? 'http://127.0.0.1:4321';
const CARPETA = path.join('public', 'portada');

/** Tamaño de la captura en píxeles CSS. Con DPR 1,25 (el máximo del juego), sale de 2000 px. */
const VISTA = { width: 1600, height: 900 };
const DPR = 1.25;
/** Hasta dónde camina el jugador hacia la salida antes de la foto. */
const Z_FOTO = 1.8;

/** Fondos de la portada: ancho en px y peso máximo en bytes. */
const FONDOS = [
  { archivo: 'porteria-960.webp', ancho: 960, limite: 60_000 },
  { archivo: 'porteria-1600.webp', ancho: 1600, limite: 120_000 },
] as const;
const COMPARTIR = { archivo: 'compartir-1200x630.jpg', limite: 150_000 };

/** Prueba calidades de mayor a menor hasta que la imagen quepa en el límite. */
async function ajustarPeso(
  codificar: (calidad: number) => Promise<Buffer>,
  limite: number,
  nombre: string,
): Promise<Buffer> {
  for (let calidad = 82; calidad >= 30; calidad -= 4) {
    const datos = await codificar(calidad);
    if (datos.length <= limite) {
      console.log(`${nombre}: ${datos.length} bytes (calidad ${calidad})`);
      return datos;
    }
  }
  throw new Error(`${nombre} no cabe en ${limite} bytes ni con calidad 30.`);
}

/** Abre el juego, entra a la portería y devuelve la captura en PNG, sin HUD. */
async function capturarPorteria(page: Page): Promise<Buffer> {
  await page.goto(`${BASE}/jugar`);
  const canvas = page.getByLabel('Escena del juego');
  await canvas.waitFor();
  await page.getByRole('button', { name: 'Jugar solo' }).click({ timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const c = document.querySelector('canvas[aria-label="Escena del juego"]');
      return (
        c?.getAttribute('data-motor') === 'activo' && c.getAttribute('data-sala') === 'porteria'
      );
    },
    undefined,
    { timeout: 60_000 },
  );
  // Todo lo que no es la escena (HUD, subtítulos, avisos) se oculta. Con estilos en el
  // elemento, que la CSP del sitio sí permite (no es una hoja de estilos en línea).
  await page.evaluate(() => {
    const escena = document.querySelector('canvas[aria-label="Escena del juego"]');
    const quedan = new Set<Element>();
    for (let e = escena; e; e = e.parentElement) quedan.add(e);
    for (const e of document.body.querySelectorAll('*')) {
      if (quedan.has(e) || e.classList.contains('juego-vineta')) continue;
      if (e instanceof HTMLElement || e instanceof SVGElement) e.style.visibility = 'hidden';
    }
  });
  // El jugador aparece en z = 4,2 mirando a la salida (z = −5). Se acerca con W hasta z ≈ 1,8:
  // la puerta y el reloj quedan más grandes y la alfombra sale del cuadro.
  const z = async (): Promise<number> =>
    Number((await canvas.getAttribute('data-posicion'))?.split(',')[1] ?? NaN);
  await canvas.click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.keyboard.down('w');
  const limite = Date.now() + 20_000;
  while ((await z()) > Z_FOTO && Date.now() < limite) await page.waitForTimeout(30);
  await page.keyboard.up('w');
  // Unos cuadros quieto para que lleguen las texturas, antes de que la escala dinámica (que
  // decide cada 2 s de cuadros dibujados) baje la resolución en un equipo sin GPU.
  await page.waitForTimeout(1200);
  return await canvas.screenshot({ type: 'png' });
}

/** Una fuente de `public/fonts/` como data URL, para la página de la imagen de compartir. */
async function fuente(archivo: string): Promise<string> {
  const datos = await readFile(path.join('public', 'fonts', archivo));
  return `data:font/woff2;base64,${datos.toString('base64')}`;
}

/** La imagen de compartir: la portería oscurecida a la izquierda y el título encima. */
async function dibujarCompartir(page: Page, foto: Buffer): Promise<Buffer> {
  const fondo = await sharp(foto).resize(1200, 630, { fit: 'cover' }).jpeg().toBuffer();
  const [maquina, texto] = await Promise.all([
    fuente('courier-prime-latin-700-normal.woff2'),
    fuente('atkinson-hyperlegible-latin-400-normal.woff2'),
  ]);
  await page.setViewportSize({ width: 1200, height: 630 });
  // Solo texto propio y archivos locales: la página no pide nada a la red.
  await page.setContent(`<!doctype html>
<html lang="es-CO"><head><meta charset="utf-8" /><style>
@font-face { font-family: M; src: url(${maquina}) format('woff2'); font-weight: 700; }
@font-face { font-family: T; src: url(${texto}) format('woff2'); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body {
  box-sizing: border-box; padding: 64px 72px; display: flex; flex-direction: column;
  justify-content: center; gap: 18px; color: #f3ead6; font-family: T, sans-serif;
  background:
    radial-gradient(ellipse 60% 80% at 20% 50%, rgb(255 190 110 / 14%), transparent 70%),
    linear-gradient(90deg, rgb(20 17 13 / 92%) 0%, rgb(20 17 13 / 72%) 50%, rgb(20 17 13 / 25%) 100%),
    url(data:image/jpeg;base64,${fondo.toString('base64')}) center / cover;
}
p, h1 { margin: 0; }
.ante { font: 700 24px M, monospace; letter-spacing: .12em; text-transform: uppercase; color: #cbbd9f; }
.reloj { font: 700 44px M, monospace; letter-spacing: .08em; color: #f2a93b; text-shadow: 0 0 16px rgb(242 169 59 / 55%); }
h1 { font: 700 104px/1 M, monospace; color: #f2a93b; text-shadow: 0 0 28px rgb(242 169 59 / 30%); max-width: 9.5em; }
.gancho { font-size: 30px; line-height: 1.35; max-width: 30em; color: #f3ead6; }
</style></head><body>
<p class="ante">I. E. Los Almendros · Archivo escolar</p>
<p class="reloj">23:59</p>
<h1>La Última Prueba</h1>
<p class="gancho">Cinco salas, cinco máquinas y 40 minutos antes de que el archivo se borre.</p>
</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  return await ajustarPeso(
    (q) => sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer(),
    COMPARTIR.limite,
    COMPARTIR.archivo,
  );
}

await mkdir(CARPETA, { recursive: true });
const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ viewport: VISTA, deviceScaleFactor: DPR });
  const page = await contexto.newPage();
  const foto = await capturarPorteria(page);
  // El juego deja de dibujar: con WebGL por software ocupa toda la CPU.
  await contexto.close();
  for (const f of FONDOS) {
    const datos = await ajustarPeso(
      (q) => sharp(foto).resize({ width: f.ancho }).webp({ quality: q, effort: 6 }).toBuffer(),
      f.limite,
      f.archivo,
    );
    await writeFile(path.join(CARPETA, f.archivo), datos);
  }
  // La imagen de compartir se dibuja en una página aparte, a escala 1.
  const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
  await writeFile(path.join(CARPETA, COMPARTIR.archivo), await dibujarCompartir(pagina, foto));
} finally {
  await navegador.close();
}
