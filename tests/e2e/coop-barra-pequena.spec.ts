import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import { recoger } from './recorrido';

// T87b: en un celular pequeño en horizontal, la barra del grupo no tapa los controles del HUD,
// ni el centro de la escena, ni los paneles, y su texto se lee completo.

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
  que: string;
}

/** Cajas visibles de la barra y del resto de lo que se toca en la pantalla. */
async function medir(p: Page): Promise<{ barra: Caja[]; hud: Caja[]; texto: string[] }> {
  return p.evaluate(() => {
    // Lo que queda fuera de una lista que se desliza no se ve: se recorta con la lista.
    const caja = (el: Element, que: string) => {
      const r = el.getBoundingClientRect();
      let [x1, y1, x2, y2] = [r.left, r.top, r.right, r.bottom];
      const lista = el.parentElement?.closest('.coop-desliza, .coop-barra-avisos');
      if (lista) {
        const l = lista.getBoundingClientRect();
        [x1, y1, x2, y2] = [
          Math.max(x1, l.left),
          Math.max(y1, l.top),
          Math.min(x2, l.right),
          Math.min(y2, l.bottom),
        ];
      }
      return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1), que };
    };
    const visibles = (sel: string) =>
      [...document.querySelectorAll(sel)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    const nombre = (el: Element) => `${el.className} «${(el.textContent ?? '').slice(0, 30)}»`;
    const enBarra = visibles('.coop-barra button, .coop-barra p, .coop-aviso');
    const hud = visibles(
      '.hud-partida button, .hud-reloj, .hud-sellos, .hud-objeto, .hud-accion, .joystick',
    );
    // Texto que no se lee: letra de menos de 14 px, cortado o fuera de la pantalla.
    const texto: string[] = [];
    for (const el of enBarra) {
      const r = el.getBoundingClientRect();
      const tam = parseFloat(getComputedStyle(el).fontSize);
      if (tam < 14) texto.push(`${nombre(el)}: letra de ${tam}px`);
      if (el.scrollWidth > el.clientWidth + 1) texto.push(`${nombre(el)}: cortado`);
      if (r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) {
        // Dentro de una lista que se desliza puede quedar fuera; la lista no.
        const lista = el.closest('.coop-desliza');
        const rl = lista?.getBoundingClientRect();
        if (!rl || rl.left < 0 || rl.right > innerWidth) texto.push(`${nombre(el)}: fuera`);
      }
    }
    return {
      barra: enBarra.map((el) => caja(el, nombre(el))).filter((c) => c.w > 0 && c.h > 0),
      hud: hud.map((el) => caja(el, nombre(el))),
      texto,
    };
  });
}

const cruzan = (a: Caja, b: Caja) =>
  a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;

async function revisar(p: Page, cuando: string): Promise<void> {
  const tam = p.viewportSize();
  if (!tam) throw new Error('sin tamaño');
  await p.screenshot({ path: test.info().outputPath(`${tam.width}-${cuando}.png`) });
  const m = await medir(p);
  expect(m.texto, `${cuando}: texto que no se lee`).toEqual([]);
  const choques = m.barra.flatMap((b) =>
    m.hud.filter((h) => cruzan(b, h)).map((h) => `${b.que} tapa ${h.que}`),
  );
  expect(choques, `${cuando}: la barra tapa el HUD`).toEqual([]);
  // El centro de la escena (donde se apunta) queda libre: 20 % del ancho y del alto.
  const centro: Caja = {
    x: tam.width * 0.4,
    y: tam.height * 0.4,
    w: tam.width * 0.2,
    h: tam.height * 0.2,
    que: 'centro',
  };
  const enCentro = m.barra.filter((b) => cruzan(b, centro)).map((b) => b.que);
  expect(enCentro, `${cuando}: la barra tapa el centro`).toEqual([]);
}

for (const tam of [
  { width: 740, height: 360 },
  { width: 851, height: 393 },
]) {
  test(`barra del grupo en ${tam.width}×${tam.height}`, async ({ page, context }, info) => {
    test.skip(info.project.name === 'escritorio', 'Es una prueba de celular en horizontal');
    test.setTimeout(4 * 60_000);
    await page.setViewportSize(tam);
    const { a, b } = await empezarCoop(context, page);
    await b.setViewportSize(tam);
    const canvasA = a.getByLabel('Escena del juego');
    await expect(canvasA).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
    const cajaA = await canvasA.boundingBox();
    if (!cajaA) throw new Error('sin canvas');

    // Lo más que se junta en la portería: algo en la mano, una votación abierta, una frase
    // de un compañero y una lista de botones desplegada.
    await recoger(a, cajaA, info.project.use.hasTouch === true, 'porteria-linterna');
    await barra(b).getByRole('button', { name: 'Pausar' }).click();
    await expect(barra(a)).toContainText('Búho propone pausar el reloj.');
    await barra(b).getByRole('button', { name: 'Frases' }).click();
    await barra(b).getByRole('button', { name: '¡Aquí!' }).click();
    await expect(barra(a)).toContainText('Búho: ¡Aquí!');
    await revisar(a, 'con una votación');

    await barra(a).getByRole('button', { name: 'Frases' }).click();
    await revisar(a, 'con las frases abiertas');
    await barra(a).getByRole('button', { name: 'Pasar objeto' }).click();
    await revisar(a, 'con «Pasar objeto» abierto');

    // Los botones de los avisos se siguen tocando.
    await barra(a).getByRole('button', { name: 'Aceptar' }).click();
    await expect(a.getByRole('timer')).toHaveAccessibleName(/en pausa/);
    await revisar(a, 'con el reloj en pausa');

    // Con un panel abierto, la barra queda debajo del panel.
    await a.getByRole('button', { name: 'Cuaderno' }).click();
    await expect(a.getByRole('dialog')).toBeVisible();
    const tapada = await a.evaluate(() =>
      [...document.querySelectorAll('.coop-barra button, .coop-barra p')].every((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return true;
        const encima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return encima !== null && encima.closest('.dialogo-fondo') !== null;
      }),
    );
    expect(tapada, 'la barra queda debajo del panel').toBe(true);
  });
}
