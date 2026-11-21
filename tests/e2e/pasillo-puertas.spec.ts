import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { continuarEn, inclinarHacia, mirarHacia } from './escena';
import { centro, irA, usar } from './recorrido';

// Pasillos (sesión C): las puertas falsas responden con el picaporte y una frase corta, y el
// cartel de cada sala resuelta lleva su sello. Solo con el celular: es lo que se juega primero.

interface Frase {
  id: string;
  rotulo: string;
  texto?: string;
  voz?: string;
}
interface Linea {
  id: string;
  texto: string;
}

const leerJson = <T>(ruta: string): T =>
  JSON.parse(readFileSync(new URL(`../../src/content/${ruta}`, import.meta.url), 'utf8')) as T;
const frases = leerJson<Frase[]>('puertas-falsas.json');
const guion = leerJson<Linea[]>('guion.json');

const PROFESORES = frases.find((f) => f.id === 'profesores');
const lineaDe = (f: Frase | undefined): string =>
  f?.texto ?? guion.find((l) => l.id === f?.voz)?.texto ?? '';

test.skip(({ isMobile }) => !isMobile, 'el pasillo se prueba con el celular');

test('puerta falsa: La Voz la dice una vez y después sale escrita; los carteles llevan su sello', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  if (!PROFESORES?.voz) throw new Error('la sala de profesores debería tener una frase de La Voz');
  // Las salas 1 y 2 ya tienen su sello: el jugador está en la portería.
  const caja = await continuarEn(page, { sala: 's3-gimnasio', lugar: 'porteria' });

  // Primera vez: La Voz la dice (subtítulo) y la tirita de papel no la repite.
  await usar(page, caja, true, 'pasillo-puerta-profesores', { cerca: 1.6 });
  await expect(page.locator('.subtitulos')).toContainText(lineaDe(PROFESORES));
  await expect(page.locator('.hud-aviso-archivo')).toHaveCount(0);

  // Segunda vez: sale escrita, con el rótulo, abajo y sin tapar el centro; el lector la oye.
  await expect(page.locator('.subtitulos')).toBeEmpty({ timeout: 15_000 });
  await usar(page, caja, true, 'pasillo-puerta-profesores', { cerca: 1.6 });
  const aviso = page.locator('.hud-aviso-archivo');
  await expect(aviso).toContainText(lineaDe(PROFESORES));
  await expect(aviso).toContainText(PROFESORES.rotulo);
  await expect(page.locator('.solo-lector[aria-live="polite"]')).toContainText(
    `${PROFESORES.rotulo}: ${lineaDe(PROFESORES)}`,
  );
  const borde = await aviso.boundingBox();
  if (!borde) throw new Error('sin aviso');
  // No tapa el centro de la pantalla, que es donde se apunta.
  expect(borde.y).toBeGreaterThan(caja.y + caja.height * 0.5);
  await page.screenshot({ path: info.outputPath('aviso-puerta-falsa.png') });
  // Se va solo.
  await expect(aviso).toHaveCount(0, { timeout: 8_000 });

  // El cartel de la sala 1 lleva su sello: se mira desde el centro del tramo 1, de frente.
  const cartel = centro('pasillo-cartel-s1');
  await irA(page, caja, true, [-4.9, 0, cartel[2]], 0.3);
  await mirarHacia(page, caja, cartel, true);
  await inclinarHacia(page, caja, cartel, true);
  await page.screenshot({ path: info.outputPath('cartel-sala-1-con-sello.png') });

  // Hacia el fondo del tramo 1: el cartel de la sala 2 (con sello) y la flecha 2.
  const flecha = centro('pasillo-flecha-2');
  await irA(page, caja, true, [-4.6, 0, -6.6], 0.3);
  await mirarHacia(page, caja, flecha, true);
  await inclinarHacia(page, caja, [flecha[0], 2, flecha[2]], true);
  await page.screenshot({ path: info.outputPath('tramo-1-hacia-el-norte.png') });
});
