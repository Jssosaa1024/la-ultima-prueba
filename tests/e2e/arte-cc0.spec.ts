import { expect, test } from '@playwright/test';
import datos from '../../src/content/salas.json';

// T19h y T19i: la portería y la sala 1 se ven con modelos CC0 (KayKit, y la registradora de
// Kenney) y texturas de ambientCG. Cada objeto con `modelo` en salas.json muestra su GLB (la
// primitiva queda como caja que choca), y el piso, las paredes y el techo piden su KTX2.

/** Los objetos con modelo de una sala, en orden: lo que el motor publica en `data-modelos`. */
const conModelo = (id: string): string[] =>
  (datos.find((s) => s.id === id)?.objetos ?? [])
    .filter((o) => 'modelo' in o && o.modelo)
    .map((o) => o.id)
    .sort();

const PORTERIA = conModelo('porteria');
const SALA_1 = conModelo('s1-cooperativa');

const TEXTURAS = /^\/assets\/salas\/compartido\/(piso-baldosa|paredes|techo)\.[0-9a-f]{8}\.ktx2$/;

for (const [sala, url, objetos] of [
  ['porteria', '/jugar', PORTERIA],
  ['s1-cooperativa', '/jugar?sala=s1-cooperativa', SALA_1],
] as const) {
  test(`${sala}: modelos CC0 y texturas de ambientCG`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    const texturas = new Set<string>();
    page.on('response', (r) => {
      const ruta = new URL(r.url()).pathname;
      if (TEXTURAS.test(ruta) && r.ok()) texturas.add(ruta.split('/').pop()?.split('.')[0] ?? '');
    });

    await page.goto(url);
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    expect(objetos.length).toBeGreaterThan(8);
    const canvas = page.getByLabel('Escena del juego');
    await expect(canvas).toHaveAttribute('data-sala', sala);
    await expect(canvas).toHaveAttribute('data-modelos', objetos.join(','), { timeout: 30_000 });
    await expect.poll(() => [...texturas].sort()).toEqual(['paredes', 'piso-baldosa', 'techo']);
    expect(errores).toEqual([]);
  });
}
