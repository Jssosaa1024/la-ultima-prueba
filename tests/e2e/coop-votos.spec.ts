import { expect, test } from '@playwright/test';
import { barra, empezarCoop } from './coop';

// T87: votos del grupo. Pausar y reanudar el reloj piden que todos acepten.

test('pausar y reanudar el reloj por votación', async ({ page, context }) => {
  const { a, b } = await empezarCoop(context, page);
  await barra(a).getByRole('button', { name: 'Pausar' }).click();
  await expect(barra(a)).toContainText('Propones pausar el reloj. Aceptaron 1 de 2. Falta Búho.');
  // Mientras falte alguien, el reloj sigue.
  await expect(b.getByRole('timer')).not.toHaveAccessibleName(/en pausa/);
  await expect(barra(b)).toContainText('Jaguar propone pausar el reloj.');
  await barra(b).getByRole('button', { name: 'Aceptar' }).click();

  for (const p of [a, b]) {
    await expect(p.getByRole('timer')).toHaveAccessibleName(/en pausa/);
    await expect(barra(p)).toContainText('El reloj está en pausa.');
  }
  // Reanudar: B lo propone, A retira y vuelve a aceptar.
  await barra(b).getByRole('button', { name: 'Reanudar' }).click();
  await expect(barra(a)).toContainText('Búho propone reanudar el reloj.');
  await barra(b).getByRole('button', { name: 'Retirar mi voto' }).click();
  await expect(barra(a)).not.toContainText('propone reanudar');
  await barra(b).getByRole('button', { name: 'Reanudar' }).click();
  await barra(a).getByRole('button', { name: 'Aceptar' }).click();
  for (const p of [a, b]) {
    await expect(p.getByRole('timer')).not.toHaveAccessibleName(/en pausa/);
  }
});
