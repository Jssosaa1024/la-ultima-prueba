import { expect, test, type Page } from '@playwright/test';
import { continuarEn } from './escena';

// Ola 6 · tema «Archivo del colegio de noche» (T41c) en el menú de inicio: legible y fácil de
// tocar en un celular en horizontal (740 × 360), con letra de 14 px o más y sin animaciones si
// el equipo pide menos movimiento.

/** Tamaño de letra más pequeño de los textos visibles dentro de `selector`, en px. */
async function letraMinima(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((raiz) => {
    let minimo = Infinity;
    const recorrer = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = recorrer.nextNode(); n; n = recorrer.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || el.closest('[aria-hidden="true"], .solo-lector')) {
        continue;
      }
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      minimo = Math.min(minimo, parseFloat(getComputedStyle(el).fontSize));
    }
    return minimo;
  });
}

test.describe('celular en horizontal, 740 × 360', () => {
  test.use({ viewport: { width: 740, height: 360 } });

  test('el menú cabe sin deslizar: botones de 44 px o más y letra de 14 px o más', async ({
    page,
  }) => {
    await page.goto('/jugar');
    const menu = page.getByRole('main');
    await expect(page.getByRole('heading', { name: 'La Última Prueba' })).toBeVisible();
    // El motivo del tema: el reloj ámbar de las 00:40.
    await expect(menu).toContainText('El archivo se borra a las 00:40');

    const botones = menu.locator('.boton');
    await expect(botones).toHaveCount(5);
    for (const boton of await botones.all()) {
      const caja = await boton.boundingBox();
      expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Todo se ve sin deslizar: ningún botón queda debajo del borde de la pantalla.
      expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(360);
      // El texto del botón cabe en una línea.
      expect(caja?.height ?? 0).toBeLessThan(60);
    }
    expect(await letraMinima(page, 'main')).toBeGreaterThanOrEqual(14);
    // Sin scroll de lado.
    const lado = await menu.evaluate((m) => m.scrollWidth - m.clientWidth);
    expect(lado).toBe(0);
  });

  test('crear partida: el formulario va en la ficha y se lee en 14 px o más', async ({ page }) => {
    await page.goto('/jugar?red=pestanas');
    await page.getByRole('button', { name: 'Crear partida' }).click();
    await expect(page.getByRole('heading', { name: 'Crear partida' })).toBeVisible();
    await expect(page.locator('.tema-ficha')).toContainText('Expediente en grupo');
    expect(await letraMinima(page, 'main')).toBeGreaterThanOrEqual(14);
  });
});

test.describe('pausa en 740 × 360 (T41d)', () => {
  test.use({ viewport: { width: 740, height: 360 } });

  test('la ficha de pausa y la confirmación caben, con botones de 44 px y letra de 14 px', async ({
    page,
  }) => {
    await page.goto('/jugar');
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    await page.getByRole('button', { name: 'Pausa' }).click();
    for (const nombre of ['Pausa', '¿Salir de la partida?']) {
      const ficha = page.getByRole('dialog', { name: nombre });
      await expect(ficha).toBeVisible();
      for (const boton of await ficha.getByRole('button').all()) {
        const caja = await boton.boundingBox();
        expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(360);
      }
      expect(await letraMinima(page, '.dialogo')).toBeGreaterThanOrEqual(14);
      if (nombre === 'Pausa')
        await ficha.getByRole('button', { name: 'Salir de la partida' }).click();
    }
  });
});

test.describe('final en 740 × 360 (T41e)', () => {
  test.use({ viewport: { width: 740, height: 360 } });

  test('el expediente cerrado lleva su sello y el resumen se lee en 14 px o más', async ({
    page,
  }) => {
    // A la partida le quedan 5 s: llega sola al final «Tiempo cumplido».
    await continuarEn(page, { sala: 's2-laboratorio', restanteMs: 5000 });
    const titulo = page.getByRole('heading', { level: 1, name: 'Tiempo cumplido' });
    await expect(titulo).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.final-sello')).toHaveText('Tiempo cumplido');
    // Cada sala del resumen lleva un sello con cómo terminó (texto real, no solo color).
    const resumen = page.getByRole('region', { name: 'Lo que aprendiste esta noche' });
    await expect(resumen.locator('.tema-sello')).toHaveCount(5);
    await expect(resumen.locator('.tema-sello').first()).toHaveText('Resuelta sin pistas');
    await expect(resumen.locator('.tema-sello').last()).toHaveText('Sin resolver');
    expect(await letraMinima(page, 'main')).toBeGreaterThanOrEqual(14);
    for (const boton of await page.getByRole('main').getByRole('button').all()) {
      expect((await boton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('con menos movimiento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('la ficha y el sello aparecen quietos', async ({ page }) => {
    await page.goto('/jugar');
    const sello = page.locator('.tema-sello');
    await expect(sello).toHaveText('Por revisar');
    expect(await sello.evaluate((s) => getComputedStyle(s).animationName)).toBe('none');
    const ficha = page.locator('.tema-ficha');
    expect(await ficha.evaluate((f) => getComputedStyle(f).animationName)).toBe('none');
  });
});
