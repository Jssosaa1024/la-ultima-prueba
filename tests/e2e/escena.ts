import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CLAVE_GUARDADO, VERSION_GUARDADO } from '../../src/game/guardado';
import { tocar } from './toque';

/**
 * Ayudas para las pruebas e2e que juegan dentro de una sala (T45 en adelante): empezar en una
 * sala con una partida guardada, girar hacia un objeto y tocarlo donde se ve en pantalla.
 *
 * Son las mismas ayudas de `partida.spec.ts` (sesión C), puestas en un archivo para no
 * copiarlas en cada prueba de máquina.
 */

export interface Punto {
  x: number;
  y: number;
}

export interface Caja extends Punto {
  width: number;
  height: number;
}

export type Punto3 = [number, number, number];

export type SalaDePrueba =
  's1-cooperativa' | 's2-laboratorio' | 's3-gimnasio' | 's4-biblioteca' | 's5-rectoria';

const SALAS: readonly SalaDePrueba[] = [
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
];

const ALTURA_OJOS = 1.6;

/** Lee un atributo `data-…` del canvas con dos números separados por coma. */
export async function leer(page: Page, atributo: string): Promise<[number, number]> {
  const valor = await page.getByLabel('Escena del juego').getAttribute(atributo);
  const [a = NaN, b = NaN] = (valor ?? '').split(',').map(Number);
  return [a, b];
}

export interface PartidaDePrueba {
  /** Sala en la que se continúa. */
  sala: SalaDePrueba;
  /** Etapas resueltas en esa sala (0 a 3). Las salas anteriores quedan resueltas. */
  etapas?: number;
  /** Ajustes guardados de la máquina de esa sala. */
  ajustes?: unknown;
  /** Ids de los objetos recogidos (por ejemplo, `porteria-linterna`). */
  inventario?: readonly string[];
  grabaciones?: readonly string[];
  /** `'porteria'`: el jugador está en la portería, con el avance que dicen `sala` y `etapas`. */
  lugar?: 'porteria';
  /** Ids de los objetos ya examinados (datos encontrados del cuaderno). */
  datos?: readonly string[];
  /** Tiempo que le queda al reloj, en ms. Por defecto, 30 minutos. */
  restanteMs?: number;
  /** Pistas ofrecidas y abiertas en la máquina de la sala. */
  pistas?: { ofrecidas: number; vistas: number };
}

/**
 * Deja una partida guardada dentro de una sala y la continúa desde el menú, para no repetir en
 * cada prueba el camino por la portería. Devuelve la caja del canvas.
 */
export async function continuarEn(page: Page, p: PartidaDePrueba): Promise<Caja> {
  const numero = SALAS.indexOf(p.sala);
  const etapas = Object.fromEntries(
    SALAS.map((s, i) => [s, i < numero ? 3 : i === numero ? (p.etapas ?? 0) : 0]),
  );
  const guardado = {
    v: VERSION_GUARDADO,
    partida: {
      fase: 'jugando',
      lugar: p.lugar ?? p.sala,
      etapas,
      final: null,
      grabaciones: p.grabaciones ?? [],
    },
    restanteMs: p.restanteMs ?? 30 * 60 * 1000,
    pistas: p.pistas ? { [p.sala]: { msEnEtapa: 0, intentosEnEtapa: 0, ...p.pistas } } : {},
    mecanismos: p.ajustes === undefined ? {} : { [p.sala]: p.ajustes },
    notas: [],
    datos: p.datos ?? [],
    inventario: p.inventario ?? [],
  };
  await page.addInitScript(
    ([clave, texto]) => {
      // Solo la primera vez: si la prueba recarga la página, vale lo que guardó el juego.
      if (sessionStorage.getItem('prueba-sembrada')) return;
      sessionStorage.setItem('prueba-sembrada', '1');
      localStorage.setItem(clave, texto);
    },
    [CLAVE_GUARDADO, JSON.stringify(guardado)] as const,
  );
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  // La espera más larga: descargar el juego y arrancar WebGL por software (T05b).
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Continuar partida' }).click();
  await expect(canvas).toHaveAttribute('data-sala', p.lugar ?? p.sala);
  await expect(canvas).toHaveAttribute('data-mirada', /,/);
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

async function arrastrar(page: Page, a: Punto, b: Punto, conDedo: boolean): Promise<void> {
  if (!conDedo) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const punto = (t: number) => [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(0) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(i / 10) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Cada cuánto se lee la posición al caminar: poco, para no pasarse de la meta. */
const MS_ENTRE_LECTURAS = 50;
/**
 * Quieto este tiempo después de haber avanzado: algo sólido lo detuvo. Más que el cuadro más
 * lento que se ha visto con el WebGL por software y el equipo ocupado.
 */
const MS_CONTRA_ALGO = 3000;
/** Si en este tiempo no se movió nada, el joystick no respondió. */
const MS_SIN_ARRANCAR = 10_000;
const MS_MAX_CAMINATA = 45_000;

/**
 * Camina de frente con el joystick (mitad izquierda) hasta que se cumpla `llego` o hasta que
 * algo sólido lo detenga (un mueble, una pared). No camina un tiempo fijo (T05b): con el equipo
 * ocupado se avanza menos de lo que dice el reloj.
 *
 * Lee la posición cada 50 ms (antes, con la espera creciente de `expect.poll`, se leía cada
 * segundo y el jugador se pasaba hasta 2 m de la meta). Aun así, la orden de soltar puede
 * llegar tarde: conviene caminar hacia algo sólido, que lo detiene siempre en el mismo lugar,
 * y que `llego` siga siendo cierto si el jugador sigue de largo.
 *
 * Devuelve `true` si llegó y `false` si algo sólido lo detuvo antes.
 */
export async function caminarHasta(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  llego: (x: number, z: number) => boolean,
): Promise<boolean> {
  const a = { x: caja.x + caja.width * 0.2, y: caja.y + caja.height * 0.7 };
  const b = { x: a.x, y: a.y - 80 };
  const esperar = async (): Promise<boolean> => {
    const inicio = Date.now();
    let [px, pz] = await leer(page, 'data-posicion');
    let seMovio = false;
    let quietoDesde = inicio;
    for (;;) {
      const [x, z] = await leer(page, 'data-posicion');
      if (llego(x, z)) return true;
      const ahora = Date.now();
      if (Math.hypot(x - px, z - pz) > 0.01) {
        seMovio = true;
        quietoDesde = ahora;
        [px, pz] = [x, z];
      } else if (seMovio && ahora - quietoDesde >= MS_CONTRA_ALGO) {
        return false;
      } else if (!seMovio && ahora - inicio >= MS_SIN_ARRANCAR) {
        throw new Error(`El jugador no arrancó a caminar (posición ${x}, ${z}).`);
      }
      if (ahora - inicio >= MS_MAX_CAMINATA) {
        throw new Error(`El jugador sigue caminando sin llegar (posición ${x}, ${z}).`);
      }
      await page.waitForTimeout(MS_ENTRE_LECTURAS);
    }
  };
  if (!conDedo) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    try {
      return await esperar();
    } finally {
      await page.mouse.up();
      await esperarQuieto(page);
    }
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...a, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...b, id: 1 }] });
  try {
    return await esperar();
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await esperarQuieto(page);
  }
}

/**
 * Espera a que la cámara quede quieta: la posición y la mirada que publica el motor no cambian
 * en 300 ms. Después de soltar el joystick, con cuadros lentos, el motor puede publicar uno o
 * dos cuadros más de camino; apuntar con la posición anterior hace tocar fuera del objeto.
 */
export async function esperarQuieto(page: Page): Promise<void> {
  const canvas = page.getByLabel('Escena del juego');
  const foto = async (): Promise<string> =>
    `${await canvas.getAttribute('data-posicion')}|${await canvas.getAttribute('data-mirada')}`;
  const limite = Date.now() + 10_000;
  let anterior = await foto();
  let igualDesde = Date.now();
  while (Date.now() < limite) {
    await page.waitForTimeout(MS_ENTRE_LECTURAS * 2);
    const actual = await foto();
    if (actual !== anterior) {
      anterior = actual;
      igualDesde = Date.now();
    } else if (Date.now() - igualDesde >= 300) {
      return;
    }
  }
}

/** Diferencia entre dos ángulos, entre −π y π. */
const diferencia = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * Gira hasta mirar hacia el punto (en horizontal), arrastrando en la mitad derecha. Lee la
 * mirada después de cada arrastre y corrige, así que no importa cuánto gira cada píxel.
 */
export async function mirarHacia(
  page: Page,
  caja: Caja,
  punto: Punto3,
  conDedo: boolean,
): Promise<void> {
  const [cx, cz] = await leer(page, 'data-posicion');
  // «Adelante» con yaw es (−sen yaw, −cos yaw).
  const objetivo = Math.atan2(-(punto[0] - cx), -(punto[2] - cz));
  const y = caja.y + caja.height * 0.4;
  let pxPorRadian = 1 / 0.0045;
  for (let i = 0; i < 8; i++) {
    const [yaw] = await leer(page, 'data-mirada');
    const falta = diferencia(objetivo, yaw);
    // Con 0,08 rad el objeto ya queda en pantalla, y un arrastre menor parecería un toque.
    if (Math.abs(falta) < 0.08) return;
    // Arrastrar a la derecha baja el yaw. Cada arrastre cabe en la mitad derecha.
    const dx = Math.max(-caja.width * 0.42, Math.min(caja.width * 0.42, -falta * pxPorRadian));
    const desde = { x: dx > 0 ? caja.x + caja.width * 0.54 : caja.x + caja.width * 0.97, y };
    await arrastrar(page, desde, { x: desde.x + dx, y }, conDedo);
    await expect
      .poll(async () => Math.abs(diferencia((await leer(page, 'data-mirada'))[0], yaw)))
      .toBeGreaterThan(0.005);
    const girado = diferencia((await leer(page, 'data-mirada'))[0], yaw);
    if (Math.abs(girado) > 0.01) pxPorRadian = Math.abs(dx / girado);
  }
  throw new Error('no se pudo girar hacia el punto');
}

/**
 * Sube o baja la mirada hasta que el punto quede cerca del centro de la pantalla, arrastrando
 * en vertical en la mitad derecha. Hace falta con lo que está muy abajo o muy arriba cuando
 * el jugador queda cerca: si no, el objeto se sale de la pantalla.
 */
export async function inclinarHacia(
  page: Page,
  caja: Caja,
  punto: Punto3,
  conDedo: boolean,
): Promise<void> {
  const [cx, cz] = await leer(page, 'data-posicion');
  const lejos = Math.hypot(punto[0] - cx, punto[2] - cz);
  // Positivo mira hacia arriba. No se pide más que el límite de la cámara (80°), con margen.
  const objetivo = Math.max(-1.2, Math.min(1.2, Math.atan2(punto[1] - ALTURA_OJOS, lejos)));
  const x = caja.x + caja.width * 0.75;
  let pxPorRadian = 1 / 0.0045;
  for (let i = 0; i < 6; i++) {
    const [, pitch] = await leer(page, 'data-mirada');
    const falta = objetivo - pitch;
    // Con 0,2 rad (11°) el objeto ya queda bien adentro de la pantalla.
    if (Math.abs(falta) < 0.2) return;
    // Arrastrar hacia abajo baja la mirada. Cada arrastre cabe en la pantalla.
    const dy = Math.max(-caja.height * 0.3, Math.min(caja.height * 0.3, -falta * pxPorRadian));
    const desde = { x, y: caja.y + caja.height * 0.5 - dy / 2 };
    await arrastrar(page, desde, { x, y: desde.y + dy }, conDedo);
    await expect
      .poll(async () => Math.abs((await leer(page, 'data-mirada'))[1] - pitch))
      .toBeGreaterThan(0.005);
    const girado = (await leer(page, 'data-mirada'))[1] - pitch;
    if (Math.abs(girado) > 0.01) pxPorRadian = Math.abs(dy / girado);
  }
  throw new Error('no se pudo inclinar la mirada hacia el punto');
}

/**
 * Dónde se ve en pantalla un punto 3D, con la posición y la mirada que publica el motor
 * (cámara a 1,6 m, campo de visión vertical de 70°).
 */
export async function enPantalla(page: Page, caja: Caja, punto: Punto3): Promise<Punto> {
  const [cx, cz] = await leer(page, 'data-posicion');
  const [yaw, pitch] = await leer(page, 'data-mirada');
  const d = [punto[0] - cx, punto[1] - ALTURA_OJOS, punto[2] - cz] as const;
  const f = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
  const punto3 = (v: readonly number[]) =>
    d[0] * (v[0] ?? 0) + d[1] * (v[1] ?? 0) + d[2] * (v[2] ?? 0);
  const profundidad = punto3(f);
  const t = Math.tan((35 * Math.PI) / 180);
  const ndcX = punto3(r) / (profundidad * t * (caja.width / caja.height));
  const ndcY = punto3(u) / (profundidad * t);
  return { x: caja.x + ((ndcX + 1) / 2) * caja.width, y: caja.y + ((1 - ndcY) / 2) * caja.height };
}

/**
 * Mira hacia el objeto (gira y, si hace falta, sube o baja la mirada), lo toca donde se ve y
 * espera su botón contextual. Si el botón no aparece, vuelve a apuntar y toca otra vez, hasta
 * 4 veces. En escritorio, un clic que no cae en un objeto bloquea el ratón: antes de repetir se
 * suelta, como haría el jugador con Esc.
 */
export async function tocarObjeto(
  page: Page,
  caja: Caja,
  punto: Punto3,
  conDedo: boolean,
  boton: RegExp,
): Promise<void> {
  const esperado = page.getByRole('button', { name: boton });
  for (let intento = 0; intento < 4; intento++) {
    await esperarQuieto(page);
    await mirarHacia(page, caja, punto, conDedo);
    await inclinarHacia(page, caja, punto, conDedo);
    await esperarQuieto(page);
    await tocar(page, await enPantalla(page, caja, punto), conDedo);
    const aparecio = await esperado
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (aparecio) break;
    if (!conDedo) {
      await page.evaluate(() => {
        if (document.pointerLockElement) document.exitPointerLock();
      });
      await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    }
  }
  await expect(esperado).toBeVisible();
}

/**
 * Sale de la partida individual como el jugador (T41d): «Pausa», «Salir de la partida» y
 * «Sí, salir». El sello «Expediente cerrado» golpea antes de volver al menú.
 */
export async function salirDeLaPartida(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Pausa' }).click();
  const pausa = page.getByRole('dialog', { name: 'Pausa' });
  await pausa.getByRole('button', { name: 'Salir de la partida' }).click();
  await page
    .getByRole('dialog', { name: '¿Salir de la partida?' })
    .getByRole('button', { name: 'Sí, salir' })
    .click();
}
