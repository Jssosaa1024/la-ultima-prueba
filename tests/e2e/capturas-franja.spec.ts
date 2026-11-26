import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  caminarHasta as caminarHacia,
  continuarEn,
  mirarHacia,
  tocarObjeto,
  type Caja,
  type PartidaDePrueba,
  type Punto3,
} from './escena';
import { caminarHasta } from './maquinas';

// Correcciones del 25 nov (sesión C): el panel de cada máquina en el celular más bajo que
// tenemos en cuenta, 740×360 en horizontal. Deja una captura por sala y mide cuánto se
// desplaza el panel y cuánto del ancho tapa.

test.slow();
test.use({
  viewport: { width: 740, height: 360 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
});

interface Maquina {
  sala: PartidaDePrueba['sala'];
  titulo: string;
  usar: RegExp;
  punto: Punto3;
  partida?: Omit<PartidaDePrueba, 'sala'>;
  acercarse?: (page: Page, caja: Caja) => Promise<void>;
  /** El botón que acciona la máquina, si tiene uno. */
  accionar?: string;
}

const MAQUINAS: readonly Maquina[] = [
  {
    sala: 's1-cooperativa',
    titulo: 'La etiquetadora',
    usar: /Usar.*Etiquetadora/,
    punto: [0.55, 1.15, -0.6],
    partida: { etapas: 2 },
    accionar: 'Bajar la palanca',
  },
  {
    sala: 's2-laboratorio',
    titulo: 'Los tanques y el graficador',
    usar: /Usar.*Tablero de los tanques/,
    punto: [-1.3, 0.55, -0.85],
    partida: { etapas: 2, inventario: ['s2-hoja-ayer'] },
    accionar: 'Bajar la palanca',
    acercarse: async (page, caja) => {
      await mirarHacia(page, caja, [-1.3, 0.55, -0.85], true);
      await caminarHacia(page, caja, true, (_x, z) => z < 0.9);
    },
  },
  {
    sala: 's3-gimnasio',
    titulo: 'El reflector y las sombras',
    usar: /Usar.*Postes de voleibol/,
    punto: [2, 1.3, -1],
    partida: { etapas: 2 },
    accionar: 'Soltar la polea',
    acercarse: (page, caja) => caminarHasta(page, caja, true, (_x, z) => z <= -0.55),
  },
  {
    sala: 's4-biblioteca',
    titulo: 'Los carritos de préstamo',
    usar: /Usar.*Carritos de préstamo/,
    punto: [-2.1, 0.5, -1.2],
    partida: { etapas: 2, ajustes: { carritos: [2, 2, 3, 4, 8] } },
    acercarse: (page, caja) => caminarHasta(page, caja, true, (_x, z) => z <= -0.55),
  },
  {
    sala: 's5-rectoria',
    titulo: 'El juego justo de La Voz',
    usar: /Usar.*Urna/,
    punto: [-0.6, 0.98, -0.5],
    partida: { etapas: 2, ajustes: { azules: 6, amarillas: 3 } },
    accionar: 'Tirar de la manija',
  },
];

/** Cuánto del ancho tapa el panel y cuánto se desplaza su cuerpo. */
async function medir(panel: Locator): Promise<{ ancho: number; alto: number; desborde: number }> {
  return panel.evaluate((d) => {
    const cuerpo = d.querySelector('.dialogo-cuerpo') ?? d;
    const caja = d.getBoundingClientRect();
    return {
      ancho: Math.round((caja.width / window.innerWidth) * 100),
      alto: Math.round(caja.height),
      desborde: cuerpo.scrollHeight - cuerpo.clientHeight,
    };
  });
}

async function abrir(page: Page, m: Maquina): Promise<Locator> {
  const caja = await continuarEn(page, { sala: m.sala, ...m.partida });
  await m.acercarse?.(page, caja);
  const panel = page.getByRole('dialog', { name: m.titulo });
  const usar = page.getByRole('button', { name: m.usar });
  for (let intento = 0; intento < 3 && !(await panel.isVisible()); intento++) {
    await tocarObjeto(page, caja, m.punto, true, m.usar);
    await usar.click({ timeout: 5000 }).catch(() => undefined);
    await panel.waitFor({ timeout: 10_000 }).catch(() => undefined);
  }
  await expect(panel).toBeVisible();
  return panel;
}

for (const m of MAQUINAS) {
  test(`captura del panel: ${m.titulo}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'Solo en el celular');
    const panel = await abrir(page, m);
    // Que termine de entrar deslizándose.
    await page.waitForTimeout(600);
    const medida = await medir(panel);
    console.log(`${m.sala}: ${JSON.stringify(medida)}`);
    await page.screenshot({ path: info.outputPath(`${m.sala}.png`) });
    // Una columna a la derecha de no más del 35 % del ancho, sin desplazarse.
    expect(medida.ancho, 'ancho del panel (%)').toBeLessThanOrEqual(35);
    expect(medida.desborde, 'lo que se desplaza el panel (px)').toBeLessThanOrEqual(1);

    // «Ver» recoge los controles a una pestaña y la pestaña los devuelve.
    await panel.getByRole('button', { name: 'Ver la máquina' }).click();
    const pestana = page.getByRole('button', { name: 'Mostrar los controles' });
    await expect(panel).toBeHidden();
    await expect(pestana).toBeFocused();
    await page.screenshot({ path: info.outputPath(`${m.sala}-ver.png`) });
    await pestana.click();
    await expect(panel).toBeVisible();

    // Al accionar, el panel se recoge mientras la máquina 3D se mueve y vuelve con lo que pasó.
    if (!m.accionar) return;
    await panel.getByRole('button', { name: m.accionar }).click();
    await expect(panel).toBeHidden();
    await expect(pestana).toBeVisible();
    await expect(panel).toBeVisible({ timeout: 40_000 });
    await expect(
      panel.locator('.respuesta, .mecanismo-resuelta').filter({ visible: true }).first(),
    ).toBeVisible();
    await page.waitForTimeout(300);
    const conRespuesta = await medir(panel);
    console.log(`${m.sala} con respuesta: ${JSON.stringify(conRespuesta)}`);
    await page.screenshot({ path: info.outputPath(`${m.sala}-respuesta.png`) });
    expect(conRespuesta.desborde, 'lo que se desplaza con la respuesta (px)').toBeLessThanOrEqual(
      1,
    );
  });
}
