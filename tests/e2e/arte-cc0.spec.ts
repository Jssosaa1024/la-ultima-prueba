import { expect, test } from '@playwright/test';

// T19h: la portería y la sala 1 se ven con modelos de Kenney (CC0) y texturas de ambientCG.
// Cada objeto con `modelo` en salas.json muestra su GLB (la primitiva queda como caja que
// choca), y el piso, las paredes y el techo piden su KTX2 compartido.

const PORTERIA = [
  'porteria-casillero',
  'porteria-escritorio',
  'porteria-intercomunicador',
  'porteria-puerta-1',
  'porteria-puerta-2',
  'porteria-puerta-3',
  'porteria-puerta-4',
  'porteria-puerta-5',
  'porteria-salida',
  'porteria-silla',
];

const SALA_1 = [
  's1-caja-rodillos',
  's1-estante-1',
  's1-estante-2',
  's1-estante-3',
  's1-etiquetadora',
  's1-mesa',
  's1-mostrador',
  's1-puerta',
  's1-registradora',
];

const TEXTURAS = /^\/assets\/salas\/compartido\/(piso-baldosa|paredes|techo)\.[0-9a-f]{8}\.ktx2$/;

for (const [sala, url, objetos] of [
  ['porteria', '/jugar', PORTERIA],
  ['s1-cooperativa', '/jugar?sala=s1-cooperativa', SALA_1],
] as const) {
  test(`${sala}: modelos de Kenney y texturas de ambientCG`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    const texturas = new Set<string>();
    page.on('response', (r) => {
      const ruta = new URL(r.url()).pathname;
      if (TEXTURAS.test(ruta) && r.ok()) texturas.add(ruta.split('/').pop()?.split('.')[0] ?? '');
    });

    await page.goto(url);
    await page.getByRole('button', { name: 'Jugar solo' }).click();
    const canvas = page.getByLabel('Escena del juego');
    await expect(canvas).toHaveAttribute('data-sala', sala);
    await expect(canvas).toHaveAttribute('data-modelos', objetos.join(','), { timeout: 30_000 });
    await expect.poll(() => [...texturas].sort()).toEqual(['paredes', 'piso-baldosa', 'techo']);
    expect(errores).toEqual([]);
  });
}
