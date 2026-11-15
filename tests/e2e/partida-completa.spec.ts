import { expect, test, type Page } from '@playwright/test';
import type { Caja } from './escena';
import {
  cruzar,
  empezarDesdeElMenu,
  recoger,
  resolverMaquina,
  usar,
  volverALaEntrada,
} from './recorrido';

// T77: la partida individual de punta a punta, como la juega un estudiante. Se empieza en el
// menú con «Jugar solo», sin ninguna partida guardada puesta a mano: se camina por la portería,
// se entra a cada sala por su puerta y cada máquina se resuelve desde su panel con el campo
// `solucion` de su JSON.

const SALAS = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
] as const;
type SalaId = (typeof SALAS)[number];

/** El escondite de la grabación de cada sala que tiene una (salas 2, 3 y 4). */
const ESCONDITES: Partial<Record<SalaId, string>> = {
  's2-laboratorio': 's2-gabinete',
  's3-gimnasio': 's3-balon-3',
  's4-biblioteca': 's4-libro-m',
};

const prefijo = (sala: SalaId): string => sala.slice(0, 2);
const sellos = (page: Page, n: number) => page.getByRole('img', { name: `Sellos: ${n} de 5` });

/** Desde la portería: entra a la sala por su puerta. */
async function entrar(page: Page, caja: Caja, conDedo: boolean, sala: SalaId): Promise<void> {
  await cruzar(page, caja, conDedo, `porteria-puerta-${SALAS.indexOf(sala) + 1}`);
}

/** Desde cualquier punto de la sala: vuelve a la entrada y sale a la portería. */
async function salir(page: Page, caja: Caja, conDedo: boolean, sala: SalaId): Promise<void> {
  await volverALaEntrada(page, caja, conDedo, sala);
  await cruzar(page, caja, conDedo, `${prefijo(sala)}-puerta`);
}

/** Estando en la sala: usa el escondite y lee la grabación. `llevas` cuenta esta. */
async function recogerGrabacion(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  sala: SalaId,
  llevas: number,
): Promise<void> {
  const escondite = ESCONDITES[sala];
  if (!escondite) throw new Error(`${sala} no esconde ninguna grabación`);
  await usar(page, caja, conDedo, escondite, { cerca: 1.9 });
  const panel = page.getByRole('dialog', { name: 'Encontraste una grabación' });
  await expect(panel).toContainText(`Grabación ${SALAS.indexOf(sala)} de 3`);
  await expect(panel).toContainText(
    llevas === 3 ? 'Ya tienes las tres grabaciones' : `Llevas ${llevas} de 3 grabaciones`,
  );
  await panel.getByRole('button', { name: 'Seguir' }).click();
  await expect(panel).toHaveCount(0);
}

/** Entra a la sala, resuelve su máquina y vuelve a la portería con el sello. */
async function ganarSello(page: Page, caja: Caja, conDedo: boolean, sala: SalaId): Promise<void> {
  const numero = SALAS.indexOf(sala) + 1;
  await entrar(page, caja, conDedo, sala);
  await resolverMaquina(page, caja, conDedo, numero);
  await salir(page, caja, conDedo, sala);
  await expect(sellos(page, numero)).toBeVisible();
}

/** En la portería: camina hasta la puerta de salida y la usa. */
async function abrirLaSalida(page: Page, caja: Caja, conDedo: boolean) {
  await usar(page, caja, conDedo, 'porteria-salida');
  const salida = page.getByRole('dialog', { name: 'Puerta de salida' });
  await expect(salida).toBeVisible();
  return salida;
}

test('partida completa desde el menú: cinco máquinas, cinco sellos y «Justo a tiempo»', async ({
  page,
}, info) => {
  // Cinco salas caminadas y quince etapas, con el WebGL dibujado por la CPU.
  test.setTimeout(12 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const caja = await empezarDesdeElMenu(page);
  await expect(sellos(page, 0)).toBeVisible();

  for (const sala of SALAS) await ganarSello(page, caja, conDedo, sala);

  // Con los cinco sellos en el mural, la puerta de salida deja elegir cómo termina la noche.
  const salida = await abrirLaSalida(page, caja, conDedo);
  await expect(salida).toContainText('Los cinco sellos están en el mural');
  // Sin grabaciones, «Restaurar archivo» no se puede elegir y dice dónde queda cada una.
  await expect(salida.getByRole('button', { name: 'Restaurar archivo' })).toBeDisabled();
  await expect(salida).toContainText('Faltan 3 grabaciones');
  await expect(salida).toContainText('El laboratorio, El gimnasio y La biblioteca');

  await salida.getByRole('button', { name: 'Salir', exact: true }).click();
  // Faltan las tres grabaciones: la puerta pide confirmar antes de terminar.
  await salida.getByRole('button', { name: 'Salir de todos modos' }).click();
  const titulo = page.getByRole('heading', { level: 1, name: 'Justo a tiempo' });
  await expect(titulo).toBeFocused();
  await expect(page.getByRole('timer')).toHaveCount(0);
  const resumen = page.locator('.final-resumen');
  await expect(resumen).toContainText('5 de 5');
  await expect(resumen).toContainText('0 de 3');

  // Un final cierra la partida: en el menú ya no hay nada que continuar.
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
});

test('partida completa con las tres grabaciones: «Restaurar archivo» lleva a «El legado»', async ({
  page,
}, info) => {
  // Es la prueba más larga de la suite (más de 3 minutos) y lo que cambia frente a la anterior
  // (grabaciones y «Restaurar archivo») no depende del ratón: en escritorio, recoger cada
  // grabación ya se prueba en `grabaciones.spec.ts` y el final, en `finales.spec.ts`.
  test.skip(info.project.name === 'escritorio', 'La partida larga se juega en el perfil celular');
  test.setTimeout(15 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  const caja = await empezarDesdeElMenu(page);

  // El cuaderno y la linterna se recogen en la portería antes de entrar a la primera sala.
  await recoger(page, caja, conDedo, 'porteria-cuaderno');
  await expect(page.getByRole('button', { name: 'Cuaderno', exact: true })).toBeVisible();
  await recoger(page, caja, conDedo, 'porteria-linterna');
  await expect(page.getByRole('list', { name: 'Inventario' })).toContainText('Linterna');

  await ganarSello(page, caja, conDedo, 's1-cooperativa');

  // Sala 2: con la linterna se ven las flechas, y la grabación se recoge de paso.
  await entrar(page, caja, conDedo, 's2-laboratorio');
  await expect(canvas).toHaveAttribute('data-detalle', 'flechas');
  await recogerGrabacion(page, caja, conDedo, 's2-laboratorio', 1);
  await volverALaEntrada(page, caja, conDedo, 's2-laboratorio');
  await resolverMaquina(page, caja, conDedo, 2);
  await salir(page, caja, conDedo, 's2-laboratorio');

  for (const sala of ['s3-gimnasio', 's4-biblioteca', 's5-rectoria'] as const) {
    await ganarSello(page, caja, conDedo, sala);
  }

  // Con cinco sellos y una sola grabación, la puerta dice cuántas faltan y en qué salas.
  let salida = await abrirLaSalida(page, caja, conDedo);
  await expect(salida.getByRole('button', { name: 'Restaurar archivo' })).toBeDisabled();
  await expect(salida).toContainText('Faltan 2 grabaciones');
  await expect(salida).toContainText('El gimnasio y La biblioteca');
  await salida.getByRole('button', { name: 'Volver' }).click();
  await expect(salida).toHaveCount(0);

  // Se vuelve por ellas a dos salas ya resueltas (T76): el sello y el avance no cambian.
  await entrar(page, caja, conDedo, 's3-gimnasio');
  await recogerGrabacion(page, caja, conDedo, 's3-gimnasio', 2);
  await salir(page, caja, conDedo, 's3-gimnasio');
  await entrar(page, caja, conDedo, 's4-biblioteca');
  await expect(canvas).toHaveAttribute('data-maquina', 'lamparas-4');
  await recogerGrabacion(page, caja, conDedo, 's4-biblioteca', 3);
  await salir(page, caja, conDedo, 's4-biblioteca');
  await expect(sellos(page, 5)).toBeVisible();

  // Las tres quedaron en el cuaderno.
  await page.getByRole('button', { name: 'Cuaderno', exact: true }).click();
  const cuaderno = page.getByRole('dialog', { name: 'Tu cuaderno' });
  const grabaciones = cuaderno.getByRole('region', { name: 'Grabaciones' });
  for (const n of [1, 2, 3]) await expect(grabaciones).toContainText(`Grabación ${n} de 3`);
  await cuaderno.getByRole('button', { name: 'Cerrar' }).click();

  salida = await abrirLaSalida(page, caja, conDedo);
  await expect(salida).toContainText('Con las tres grabaciones puedes restaurar el archivo');
  await salida.getByRole('button', { name: 'Restaurar archivo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'El legado' })).toBeFocused();
  const resumen = page.locator('.final-resumen');
  await expect(resumen).toContainText('5 de 5');
  await expect(resumen).toContainText('3 de 3');

  await page.getByRole('button', { name: 'Ver créditos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La Última Prueba' })).toBeFocused();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La fotocopiadora' })).toBeFocused();
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
});

test('a mitad de partida, con un sello, el intercomunicador lleva a «También vale pedir ayuda»', async ({
  page,
}, info) => {
  test.setTimeout(5 * 60_000);
  const conDedo = info.project.use.hasTouch === true;
  const caja = await empezarDesdeElMenu(page);
  await ganarSello(page, caja, conDedo, 's1-cooperativa');

  // La puerta de salida todavía no deja elegir: dice cuántos sellos faltan.
  const salida = await abrirLaSalida(page, caja, conDedo);
  await expect(salida).toContainText('En el mural faltan 4 sellos.');
  await expect(salida.getByRole('button', { name: 'Salir' })).toHaveCount(0);
  await salida.getByRole('button', { name: 'Volver' }).click();

  await usar(page, caja, conDedo, 'porteria-intercomunicador');
  const ayuda = page.getByRole('dialog', { name: 'Intercomunicador de emergencia' });
  await ayuda.getByRole('button', { name: 'Pedir ayuda' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'También vale pedir ayuda' }),
  ).toBeFocused();
  // El resumen cuenta lo que se alcanzó a hacer.
  await expect(page.locator('.final-resumen')).toContainText('1 de 5');
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('una partida nueva termina en «Tiempo cumplido» cuando pasan los 40 minutos', async ({
  page,
}) => {
  // El reloj del navegador es de mentiras: los 40 minutos pasan de un salto.
  await page.clock.install();
  await empezarDesdeElMenu(page);
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^Tiempo restante: (40|39)/);

  await page.clock.fastForward('39:00');
  // Queda 1 minuto, o unos segundos menos si el equipo tardó en llegar hasta aquí.
  await expect(page.getByRole('timer')).toHaveAttribute(
    'aria-label',
    /^Tiempo restante: (1 minuto|\d+ segundos?)$/,
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Partida en curso');

  await page.clock.fastForward('01:05');
  const titulo = page.getByRole('heading', { level: 1, name: 'Tiempo cumplido' });
  await expect(titulo).toBeFocused();
  await expect(page.locator('.final-resumen')).toContainText('0 de 5');
  await expect(page.locator('.final-resumen')).toContainText('40:00');
  await expect(page.getByRole('timer')).toHaveCount(0);
});
