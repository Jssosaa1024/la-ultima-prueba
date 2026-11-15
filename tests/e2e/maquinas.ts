import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { leer, type Caja } from './escena';

/**
 * Ayuda para las e2e de las máquinas de las salas grandes (T58, T64): caminar desde la puerta
 * hasta la máquina. Lo demás (partida guardada, girar, tocar) está en `escena.ts`.
 */

/**
 * Camina de frente hasta que `llego(x, z)` sea verdadero: con el joystick en celular y con la
 * tecla W en escritorio. No camina «por tiempo»: con el equipo ocupado se avanza menos.
 *
 * Ojo: con el equipo ocupado, la orden de soltar llega tarde y el jugador sigue de largo. Por
 * eso conviene caminar hasta algo sólido que lo detenga (una baranda, un mueble) y pedir en
 * `llego` esa posición final, no una línea a mitad de camino.
 */
export async function caminarHasta(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  llego: (x: number, z: number) => boolean,
): Promise<void> {
  const esperar = async (): Promise<void> => {
    await expect
      .poll(async () => llego(...(await leer(page, 'data-posicion'))), { intervals: [50] })
      .toBe(true);
  };
  if (!conDedo) {
    await page.keyboard.down('KeyW');
    try {
      await esperar();
    } finally {
      await page.keyboard.up('KeyW');
    }
    return;
  }
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  const cdp = await page.context().newCDPSession(page);
  const dedo = (dy: number) => [{ x, y: y - dy, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: dedo(0) });
  try {
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: dedo(i * 10) });
    }
    await esperar();
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
}
