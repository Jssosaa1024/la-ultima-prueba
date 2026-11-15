import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Ayudas de las pruebas del cooperativo: dos pestañas del mismo navegador con el transporte
 * de prueba (BroadcastChannel, `?red=pestanas`).
 */

export interface Pareja {
  /** Quien crea la partida (anfitrión): Jaguar. */
  a: Page;
  /** Quien se une: Búho. */
  b: Page;
  codigo: string;
}

/** Crea la partida en `a`, une `b` con el código y empieza. Los dos quedan en la portería. */
export async function empezarCoop(context: BrowserContext, a: Page): Promise<Pareja> {
  await a.goto('/jugar?red=pestanas');
  await a.getByRole('button', { name: 'Crear partida' }).click();
  await a.getByText('Jaguar', { exact: true }).click();
  await a.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Sala de espera' })).toBeVisible();
  const codigo = (await a.locator('.coop-codigo-grande strong').textContent()) ?? '';

  const b = await context.newPage();
  await b.goto(`/jugar?red=pestanas&codigo=${codigo}`);
  await b.getByText('Búho', { exact: true }).click();
  await b.getByText('Coral', { exact: true }).click();
  await b.getByRole('button', { name: 'Unirse', exact: true }).click();
  await b.getByRole('button', { name: 'Estoy listo' }).click();
  await a.getByRole('button', { name: 'Iniciar' }).click();
  for (const p of [a, b]) {
    await expect(p.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 'porteria', {
      timeout: 30_000,
    });
  }
  return { a, b, codigo };
}

/** La barra del grupo (encargos, votos, propuesta) de una pestaña. */
export const barra = (p: Page) => p.getByRole('region', { name: 'Grupo' });
