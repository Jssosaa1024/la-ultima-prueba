import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import type { Caja } from './escena';
import { cruzar, puzzleDeSala, resolverEtapa, usar } from './recorrido';

// T91 y el cooperativo de punta a punta en la sala 1, con dos pestañas y el transporte de
// prueba: entrar por votación, cada uno con sus encargos, D propone en la etiquetadora, el
// otro acepta y la máquina responde; frases rápidas entre los dos.

async function cajaDe(p: Page): Promise<Caja> {
  const canvas = p.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

test('dos jugadores resuelven la sala 1 en cooperativo', async ({ page, context }, info) => {
  // Dos pestañas con WebGL por la CPU: se juega en el perfil celular, como el estudiante.
  test.skip(info.project.name === 'escritorio', 'El cooperativo completo se juega en celular');
  test.setTimeout(8 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const [cajaA, cajaB] = [await cajaDe(a), await cajaDe(b)];

  // Jaguar cruza la puerta 1: abre el voto; con el de Búho, el grupo entra.
  await Promise.all([
    cruzar(a, cajaA, conDedo, 'porteria-puerta-1'),
    (async () => {
      // Llega cuando Jaguar termina de caminar hasta la puerta: puede tardar.
      await expect(barra(b)).toContainText('Jaguar propone ir a La cooperativa', {
        timeout: 120_000,
      });
      await barra(b).getByRole('button', { name: 'Aceptar' }).click();
    })(),
  ]);
  await expect(b.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 's1-cooperativa');

  // Con dos jugadores, en la sala 1 Jaguar tiene A y B; Búho, C y D.
  await expect(barra(a).getByRole('button', { name: 'Tus encargos: A y B' })).toBeVisible();
  await expect(barra(b).getByRole('button', { name: 'Tus encargos: C y D' })).toBeVisible();

  // Frases rápidas: solo ids de una lista; el texto lo pone cada pestaña.
  await barra(b).getByRole('button', { name: 'Frases' }).click();
  await barra(b).getByRole('button', { name: '¡Aquí!' }).click();
  await expect(barra(a)).toContainText('Búho: ¡Aquí!');
  await barra(b).getByRole('button', { name: 'Frases' }).click();

  // Búho (D) abre la etiquetadora y propone; Jaguar acepta cada etapa.
  const puzzle = puzzleDeSala(1);
  await usar(b, cajaB, conDedo, 's1-etiquetadora');
  const panelB = b.getByRole('dialog', { name: puzzle.titulo });
  const panelA = a.getByRole('dialog', { name: puzzle.titulo });
  await expect(panelB).toContainText('Tienes el encargo D');
  for (let n = 0; n < puzzle.etapas.length; n++) {
    const ultima = n === puzzle.etapas.length - 1;
    const aceptar = async (): Promise<void> => {
      if (n === 0) {
        await barra(a).getByRole('button', { name: 'Ver propuesta' }).click({ timeout: 120_000 });
        await expect(panelA).toContainText('Búho propone estos ajustes');
      }
      await panelA.getByRole('button', { name: 'Aceptar', exact: true }).click({ timeout: 60_000 });
    };
    const [seguir] = await Promise.all([resolverEtapa(panelB, puzzle, n), aceptar()]);
    await seguir.click();
    await panelA
      .getByRole('button', { name: ultima ? 'Volver a la sala' : 'Seguir', exact: true })
      .click();
  }
  for (const p of [a, b]) {
    await expect(p.getByRole('img', { name: 'Sellos: 1 de 5' })).toBeVisible();
  }
});
