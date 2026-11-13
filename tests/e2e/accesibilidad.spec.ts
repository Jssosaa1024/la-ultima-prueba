import { expect, test, type Page } from '@playwright/test';

// T41: objetivos táctiles de 44 px, nombres accesibles, foco visible y anuncios.

const TOCABLES = 'button, a[href], summary, textarea, input, select';

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

test('menú, HUD, inspección, cuaderno y final: objetivos de 44 px con nombre', async ({ page }) => {
  await page.goto('/jugar?ejemplo=1');
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await revisarTocables(page, 'menú');

  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await revisarTocables(page, 'HUD');

  await page.getByRole('button', { name: /^Examinar/ }).click();
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
  await page.goto('/jugar?ejemplo=1&final=justo_a_tiempo');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Justo a tiempo' })).toBeVisible();
  await revisarTocables(page, 'final');
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

test('recoger un objeto se anuncia al lector de pantalla', async ({ page }) => {
  await page.goto('/jugar?ejemplo=1');
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  // Factura y menú se examinan; la tarjeta se recoge.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /^Examinar/ }).click();
    await page.getByRole('button', { name: 'Cerrar' }).click();
  }
  await page.getByRole('button', { name: /^Recoger/ }).click();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    'Recogiste: Tarjeta de porcentajes.',
  );
});
