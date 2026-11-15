import { expect, test, type Page } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';

// T41: objetivos táctiles de 44 px, nombres accesibles, foco visible y anuncios.
// El anuncio «Recogiste: …» se prueba al recoger el cuaderno, en `partida.spec.ts`.

const TOCABLES = 'button, a[href], summary, textarea, input, select';

/** La caja de rodillos, sobre el mostrador de la cooperativa. */
const CAJA_DE_RODILLOS: Punto3 = [1.55, 1.08, -0.6];

/** Revisa que todo lo tocable que se ve mida al menos 44 × 44 px y tenga nombre. */
async function revisarTocables(page: Page, donde: string): Promise<void> {
  const problemas = await page.evaluate((selector) => {
    const fallas: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const caja = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      const visible =
        caja.width > 0 &&
        caja.height > 0 &&
        estilo.visibility !== 'hidden' &&
        !el.closest('[inert]');
      if (!visible) continue;
      const nombre = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      const etiqueta = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      if (!nombre && !etiqueta) fallas.push(`${el.tagName} sin nombre`);
      if (caja.height < 44 || caja.width < 44) {
        fallas.push(
          `${nombre || el.tagName}: ${Math.round(caja.width)}×${Math.round(caja.height)}`,
        );
      }
    }
    return fallas;
  }, TOCABLES);
  expect(problemas, donde).toEqual([]);
}

test('el menú de inicio: objetivos de 44 px con nombre', async ({ page }) => {
  await page.goto('/jugar');
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await revisarTocables(page, 'menú');
});

test('HUD, inspección, cuaderno y panel de la máquina: objetivos de 44 px con nombre', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, {
    sala: 's1-cooperativa',
    inventario: ['porteria-cuaderno', 'porteria-linterna'],
  });
  await expect(page.getByRole('timer')).toBeVisible();
  await revisarTocables(page, 'HUD');

  await tocarObjeto(page, caja, CAJA_DE_RODILLOS, conDedo, /Examinar.*Caja de rodillos/);
  await revisarTocables(page, 'HUD con el botón contextual');
  await page.getByRole('button', { name: /Examinar.*Caja de rodillos/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await revisarTocables(page, 'inspección');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Cuaderno' }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  await cuaderno.getByLabel('Nueva nota').fill('una nota');
  await cuaderno.getByRole('button', { name: 'Guardar nota' }).click();
  await revisarTocables(page, 'cuaderno');
});

test('las pantallas de final cumplen los 44 px', async ({ page }) => {
  // A la partida guardada le quedan pocos segundos: termina en «Tiempo cumplido».
  await continuarEn(page, { sala: 's1-cooperativa', restanteMs: 3000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Tiempo cumplido' })).toBeVisible();
  await revisarTocables(page, 'final');
  await page.getByRole('button', { name: 'Ver créditos' }).click();
  await revisarTocables(page, 'créditos');
});

test('con el teclado, el foco se ve', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'celular', 'El teclado es de escritorio');
  void browserName;
  await page.goto('/jugar');
  const jugar = page.getByRole('button', { name: 'Jugar solo' });
  await expect(jugar).toBeVisible();
  await jugar.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(jugar).toBeFocused();
  const contorno = await jugar.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(contorno).toBe('solid');
});

test('el HUD tiene un encabezado para el lector de pantalla', async ({ page }) => {
  await page.goto('/jugar');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Partida en curso' })).toHaveCount(1);
});
