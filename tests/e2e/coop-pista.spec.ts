import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import type { Caja } from './escena';
import { cruzar, usar } from './recorrido';

// T88c: en grupo, una pista nueva se avisa a todos apenas el anfitrión la ofrece (T88b), no con
// la foto de cada 15 s. Búho (D, que no es anfitrión) baja la palanca tres veces sin resolver la
// etapa 1 de la etiquetadora; al tercer intento la máquina ofrece la primera pista.

async function cajaDe(p: Page): Promise<Caja> {
  const canvas = p.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

interface EventoVisto {
  t: string;
  n: number;
  en: number;
}
type ConEventos = { __eventos?: EventoVisto[] };

/**
 * Anota cada evento del anfitrión que llega por el canal de prueba entre pestañas (tipo, número
 * y cuándo). Así se ve si la foto con la pista salió justo después del resultado o fue la de
 * cada 15 s.
 */
function anotarEventos(): void {
  const Original = window.BroadcastChannel;
  const lista: EventoVisto[] = [];
  (window as unknown as ConEventos).__eventos = lista;
  window.BroadcastChannel = class extends Original {
    constructor(nombre: string) {
      super(nombre);
      this.addEventListener('message', (e: MessageEvent) => {
        const d = e.data as { k?: string; canal?: string; m?: { t?: string; n?: number } };
        if (d.k === 'msg' && d.canal === 'evt' && d.m?.t && typeof d.m.n === 'number') {
          lista.push({ t: d.m.t, n: d.m.n, en: performance.now() });
        }
      });
    }
  };
}

/** Cuándo (ms desde el inicio de la página) aparece el aviso «Pista nueva» en el HUD. */
async function cuandoHayPista(p: Page): Promise<number> {
  // Con el panel abierto el HUD queda oculto al lector de pantalla: se busca por su clase.
  await expect(p.locator('.hud-boton-aviso')).toHaveText('Pista nueva', { timeout: 60_000 });
  return p.evaluate(() => performance.timeOrigin + performance.now());
}

test('la pista ofrecida llega a todos a la vez', async ({ page, context }, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se juega en celular');
  test.setTimeout(6 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  await context.addInitScript(anotarEventos);
  const { a, b } = await empezarCoop(context, page);
  const [cajaA, cajaB] = [await cajaDe(a), await cajaDe(b)];

  // Jaguar (anfitrión) cruza la puerta 1 y Búho acepta: Búho queda con C y D. La sala nueva se
  // espera desde que Búho acepta (T05e).
  await cruzar(a, cajaA, conDedo, 'porteria-puerta-1', async () => {
    await expect(barra(b)).toContainText('Jaguar propone ir a La cooperativa');
    await barra(b).getByRole('button', { name: 'Aceptar' }).click();
  });
  await expect(b.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 's1-cooperativa');
  await expect(barra(b).getByRole('button', { name: 'Tus encargos: C y D' })).toBeVisible();
  await expect(a.locator('.hud-boton-aviso')).toHaveCount(0);

  await usar(b, cajaB, conDedo, 's1-etiquetadora');
  const panelB = b.getByRole('dialog', { name: 'La etiquetadora' });
  const panelA = a.getByRole('dialog', { name: 'La etiquetadora' });
  const palanca = panelB.getByRole('button', { name: 'Bajar la palanca' });
  const rodillo = (texto: string) => panelB.getByRole('button', { name: texto, exact: true });

  // Tres intentos que no dan los $1.600 de la pizarra: +20 %, luego +25 % y luego +50 %.
  const intentos: [string | null, string, string][] = [
    [null, '+20 %', '$2.400'],
    ['+20 %', '+25 %', '$2.500'],
    ['+25 %', '+50 %', '$3.000'],
  ];
  let hayPista: Promise<[number, number]> | null = null;
  let vioResultado = 0;
  for (const [n, [quitar, poner, precio]] of intentos.entries()) {
    if (quitar) await rodillo(quitar).click();
    await rodillo(poner).click();
    await expect(rodillo(poner)).toHaveAttribute('aria-pressed', 'true');
    await palanca.click();
    if (n === 0) {
      await barra(a).getByRole('button', { name: 'Ver propuesta' }).click({ timeout: 60_000 });
    }
    if (n === intentos.length - 1) {
      // Desde antes de aceptar el último: se mide cuándo lo ve cada uno.
      hayPista = Promise.all([cuandoHayPista(a), cuandoHayPista(b)]);
    } else {
      await expect(a.locator('.hud-boton-aviso')).toHaveCount(0);
    }
    await panelA.getByRole('button', { name: 'Aceptar', exact: true }).click({ timeout: 60_000 });
    await expect(panelB.locator('.respuesta')).toContainText(precio, { timeout: 60_000 });
    vioResultado = await b.evaluate(() => performance.timeOrigin + performance.now());
  }
  if (!hayPista) throw new Error('sin intentos');
  const [enA, enB] = await hayPista;
  // Los dos la ven a la vez y apenas Búho ve el resultado. Antes de T88b la pista llegaba a
  // todos (también a la pestaña del anfitrión) con la foto de cada 15 s.
  expect(Math.abs(enB - enA), 'diferencia entre las dos pestañas (ms)').toBeLessThan(4000);
  expect(enB - vioResultado, 'desde el resultado hasta la pista (ms)').toBeLessThan(4000);
  // A Búho la pista le llegó con una foto pegada al resultado que la abrió, no con la periódica.
  const eventos = await b.evaluate(() => (window as unknown as ConEventos).__eventos ?? []);
  const resultados = eventos.filter((e) => e.t === 'resultado');
  const ultimo = resultados.at(-1);
  expect(resultados).toHaveLength(3);
  const foto = eventos.find((e) => e.t === 'estado' && ultimo && e.n === ultimo.n + 1);
  expect(foto, 'la foto sale justo después del tercer resultado').toBeTruthy();
  expect((foto?.en ?? Infinity) - (ultimo?.en ?? 0)).toBeLessThan(500);

  // Búho la abre y la pista queda vista para los dos.
  await panelB.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await b.getByRole('button', { name: 'Pista nueva' }).click();
  await b.getByRole('dialog').getByRole('button', { name: 'Ver pista' }).click();
  await expect(a.locator('.hud-boton-aviso')).toHaveCount(0, { timeout: 20_000 });
});
