import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { caminarHasta, continuarEn, mirarHacia, tocarObjeto, type Punto3 } from './escena';

// T52: los tanques de la sala 2, de punta a punta. Las corridas duran lo que tarda la campana
// de cada etapa (10, 8 y 12 segundos), en tiempo real.

// El WebGL de las pruebas se dibuja con la CPU, y las corridas suman casi un minuto.
test.slow();

/** El tablero de los tanques: el mueble con las perillas y la palanca. Su cara mira a la puerta. */
const TABLERO: Punto3 = [-1.3, 0.55, -0.85];
/** Lo que se espera a que suene la campana más larga, con el equipo ocupado. */
const HASTA_LA_CAMPANA = { timeout: 40_000 };

interface Opciones {
  etapas?: number;
  inventario?: readonly string[];
}

async function abrirTanques(page: Page, conDedo: boolean, opciones: Opciones = {}) {
  const caja = await continuarEn(page, { sala: 's2-laboratorio', ...opciones });
  // Desde la puerta, el tablero queda a más de 3 m: hay que acercarse. Se camina hacia él, así
  // que si la prueba tarda en soltar el joystick, el propio tablero detiene al jugador.
  await mirarHacia(page, caja, TABLERO, conDedo);
  await caminarHasta(page, caja, conDedo, (_x, z) => z < 0.9);
  const usar = page.getByRole('button', { name: /Usar.*Tablero de los tanques/ });
  const panel = page.getByRole('dialog', { name: 'Los tanques y el graficador' });
  // Con el equipo ocupado, el botón puede cambiar entre que aparece y el toque: se repite.
  for (let intento = 0; intento < 3 && !(await panel.isVisible()); intento++) {
    await tocarObjeto(page, caja, TABLERO, conDedo, /Usar.*Tablero de los tanques/);
    await usar.click({ timeout: 5000 }).catch(() => undefined);
    await panel.waitFor({ timeout: 10_000 }).catch(() => undefined);
  }
  await expect(panel).toBeVisible();
  return panel;
}

/** Sube el caudal de A, de a un toque, hasta `caudal` cm/s. */
async function ponerCaudal(panel: Locator, caudal: number): Promise<void> {
  const mas = panel.getByRole('button', { name: 'Más: Perilla verde: caudal del tanque A' });
  const valor = panel.locator('.pasos-valor');
  for (let i = 0; i < 6 && (await valor.textContent()) !== `${caudal} cm/s`; i++) await mas.click();
  await expect(valor).toHaveText(`${caudal} cm/s`);
}

test('las tres etapas de los tanques dan el sello de la sala 2', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  // La hoja de ayer ya está recogida: sus marcas deben salir en el graficador de la etapa 3.
  const panel = await abrirTanques(page, conDedo, { inventario: ['s2-hoja-ayer'] });
  const palanca = panel.getByRole('button', { name: 'Bajar la palanca' });
  const respuesta = panel.locator('.respuesta');
  const seguir = panel.getByRole('button', { name: 'Seguir' });

  // Etapa 1 · A debe llegar a la línea roja de 30 cm a los 10 s.
  await expect(panel).toContainText('Sala 2 · Etapa 1 de 3');
  await expect(panel).toContainText('La campana suena a los 10 segundos.');
  await expect(panel.locator('.tanque')).toHaveCount(1);
  await ponerCaudal(panel, 2);
  await palanca.click();
  // Correcciones del 25 nov: mientras corre, el panel se recoge a su pestaña y la corrida se ve
  // en los tanques 3D. La máquina aún no dice nada ni deja mover la perilla.
  await expect(page.getByRole('button', { name: 'Mostrar los controles' })).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(canvas).toHaveAttribute('data-maquina', 'corriendo');
  const oculto = page.locator('.dialogo-recogido');
  await expect(oculto).toContainText('Corriendo:');
  await expect(oculto.locator('.respuesta')).toHaveCount(0);
  await expect(oculto.locator('.pasos-boton').last()).toBeDisabled();
  // Al sonar la campana, la máquina muestra lo que pasó, sin decir «incorrecto».
  await expect(respuesta).toContainText('el tanque A estaba en 20 cm', HASTA_LA_CAMPANA);
  await expect(respuesta).toContainText('La línea roja está en 30 cm.');
  await expect(panel).not.toContainText(/incorrect/i);
  // Los tanques se vacían, vuelve la palanca y el trazo queda en el papel, más tenue.
  await expect(palanca).toBeVisible();
  await expect(panel.locator('.trazos-anteriores .trazo-a')).toHaveCount(1);
  await expect(panel).toContainText('Sala 2 · Etapa 1 de 3');

  await ponerCaudal(panel, 3);
  await palanca.click();
  await expect(respuesta).toContainText('estaba en 30 cm', HASTA_LA_CAMPANA);
  await expect(respuesta).toContainText('Justo en la línea roja.');
  await seguir.click();

  // Etapa 2 · B baja 2 cm/s desde 50 cm; A sube desde 10 cm. Se cruzan en 34 cm a los 8 s.
  await expect(panel).toContainText('Sala 2 · Etapa 2 de 3');
  await expect(panel.locator('.tanque')).toHaveCount(2);
  await expect(panel).toContainText('El tanque B empieza en 50 cm y baja 2 cm cada segundo.');
  // Papel nuevo: no queda el trazo de la etapa anterior.
  await expect(panel.locator('.trazo')).toHaveCount(0);
  await ponerCaudal(panel, 3);
  await palanca.click();
  await expect(respuesta).toContainText(
    'los tanques A y B estaban en 34 cm: a la misma altura',
    HASTA_LA_CAMPANA,
  );
  await seguir.click();

  // Etapa 3 · B está tapado; la hoja de ayer da dos marcas. Se cruzan en 24 cm a los 12 s.
  await expect(panel).toContainText('Sala 2 · Etapa 3 de 3');
  await expect(panel).toContainText('tapado con cinta');
  await expect(panel.locator('.marca-ayer')).toHaveCount(2);
  await ponerCaudal(panel, 2);
  await palanca.click();
  await expect(respuesta).toContainText('el tanque A estaba en 24 cm', HASTA_LA_CAMPANA);
  // El tanque tapado no se dibuja.
  await expect(panel.locator('.trazo-b')).toHaveCount(0);
  await expect(respuesta).toContainText('La incubadora se abrió.');
  await expect(panel).toContainText('Conseguiste el sello de esta sala');

  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Sellos: 2 de 5' })).toBeVisible();
  await expect(canvas).toHaveAttribute('data-maquina', 'incubadora-abierta');
});

test('sin la hoja de ayer, el graficador de la etapa 3 no tiene marcas', async ({ page }, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const panel = await abrirTanques(page, conDedo, { etapas: 2 });
  await expect(panel).toContainText('Sala 2 · Etapa 3 de 3');
  await expect(panel).toContainText('tapado con cinta');
  await expect(panel.locator('.marca-ayer')).toHaveCount(0);
  // El nivel y el caudal de B no se dicen en ninguna parte.
  await expect(panel).not.toContainText('48 cm');
  await expect(panel).not.toContainText('baja 2 cm');
});
