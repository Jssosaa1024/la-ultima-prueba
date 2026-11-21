import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import { caminarHasta, leer, mirarHacia } from './escena';

// T83c: los compañeros son personajes del paquete de Kenney. Quietos cuando no se mueven,
// caminando mientras llegan sus poses y saludando cuando su jugador manda una frase rápida;
// con «reducir movimiento» no saludan. El canvas lo cuenta en `data-animacion`
// («alias:paso[+saludo][+fuera]») y `data-saludos`.

/** Lo que hace el personaje de `alias` en la pantalla de `p` (`quieto`, `caminar+fuera`…). */
async function animacion(p: Page, alias: string): Promise<string> {
  const valor = (await p.getByLabel('Escena del juego').getAttribute('data-animacion')) ?? '';
  for (const parte of valor.split(';')) {
    const [nombre, que] = parte.split(':');
    if (nombre === alias && que) return que;
  }
  return '';
}

async function decir(p: Page, frase: string): Promise<void> {
  const frases = barra(p).getByRole('button', { name: 'Frases' });
  if ((await frases.getAttribute('aria-expanded')) !== 'true') await frases.click();
  await barra(p).getByRole('button', { name: frase }).click();
}

test('el compañero camina, se detiene y saluda con «¡Aquí!»; con reducir movimiento no saluda', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo se prueba en celular');
  test.setTimeout(5 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const canvasA = a.getByLabel('Escena del juego');
  const canvasB = b.getByLabel('Escena del juego');

  // Jaguar ve a Búho con el personaje del paquete (no el de prueba hecho por código).
  await expect(canvasA).toHaveAttribute('data-personajes', 'kenney-mini-characters', {
    timeout: 60_000,
  });
  await expect.poll(() => animacion(a, 'buho'), { timeout: 30_000 }).toMatch(/^quieto/);

  // Búho camina: en la pantalla de Jaguar su personaje camina (vea o no a Búho).
  await expect(canvasB).toHaveAttribute('data-posicion', /,/);
  const [x0, z0] = await leer(b, 'data-posicion');
  const cajaB = await canvasB.boundingBox();
  if (!cajaB) throw new Error('sin canvas');
  const vistos = new Set<string>();
  let caminando = true;
  const mirar = (async () => {
    while (caminando) {
      vistos.add((await animacion(a, 'buho')).split('+')[0] ?? '');
      await a.waitForTimeout(150);
    }
  })();
  await caminarHasta(b, cajaB, conDedo, (x, z) => Math.hypot(x - x0, z - z0) > 2.5);
  // Lo que se dibuja va un poco en el pasado: se sigue mirando un momento.
  await expect.poll(() => vistos.has('caminar'), { timeout: 20_000 }).toBe(true);
  caminando = false;
  await mirar;
  // Y al detenerse vuelve a quedarse quieto.
  await expect.poll(() => animacion(a, 'buho'), { timeout: 20_000 }).toMatch(/^quieto/);

  // Jaguar mira a Búho y Búho dice «¡Aquí!»: su personaje saluda.
  const cajaA = await canvasA.boundingBox();
  if (!cajaA) throw new Error('sin canvas');
  const [bx, bz] = await leer(b, 'data-posicion');
  await mirarHacia(a, cajaA, [bx, 1, bz], conDedo);
  await expect.poll(() => animacion(a, 'buho'), { timeout: 20_000 }).toBe('quieto');
  await expect(canvasA).toHaveAttribute('data-saludos', '0');
  await decir(b, '¡Aquí!');
  await expect(canvasA).toHaveAttribute('data-saludos', '1', { timeout: 30_000 });

  // Con «reducir movimiento», otra frase ya no lo hace saludar.
  await a.emulateMedia({ reducedMotion: 'reduce' });
  await b.waitForTimeout(1200);
  await decir(b, 'Mira esto');
  await expect(barra(a)).toContainText('Búho: Mira esto', { timeout: 30_000 });
  await a.waitForTimeout(1500);
  await expect(canvasA).toHaveAttribute('data-saludos', '1');
});
