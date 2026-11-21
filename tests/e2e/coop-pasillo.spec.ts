import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import type { Caja } from './escena';
import {
  cruzar,
  MAQUINAS,
  puzzleDeSala,
  resolverEtapa,
  salaPorId,
  usar,
  volverALaEntrada,
} from './recorrido';

// Pasillos (sesión B): el cooperativo por el pasillo en U de la portería (docs/pasillos.md),
// con dos pestañas y el transporte de prueba. El grupo camina por el pasillo, entra a cada sala
// por votación, quien tiene el encargo D propone en la máquina y el otro acepta, vuelve al
// pasillo frente a la puerta de la sala y sigue a la siguiente.
//
// Por ahora juega las salas 1 y 2 y llega a la puerta 3: en grupo, el panel del reflector de
// quien tiene D desaparece en la etapa 2 y la propuesta no llega (lógica del anfitrión probada
// en unidad: resuelve las tres etapas). Ese fallo no es del pasillo y queda para su propia tarea
// (docs/reportes/pasillos-sesion-B.md). Cuando se arregle, `SALAS_EN_GRUPO` pasa a las cinco y
// la prueba termina eligiendo el final por votación.

const SALAS_EN_GRUPO = ['s1-cooperativa', 's2-laboratorio'] as const;

async function cajaDe(p: Page): Promise<Caja> {
  const canvas = p.getByLabel('Escena del juego');
  await expect(canvas).toHaveAttribute('data-mirada', /,/, { timeout: 30_000 });
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

/** Acepta el voto que abrió la otra pestaña («… propone …»). */
async function aceptarVoto(p: Page, texto: string): Promise<void> {
  await expect(barra(p)).toContainText(texto, { timeout: 60_000 });
  await barra(p).getByRole('button', { name: 'Aceptar' }).click();
}

/** Quién tiene el encargo D en la sala actual, y quién no. */
async function quienTieneD(a: Page, b: Page): Promise<[Page, Page]> {
  const encargos = barra(a).getByRole('button', { name: /^Tus? encargos?:/ });
  await expect(encargos).toBeVisible({ timeout: 30_000 });
  const texto = (await encargos.textContent()) ?? '';
  return /\bD\b/.test(texto) ? [a, b] : [b, a];
}

test('dos jugadores recorren el pasillo y juegan las salas en grupo', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo completo se juega en celular');
  // Dos pestañas y seis etapas con el WebGL dibujado por la CPU.
  test.setTimeout(15 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const { a, b } = await empezarCoop(context, page);
  const cajaA = await cajaDe(a);
  const cajas = new Map<Page, Caja>([
    [a, cajaA],
    [b, await cajaDe(b)],
  ]);

  for (const [i, sala] of SALAS_EN_GRUPO.entries()) {
    // Jaguar camina por el pasillo hasta la puerta y Búho acepta el voto.
    await cruzar(a, cajaA, conDedo, `porteria-puerta-${i + 1}`, () =>
      aceptarVoto(b, `Jaguar propone ir a ${salaPorId(sala).nombre}`),
    );
    await expect(b.getByLabel('Escena del juego')).toHaveAttribute('data-sala', sala);

    // Quien tiene D abre la máquina y propone cada etapa; el otro acepta.
    const [d, otro] = await quienTieneD(a, b);
    const puzzle = puzzleDeSala(i + 1);
    const { objeto, ...alcance } = MAQUINAS[puzzle.mecanismo];
    const cajaD = cajas.get(d);
    if (!cajaD) throw new Error('sin canvas');
    await usar(d, cajaD, conDedo, objeto, alcance);
    const panelD = d.getByRole('dialog', { name: puzzle.titulo });
    const panelOtro = otro.getByRole('dialog', { name: puzzle.titulo });
    for (let n = 0; n < puzzle.etapas.length; n++) {
      const ultima = n === puzzle.etapas.length - 1;
      const aceptar = async (): Promise<void> => {
        if (n === 0) {
          await barra(otro)
            .getByRole('button', { name: 'Ver propuesta' })
            .click({ timeout: 120_000 });
        }
        await panelOtro
          .getByRole('button', { name: 'Aceptar', exact: true })
          .click({ timeout: 90_000 });
      };
      const [seguir] = await Promise.all([resolverEtapa(panelD, puzzle, n, true), aceptar()]);
      await seguir.click();
      await panelOtro
        .getByRole('button', { name: ultima ? 'Volver a la sala' : 'Seguir', exact: true })
        .click();
    }
    for (const p of [a, b]) {
      await expect(p.getByRole('img', { name: `Sellos: ${i + 1} de 5` })).toBeVisible();
    }

    // De vuelta al pasillo: Jaguar va a la puerta de la sala, Búho acepta, y los dos aparecen
    // en el pasillo frente a ella (`cruzar` revisa la posición de Jaguar).
    await volverALaEntrada(a, cajaA, conDedo, sala);
    await cruzar(a, cajaA, conDedo, `${sala.slice(0, 2)}-puerta`, () =>
      aceptarVoto(b, `Jaguar propone ir a ${salaPorId('porteria').nombre}`),
    );
    await expect(b.getByLabel('Escena del juego')).toHaveAttribute('data-sala', 'porteria');
  }

  // Con dos sellos, la puerta 3 (al fondo del tramo 2) ya abre el voto para el gimnasio.
  await usar(a, cajaA, conDedo, 'porteria-puerta-3');
  await expect(barra(b)).toContainText(`Jaguar propone ir a ${salaPorId('s3-gimnasio').nombre}`, {
    timeout: 60_000,
  });
});
