import { expect, test, type Page } from '@playwright/test';
import { barra, empezarCoop } from './coop';
import type { Caja } from './escena';
import {
  cruzar,
  MAQUINAS,
  objetoDeEtapa,
  puzzleDeSala,
  resolverEtapa,
  salaPorId,
  textoSeguir,
  usar,
  volverALaEntrada,
} from './recorrido';

// Pasillos (sesión B): el cooperativo por el pasillo en U de la portería (docs/pasillos.md),
// con dos pestañas y el transporte de prueba. El grupo camina por el pasillo, entra a cada sala
// por votación, quien tiene el encargo D propone en la máquina y el otro acepta, vuelve al
// pasillo frente a la puerta de la sala y sigue a la siguiente. Con los cinco sellos, Jaguar
// abre la puerta de salida, propone «Salir» y Búho acepta: las dos pestañas ven «Justo a tiempo».

const SALAS_EN_GRUPO = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;

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

test('dos jugadores recorren el pasillo, juegan las cinco salas y salen por votación', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'escritorio', 'El cooperativo completo se juega en celular');
  // Dos pestañas y quince etapas con el WebGL dibujado por la CPU.
  test.setTimeout(40 * 60_000);
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
    const porEstaciones = MAQUINAS[puzzle.mecanismo].porEtapa !== undefined;
    const cajaD = cajas.get(d);
    if (!cajaD) throw new Error('sin canvas');
    const panelD = d.getByRole('dialog', { name: puzzle.titulo });
    const panelOtro = otro.getByRole('dialog', { name: puzzle.titulo });
    for (let n = 0; n < puzzle.etapas.length; n++) {
      // En la sala 2 cada etapa se abre en su estación (corrección del 25 de noviembre).
      if (n === 0 || porEstaciones) {
        const { objeto, ...alcance } = objetoDeEtapa(puzzle, n);
        await usar(d, cajaD, conDedo, objeto, alcance);
      }
      const aceptar = async (): Promise<void> => {
        if (n === 0 || porEstaciones) {
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
      await panelOtro.getByRole('button', { name: textoSeguir(puzzle, n), exact: true }).click();
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

  // Con los cinco sellos, Jaguar elige «Salir» en la puerta de salida y Búho acepta el voto.
  await usar(a, cajaA, conDedo, 'porteria-salida');
  const salida = a.getByRole('dialog', { name: 'Puerta de salida' });
  await expect(salida).toContainText('Los cinco sellos están en el mural');
  await salida.getByRole('button', { name: 'Salir', exact: true }).click();
  // Faltan las tres grabaciones: la puerta pide confirmar antes de proponer.
  await salida.getByRole('button', { name: 'Salir de todos modos' }).click();
  await aceptarVoto(b, 'Jaguar propone salir del colegio');
  for (const p of [a, b]) {
    await expect(p.getByRole('heading', { level: 1, name: 'Justo a tiempo' })).toBeVisible({
      timeout: 60_000,
    });
  }
});
