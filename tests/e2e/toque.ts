import type { Page } from '@playwright/test';

/** Lo que dura el toque simulado, en segundos: como un dedo de verdad, muy por debajo de 350 ms. */
const DURACION_TOQUE_S = 0.05;

/**
 * Toque corto en (x, y): dedo en el perfil celular, clic en escritorio (T05b).
 *
 * Un toque solo cuenta si el dedo sube antes de 350 ms (`DURACION_MAX_TOQUE`). Bajar y subir son
 * dos mensajes al navegador y, con el equipo ocupado, entre uno y otro puede pasar más que eso:
 * el juego lo tomaba, con razón, como un dedo quieto y no seleccionaba nada. Por eso cada
 * mensaje lleva su hora: el navegador la usa como `event.timeStamp`, y el toque dura siempre
 * 50 ms aunque los mensajes lleguen separados.
 */
export async function tocar(
  page: Page,
  p: { x: number; y: number },
  conDedo: boolean | undefined,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const baja = Date.now() / 1000;
  const sube = baja + DURACION_TOQUE_S;
  if (conDedo) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: p.x, y: p.y, id: 1 }],
      timestamp: baja,
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
      timestamp: sube,
    });
  } else {
    const boton = { x: p.x, y: p.y, button: 'left', clickCount: 1 } as const;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
    await cdp.send('Input.dispatchMouseEvent', { ...boton, type: 'mousePressed', timestamp: baja });
    await cdp.send('Input.dispatchMouseEvent', {
      ...boton,
      type: 'mouseReleased',
      timestamp: sube,
    });
  }
  await cdp.detach();
}
