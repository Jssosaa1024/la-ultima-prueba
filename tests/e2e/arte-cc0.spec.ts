import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// T19h y T19i: la portería y la sala 1 se ven con modelos CC0 (KayKit, y la registradora de
// Kenney) y texturas de ambientCG. Cada objeto con `modelo` en salas.json muestra su GLB (la
// primitiva queda como caja que choca), y el piso, las paredes y el techo piden su KTX2.
// T19j: cada sala pide las texturas que dice su campo `texturas` (la sala 1 tiene parqué).
// T19l en adelante: lo mismo en cada sala que recibe su arte (el laboratorio, con KayKit).

interface SalaJson {
  id: string;
  texturas?: { piso?: string; paredes?: string; techo?: string };
  objetos: { id: string; modelo?: string }[];
}

// Playwright no importa JSON sin atributo de importación: se lee del disco.
const datos = JSON.parse(
  readFileSync(new URL('../../src/content/salas.json', import.meta.url), 'utf8'),
) as SalaJson[];

/** Los objetos con modelo de una sala, en orden: lo que el motor publica en `data-modelos`. */
const conModelo = (id: string): string[] =>
  (datos.find((s) => s.id === id)?.objetos ?? [])
    .filter((o) => o.modelo)
    .map((o) => o.id)
    .sort();

/** Los nombres de las texturas de piso, paredes y techo de una sala (sin la carpeta). */
const texturasDe = (id: string): string[] => {
  const t = datos.find((s) => s.id === id)?.texturas ?? {};
  return [t.piso, t.paredes, t.techo].flatMap((x) => (x ? [x.split('/').pop() ?? ''] : [])).sort();
};

const PORTERIA = conModelo('porteria');
const SALA_1 = conModelo('s1-cooperativa');

const TEXTURAS = /^\/assets\/salas\/compartido\/([a-z0-9-]+)\.[0-9a-f]{8}\.ktx2$/;

// Por sala: cuántos objetos con modelo como mínimo y cuántas texturas pide (el gimnasio deja
// el techo de color, porque tiene 9 m de alto).
for (const [sala, url, objetos, minimo, nTexturas] of [
  ['porteria', '/jugar', PORTERIA, 9, 3],
  ['s1-cooperativa', '/jugar?sala=s1-cooperativa', SALA_1, 9, 3],
  ['s2-laboratorio', '/jugar?sala=s2-laboratorio', conModelo('s2-laboratorio'), 9, 3],
  ['s3-gimnasio', '/jugar?sala=s3-gimnasio', conModelo('s3-gimnasio'), 5, 2],
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
    expect(objetos.length).toBeGreaterThanOrEqual(minimo);
    const canvas = page.getByLabel('Escena del juego');
    await expect(canvas).toHaveAttribute('data-sala', sala);
    await expect(canvas).toHaveAttribute('data-modelos', objetos.join(','), { timeout: 30_000 });
    const esperadas = texturasDe(sala);
    expect(esperadas).toHaveLength(nTexturas);
    // La precarga puede pedir también las de otra sala: se miran solo las de esta.
    await expect
      .poll(() => [...texturas].filter((t) => esperadas.includes(t)).sort())
      .toEqual(esperadas);
    expect(errores).toEqual([]);
  });
}
