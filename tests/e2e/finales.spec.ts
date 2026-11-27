import { expect, test, type Page } from '@playwright/test';
import { caminarHasta, continuarEn, type Caja } from './escena';
import { tocar } from './toque';

// T40: pantallas de final, créditos y poscréditos, llegando a cada final como en el juego.
// «También vale pedir ayuda» se prueba con el intercomunicador en `partida.spec.ts`.

const TRES_GRABACIONES = ['grab-1', 'grab-2', 'grab-3'];

/** Camina hasta el fondo de la portería y usa la puerta de salida. */
async function abrirLaPuertaDeSalida(page: Page, caja: Caja, conDedo: boolean): Promise<void> {
  // La pared del fondo está en z = −5: el jugador se detiene contra ella en −4,7.
  await caminarHasta(page, caja, conDedo, (_x, z) => z <= -4.5);
  const usar = page.getByRole('button', { name: /Usar.*Puerta de salida/ });
  // El centro de la pantalla apunta a la puerta, a 30 cm. En celular, si un toque no enfoca
  // (equipo cargado), se repite.
  const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  for (let intento = 0; intento < 4; intento++) {
    await tocar(page, centro, conDedo);
    const aparecio = await usar
      .waitFor({ timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (aparecio || !conDedo) break;
  }
  await usar.click();
}

test('con los cinco sellos, «Salir» lleva al final «Justo a tiempo»', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, { sala: 's5-rectoria', etapas: 3, lugar: 'porteria' });
  await expect(page.getByRole('img', { name: 'Sellos: 5 de 5' })).toBeVisible();
  await abrirLaPuertaDeSalida(page, caja, conDedo);

  const salida = page.getByRole('dialog', { name: 'Puerta de salida' });
  await expect(salida).toContainText('Los cinco sellos están en el mural');
  // Sin las grabaciones, «Restaurar archivo» está desactivado y dice cuántas faltan y dónde.
  await expect(salida.getByRole('button', { name: 'Restaurar archivo' })).toBeDisabled();
  await expect(salida).toContainText('Faltan 3 grabaciones');
  await expect(salida).toContainText('El laboratorio, El gimnasio y La biblioteca');

  // Con grabaciones pendientes, «Salir» pide confirmar (hito 1, punto 2). «Seguir buscando»
  // vuelve a las dos opciones sin terminar la partida.
  await salida.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(salida).toContainText('Todavía faltan 3 grabaciones');
  await expect(salida).toBeFocused();
  await salida.getByRole('button', { name: 'Seguir buscando' }).click();
  await expect(salida.getByRole('button', { name: 'Restaurar archivo' })).toBeVisible();
  await salida.getByRole('button', { name: 'Salir', exact: true }).click();
  await salida.getByRole('button', { name: 'Salir de todos modos' }).click();
  const encabezado = page.getByRole('heading', { level: 1, name: 'Justo a tiempo' });
  await expect(encabezado).toBeVisible();
  await expect(encabezado).toBeFocused();
  await expect(page.getByRole('timer')).toHaveCount(0);
  // Historia · sesión C: el acta de la noche lleva la foto vieja, sin el nombre del estudiante.
  await expect(page.getByText(/Cerrada a las \d\d:\d\d/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Foto vieja en blanco y negro/ })).toBeVisible();
  await expect(page.getByText(/Cárdenas/)).toHaveCount(0);
  // Resumen de aprendizaje (punto 15 del hito 1): las cinco salas, cómo terminó cada una y
  // cómo funcionaba su máquina. La partida de prueba no abrió pistas.
  // La línea de La Voz de este final (T34).
  await expect(page.locator('.final-voz')).toContainText('La Voz: Ahí está tu memoria.');
  const resumen = page.getByRole('region', { name: 'Lo que aprendiste esta noche' });
  await expect(resumen).toContainText('Resolviste 5 de 5 salas, todas sin pistas.');
  await expect(resumen.getByRole('listitem')).toHaveCount(5);
  await expect(resumen).toContainText('Sala 1 · Porcentajes');
  await expect(resumen).toContainText('Sala 5 · Probabilidad');
  await expect(resumen).toContainText('La etiquetadora');
});

test('con los sellos y las tres grabaciones, «Restaurar archivo» lleva a «El legado», y de ahí a los créditos', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const caja = await continuarEn(page, {
    sala: 's5-rectoria',
    etapas: 3,
    lugar: 'porteria',
    grabaciones: TRES_GRABACIONES,
  });
  await abrirLaPuertaDeSalida(page, caja, conDedo);

  const salida = page.getByRole('dialog', { name: 'Puerta de salida' });
  await salida.getByRole('button', { name: 'Restaurar archivo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'El legado' })).toBeFocused();
  await expect(page.getByText('5 de 5', { exact: true })).toBeVisible();
  await expect(page.getByText('3 de 3', { exact: true })).toBeVisible();
  // Historia · sesión C: en «El legado» la foto de la feria muestra el cartel con su nombre.
  await expect(page.getByRole('img', { name: /«Efraín Cárdenas, 10-B»/ })).toBeVisible();

  await page.getByRole('button', { name: 'Ver créditos' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La Última Prueba' })).toBeFocused();
  await expect(page.getByText(/tenía la llave desde el principio/)).toBeVisible();
  // Historia B: los créditos cuentan el caso de 1991; con el archivo restaurado, se reabre.
  await expect(page.getByRole('heading', { name: /Expediente 1991-14/ })).toBeVisible();
  await expect(page.getByText('Efraín Cárdenas.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Reabierto esta noche/)).toBeVisible();
  // Historia · sesión C: los cinco folios del expediente, todos revisados y en el pendrive.
  await expect(page.getByText('Revisado · en el pendrive')).toHaveCount(5);
  // Correcciones del 25 nov: al final de los créditos, «Un proyecto de» con el logo de Sinapsis.
  await expect(page.getByRole('img', { name: 'Sinapsis' })).toBeVisible();

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La fotocopiadora' })).toBeVisible();
  await expect(page.getByText(/Pregunta 6/)).toBeVisible();

  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(page.getByRole('button', { name: 'Jugar solo' })).toBeVisible();
  // Un final borra la partida guardada: ya no hay nada que continuar.
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
});

test('cuando se acaba el reloj aparece «Tiempo cumplido»', async ({ page }) => {
  // A la partida guardada le quedan dos segundos.
  await continuarEn(page, { sala: 's1-cooperativa', restanteMs: 2000 });
  const encabezado = page.getByRole('heading', { level: 1, name: 'Tiempo cumplido' });
  await expect(encabezado).toBeVisible();
  await expect(encabezado).toBeFocused();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByText('Cerrada a las 00:40')).toBeVisible();
  // Ningún final castiga: también se explican las salas que faltaron, sin prometer un modo
  // práctica que no existe.
  const resumen = page.getByRole('region', { name: 'Lo que aprendiste esta noche' });
  await expect(resumen).toContainText('Esta vez no alcanzaste a resolver ninguna sala.');
  await expect(resumen.getByText('Sin resolver')).toHaveCount(5);
  await expect(page.getByText(/práctica/i)).toHaveCount(0);
});
