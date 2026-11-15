import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { continuarEn, tocarObjeto, type Punto3 } from './escena';
import { caminarHasta } from './maquinas';

// T64: sala 4, los carritos de préstamo. Se entra con una partida guardada en la biblioteca,
// se camina hasta los carritos y se abre el panel tocando uno, como haría un jugador.

// El WebGL de las pruebas se dibuja con la CPU: todo tarda más que en un teléfono real.
test.slow();

/** El carrito del martes, visto desde donde el carrito del jueves detiene al jugador. */
const CARRITO: Punto3 = [-2.1, 0.5, -1.2];

async function abrirCarritos(
  page: Page,
  conDedo: boolean,
  etapas: number,
  carritos: number[],
): Promise<Locator> {
  const caja = await continuarEn(page, {
    sala: 's4-biblioteca',
    etapas,
    ajustes: { carritos },
  });
  // De frente desde la puerta hasta que la fila de carritos (z = −1,2) detenga al jugador.
  await caminarHasta(page, caja, conDedo, (_x, z) => z <= -0.55);
  await tocarObjeto(page, caja, CARRITO, conDedo, /Usar.*Carritos de préstamo/);
  await page.getByRole('button', { name: /Usar.*Carritos de préstamo/ }).click();
  const panel = page.getByRole('dialog', { name: 'Los carritos de préstamo' });
  await expect(panel).toBeVisible();
  return panel;
}

const lugar = (panel: Locator, nombre: string): Locator =>
  panel.getByRole('button', { name: new RegExp(`^${nombre}:`) });

test('presentar: mover un libro entre carritos no apaga MEDIA, y la etapa se resuelve sola', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  const canvas = page.getByLabel('Escena del juego');
  // Los 20 libros ya están repartidos, disparejos. La máquina solo empieza a contar su reposo
  // con el primer cambio, así que la prueba no tiene que ganarle al reloj.
  const panel = await abrirCarritos(page, conDedo, 0, [5, 4, 4, 4, 3]);

  await expect(panel).toContainText('Sala 4 · Etapa 1 de 3');
  // La lámpara responde en vivo, y en la biblioteca se ve una en verde.
  await expect(panel).toContainText('MEDIA 4: encendido');
  await expect(panel).toContainText('MEDIANA 3 · tapada');
  await expect(canvas).toHaveAttribute('data-maquina', 'lamparas-1');
  // Sin libros en la pila, primero hay que elegir de qué carrito sale el libro.
  await expect(lugar(panel, 'Pila')).toBeDisabled();
  await expect(panel).toContainText('Toca de dónde quieres sacar un libro');

  // Pasar un libro del lunes al viernes es un solo movimiento: la media sigue encendida.
  await lugar(panel, 'Carrito del lunes').click();
  await expect(lugar(panel, 'Carrito del lunes')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('Estás sacando libros del carrito del lunes.');
  await lugar(panel, 'Carrito del viernes').click();
  await expect(lugar(panel, 'Carrito del lunes')).toHaveAccessibleName(/4 libros/);
  await expect(lugar(panel, 'Carrito del viernes')).toHaveAccessibleName(/4 libros/);
  await expect(panel).toContainText('MEDIA 4: encendido');

  // Tras 5 segundos quieta, la máquina acepta el reparto y el panel espera el «Seguir».
  await expect(panel).toContainText('La máquina aceptó los ajustes', { timeout: 30_000 });
  await expect(lugar(panel, 'Carrito del lunes')).toBeDisabled();
  await expect(panel).not.toContainText('dispersión');
  await panel.getByRole('button', { name: 'Seguir' }).click();

  // Etapa 2: se destapa MEDIANA y los carritos empiezan parejos.
  await expect(panel).toContainText('Sala 4 · Etapa 2 de 3');
  await expect(panel).toContainText('MEDIA 4: encendido');
  await expect(panel).toContainText('MEDIANA 3: apagado');
  await expect(panel).toContainText('MODA 2 · tapada');
  await expect(lugar(panel, 'Carrito del miércoles')).toHaveAccessibleName(/4 libros/);

  // Devolver todo a la pila deja los 20 libros listos, y ya se está sacando de ella: cada
  // toque en un carrito deja un libro.
  await panel.getByRole('button', { name: 'Devolver todo a la pila' }).click();
  await expect(lugar(panel, 'Pila')).toHaveAccessibleName(/Pila: 20 libros/);
  await expect(lugar(panel, 'Pila')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('MEDIA 4: apagado');
  await expect(panel).toContainText('Estás sacando libros de la pila.');
  await lugar(panel, 'Carrito del viernes').click();
  await expect(lugar(panel, 'Carrito del viernes')).toHaveAccessibleName(/1 libro\./);
  await lugar(panel, 'Carrito del viernes').click();
  await expect(lugar(panel, 'Carrito del viernes')).toHaveAccessibleName(/2 libros/);
  await expect(lugar(panel, 'Pila')).toHaveAccessibleName(/Pila: 18 libros/);
});

test('dominar: con las cuatro lámparas encendidas se gana el sello de la sala 4', async ({
  page,
}, info) => {
  const conDedo = info.project.use.hasTouch === true;
  // Falta un libro por poner: con 2, 2, 3, 4 y 8 solo cumplen MEDIANA y MODA.
  const panel = await abrirCarritos(page, conDedo, 2, [2, 2, 3, 4, 8]);

  await expect(panel).toContainText('Sala 4 · Etapa 3 de 3');
  await expect(panel).toContainText('MEDIA 4: apagado');
  await expect(panel).toContainText('MEDIANA 3: encendido');
  await expect(panel).toContainText('MODA 2: encendido');
  await expect(panel).toContainText('RANGO 7: apagado');

  await lugar(panel, 'Carrito del viernes').click();
  await expect(lugar(panel, 'Carrito del viernes')).toHaveAccessibleName(/9 libros/);
  for (const lampara of ['MEDIA 4', 'MEDIANA 3', 'MODA 2', 'RANGO 7']) {
    await expect(panel).toContainText(`${lampara}: encendido`);
  }

  await expect(panel).toContainText('Conseguiste el sello de esta sala', { timeout: 30_000 });
  // El concepto se nombra solo ahora, con la sala resuelta.
  await expect(panel).toContainText('Medidas de tendencia central y de dispersión');
  await panel.getByRole('button', { name: 'Volver a la sala' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Sellos: 4 de 5' })).toBeVisible();
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-maquina', 'lamparas-4');
});
