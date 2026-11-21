import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { Mecanismo, Puzzle, PuzzleDe } from '../../src/content/esquema';
import type { Lugar, ObjetoSala, Sala } from '../../src/content/esquema-salas';
import { puntoDeEntrada } from '../../src/engine/salas/recorrido';
import { dia } from '../../src/ui/mecanismos/carritos/textos';
import { textoRodillo } from '../../src/ui/mecanismos/etiquetadora/textos';
import { nombrePoste } from '../../src/ui/mecanismos/reflector/textos';
import { TEXTO_ACCIONAR, textoEtapa } from '../../src/ui/mecanismos/textos';
import { leer, mirarHacia, tocarObjeto, type Caja, type Punto3 } from './escena';

/**
 * Ayudas para jugar una partida completa desde el menú (T77): caminar hasta un objeto, usarlo,
 * cruzar puertas y resolver cada máquina desde su panel.
 *
 * Nada se copia a mano: las posiciones salen de `src/content/salas.json` y lo que se pone en
 * cada máquina, del campo `solucion` de `src/content/puzzles/*.json`. Si el contenido cambia,
 * estas pruebas juegan con el contenido nuevo.
 */

function leerJson(ruta: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../src/content/${ruta}`, import.meta.url), 'utf8'));
}

const SALAS = leerJson('salas.json') as readonly Sala[];

/** Los cinco puzzles, en el orden de las salas. */
export const PUZZLES = [
  's1-etiquetadora',
  's2-tanques',
  's3-reflector',
  's4-carritos',
  's5-urna',
].map((id) => leerJson(`puzzles/${id}.json`) as Puzzle);

/** Puzzle de una sala (1 a 5). */
export function puzzleDeSala(numero: number): Puzzle {
  const puzzle = PUZZLES.find((p) => p.sala === numero);
  if (!puzzle) throw new Error(`no hay puzzle para la sala ${numero}`);
  return puzzle;
}

function salaPorId(id: Lugar): Sala {
  const sala = SALAS.find((s) => s.id === id);
  if (!sala) throw new Error(`no existe la sala ${id}`);
  return sala;
}

function buscar(id: string): { sala: Sala; objeto: ObjetoSala } {
  for (const sala of SALAS) {
    const objeto = sala.objetos.find((o) => o.id === id);
    if (objeto) return { sala, objeto };
  }
  throw new Error(`no existe el objeto ${id}`);
}

/**
 * El punto donde se toca un objeto: su centro. Con `parte`, el centro de esa pieza de un
 * grupo (un carrito, un poste). Lo que cuelga de una pared se toca 2 cm hacia la sala.
 */
export function centro(id: string, parte?: number): Punto3 {
  const { objeto: o } = buscar(id);
  const pieza = parte === undefined ? undefined : o.partes?.[parte];
  if (parte !== undefined && !pieza) throw new Error(`${id} no tiene la pieza ${parte}`);
  const [x, y, z] = pieza ? [0, 1, 2].map((i) => (o.pos[i] ?? 0) + (pieza.pos[i] ?? 0)) : o.pos;
  const alto = (pieza ?? o).tam[1] ?? 0;
  if (o.forma !== 'plano') return [x ?? 0, (y ?? 0) + alto / 2, z ?? 0];
  // Un plano sin girar mira hacia +Z; girado `g` grados mira hacia (sen g, cos g).
  const g = ((o.giro ?? 0) * Math.PI) / 180;
  return [(x ?? 0) + Math.sin(g) * 0.02, (y ?? 0) + alto / 2, (z ?? 0) + Math.cos(g) * 0.02];
}

const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Abre /jugar sin nada guardado y toca «Jugar solo». Devuelve la caja del canvas. */
export async function empezarDesdeElMenu(page: Page): Promise<Caja> {
  await page.goto('/jugar');
  const canvas = page.getByLabel('Escena del juego');
  // La espera más larga: descargar el juego y arrancar WebGL por software (T05b).
  await expect(canvas).toHaveAttribute('data-motor', 'pausado', { timeout: 30_000 });
  // Es una partida nueva de verdad: no hay ninguna guardada que continuar.
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Jugar solo' }).click();
  await expect(canvas).toHaveAttribute('data-sala', 'porteria');
  await expect(canvas).toHaveAttribute('data-mirada', /,/);
  const caja = await canvas.boundingBox();
  if (!caja) throw new Error('sin canvas');
  return caja;
}

/**
 * Esquinas del pasillo en U de la portería (`docs/pasillos.md`), sacadas de sus tramos: para
 * llegar a una puerta del pasillo no se camina en línea recta (hay paredes), sino por el centro
 * de cada tramo. Zona 0: el vestíbulo; 1: el vano y el tramo 1; 2: el tramo 2; 3: el tramo 3.
 */
function esquinasDelPasillo(): { zona: (x: number, z: number) => number; entre: Punto3[][] } {
  const porteria = salaPorId('porteria');
  const [vano, t1, t2, t3] = porteria.tramos ?? [];
  if (!vano || !t1 || !t2 || !t3) throw new Error('la portería no tiene su pasillo');
  const medio = (r: readonly [number, number]): number => (r[0] + r[1]) / 2;
  const dentro = (t: { x: readonly number[]; z: readonly number[] }, x: number, z: number) =>
    x >= (t.x[0] ?? 0) && x <= (t.x[1] ?? 0) && z >= (t.z[0] ?? 0) && z <= (t.z[1] ?? 0);
  return {
    zona: (x, z) => {
      if (dentro(vano, x, z) || dentro(t1, x, z)) return 1;
      if (dentro(t2, x, z)) return 2;
      if (dentro(t3, x, z)) return 3;
      return 0;
    },
    // Lo que se pisa al pasar de la zona i a la i + 1.
    entre: [
      [
        [-1, 0, medio(vano.z)],
        [medio(t1.x), 0, medio(vano.z)],
      ],
      [[medio(t1.x), 0, medio(t2.z)]],
      [[medio(t3.x), 0, medio(t2.z)]],
    ],
  };
}

/** Los puntos por los que se pasa en la portería para ir de (x, z) a `punto`, sin él. */
export function rutaEnLaPorteria(x: number, z: number, punto: Punto3): Punto3[] {
  const { zona, entre } = esquinasDelPasillo();
  const desde = zona(x, z);
  const hasta = zona(punto[0], punto[2]);
  const ruta: Punto3[] = [];
  if (desde < hasta) for (let i = desde; i < hasta; i++) ruta.push(...(entre[i] ?? []));
  else for (let i = desde - 1; i >= hasta; i--) ruta.push(...[...(entre[i] ?? [])].reverse());
  return ruta;
}

/** Píxeles que se empuja el joystick: a fondo (56 px o más) o despacio, para llegar sin pasarse. */
const EMPUJE_RAPIDO = 80;
const EMPUJE_LENTO = 24;
/** Cada cuánto se vuelve a apuntar en una caminata larga, en metros. */
const TRAMO = 3;

/** Empuja el joystick hacia adelante mientras `sigue()` sea cierto. */
async function empujar(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  px: number,
  sigue: () => Promise<boolean>,
): Promise<void> {
  const x = caja.x + caja.width * 0.2;
  const y = caja.y + caja.height * 0.7;
  const cdp = conDedo ? await page.context().newCDPSession(page) : null;
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - px, id: 1 }],
    });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - px, { steps: 3 });
  }
  try {
    while (await sigue()) await page.waitForTimeout(40);
  } finally {
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.up();
    }
  }
}

/**
 * Camina hasta quedar a `cerca` metros o menos del punto (en el piso). Lee la posición que
 * publica el motor mientras camina (T05b: nunca un tiempo fijo). En una caminata larga vuelve
 * a apuntar cada 3 m, y el último tramo lo hace despacio para no pasarse.
 */
export async function irA(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  punto: Punto3,
  cerca: number,
): Promise<void> {
  // En la portería, por las esquinas del pasillo (docs/pasillos.md).
  const canvas = page.getByLabel('Escena del juego');
  if ((await canvas.getAttribute('data-sala')) === 'porteria') {
    const [x, z] = await leer(page, 'data-posicion');
    for (const esquina of rutaEnLaPorteria(x, z, punto)) {
      await irDerecho(page, caja, conDedo, esquina, 0.45);
    }
  }
  await irDerecho(page, caja, conDedo, punto, cerca);
}

/** Como `irA`, en línea recta: el camino tiene que estar libre. */
async function irDerecho(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  punto: Punto3,
  cerca: number,
): Promise<void> {
  const falta = async (): Promise<number> => {
    const [x, z] = await leer(page, 'data-posicion');
    return Math.hypot(punto[0] - x, punto[2] - z);
  };
  for (let tramo = 0; tramo < 12; tramo++) {
    const desde = await falta();
    if (desde <= cerca) return;
    await mirarHacia(page, caja, punto, conDedo);
    const lento = desde - cerca < 1.2;
    const meta = lento ? cerca : Math.max(cerca + 0.8, desde - TRAMO);
    // Si algo sólido detiene al jugador, el tramo termina y se vuelve a apuntar.
    let anterior = desde;
    let quieto = 0;
    const limite = Date.now() + 30_000;
    await empujar(page, caja, conDedo, lento ? EMPUJE_LENTO : EMPUJE_RAPIDO, async () => {
      const ahora = await falta();
      quieto = Math.abs(ahora - anterior) < 0.005 ? quieto + 1 : 0;
      anterior = ahora;
      return ahora > meta && quieto < 40 && Date.now() < limite;
    });
  }
  const canvas = page.getByLabel('Escena del juego');
  throw new Error(
    `No se pudo llegar a ${cerca} m de (${punto.join(', ')}). Posición ` +
      `${String(await canvas.getAttribute('data-posicion'))}, sala ` +
      `${String(await canvas.getAttribute('data-sala'))}.`,
  );
}

interface Alcance {
  /** Pieza de un grupo que se toca (un carrito, un poste). */
  parte?: number;
  /** Hasta qué distancia acercarse antes de tocar. La mano alcanza 3 m. */
  cerca?: number;
}

/** Camina hasta un objeto, lo toca donde se ve y espera su botón («Usar», «Recoger»…). */
async function enfocar(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  id: string,
  verbo: string,
  alcance: Alcance,
): Promise<Locator> {
  const nombre = buscar(id).objeto.nombre;
  if (!nombre) throw new Error(`${id} no tiene nombre: no se puede tocar`);
  const punto = centro(id, alcance.parte);
  await irA(page, caja, conDedo, punto, alcance.cerca ?? 2.2);
  const boton = new RegExp(`${verbo}.*${escapar(nombre)}`);
  await tocarObjeto(page, caja, punto, conDedo, boton);
  return page.getByRole('button', { name: boton });
}

/** Camina hasta un objeto y lo usa con el botón del HUD. */
export async function usar(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  id: string,
  alcance: Alcance = {},
): Promise<void> {
  await (await enfocar(page, caja, conDedo, id, 'Usar', alcance)).click();
}

/** Camina hasta un objeto y lo recoge. */
export async function recoger(page: Page, caja: Caja, conDedo: boolean, id: string): Promise<void> {
  await (await enfocar(page, caja, conDedo, id, 'Recoger', {})).click();
}

/**
 * Usa una puerta y espera a estar del otro lado: el motor publica la posición nueva un cuadro
 * después de cambiar de sala, y todo lo que sigue se calcula con ella.
 *
 * En grupo, la puerta abre un voto: `votar` hace que los demás lo acepten, y la espera de la sala
 * nueva empieza después (T05e). Con WebGL por la CPU, el toque de la otra pestaña en «Aceptar»
 * tarda de 2 a 7 s y a veces más; contado dentro de esa espera, la prueba fallaba sin error.
 */
export async function cruzar(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  puerta: string,
  votar?: () => Promise<void>,
): Promise<void> {
  const { sala: origen, objeto } = buscar(puerta);
  const destino = objeto.puerta;
  if (!destino) throw new Error(`${puerta} no es una puerta`);
  await usar(page, caja, conDedo, puerta);
  await votar?.();
  await expect(page.getByLabel('Escena del juego')).toHaveAttribute('data-sala', destino);
  const llegada = puntoDeEntrada(salaPorId(destino), origen.id);
  await expect
    .poll(async () => {
      const [x, z] = await leer(page, 'data-posicion');
      return Math.hypot(x - llegada.x, z - llegada.z);
    })
    .toBeLessThan(0.15);
}

/** Vuelve hasta donde se aparece al entrar a la sala: desde ahí el camino a la puerta está libre. */
export async function volverALaEntrada(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  sala: Lugar,
): Promise<void> {
  const llegada = puntoDeEntrada(salaPorId(sala), 'porteria');
  await irA(page, caja, conDedo, [llegada.x, 0, llegada.z], 0.7);
}

/** El objeto de cada máquina que se toca para abrir su panel, y hasta dónde hay que acercarse. */
const MAQUINAS: Readonly<Record<Mecanismo, { objeto: string } & Alcance>> = {
  etiquetadora: { objeto: 's1-etiquetadora' },
  tanques: { objeto: 's2-panel' },
  // El poste de 2 m: es el que está en la cancha en la primera etapa.
  reflector: { objeto: 's3-postes', parte: 2 },
  // El carrito del jueves queda de frente a la puerta, sin muebles en el camino.
  carritos: { objeto: 's4-carritos', parte: 3 },
  urna: { objeto: 's5-urna' },
};

/** Lleva un control de «menos» y «más» de un valor a otro, de a un toque. */
async function ponerPasos(
  panel: Locator,
  etiqueta: string,
  desde: number,
  hasta: number,
): Promise<void> {
  const valor = panel.getByRole('group', { name: etiqueta, exact: true }).locator('output');
  const boton = panel.getByRole('button', {
    name: `${hasta > desde ? 'Más' : 'Menos'}: ${etiqueta}`,
    exact: true,
  });
  for (let i = 0; i < Math.abs(hasta - desde); i++) {
    const antes = (await valor.textContent()) ?? '';
    await boton.click();
    await expect(valor).not.toHaveText(antes);
  }
}

async function ponerEtiquetadora(
  panel: Locator,
  puzzle: PuzzleDe<'etiquetadora'>,
  n: number,
): Promise<void> {
  for (const rodillo of puzzle.etapas[n]?.solucion.rodillos ?? []) {
    const boton = panel.getByRole('button', { name: textoRodillo(rodillo), exact: true });
    await boton.click();
    await expect(boton).toHaveAttribute('aria-pressed', 'true');
  }
}

async function ponerTanques(panel: Locator, puzzle: PuzzleDe<'tanques'>, n: number): Promise<void> {
  const etapa = puzzle.etapas[n];
  if (!etapa) return;
  await ponerPasos(
    panel,
    'Perilla verde: caudal del tanque A',
    etapa.estado_inicial.a.caudal,
    etapa.solucion.a.caudal,
  );
}

async function ponerReflector(
  panel: Locator,
  puzzle: PuzzleDe<'reflector'>,
  n: number,
): Promise<void> {
  const etapa = puzzle.etapas[n];
  if (!etapa) return;
  const { estado_inicial: inicial, solucion } = etapa;
  const muesca = panel.getByRole('button', { name: `${solucion.muesca}°`, exact: true });
  if (solucion.muesca !== inicial.muesca) await muesca.click();
  await expect(muesca).toHaveAttribute('aria-pressed', 'true');
  for (const poste of solucion.postes) {
    const antes = inicial.postes.find((p) => p.id === poste.id)?.distancia;
    if (poste.distancia === null || antes === null || antes === undefined) continue;
    await ponerPasos(
      panel,
      `${nombrePoste(poste.altura)}: distancia a su sensor`,
      antes,
      poste.distancia,
    );
  }
  if (solucion.polea !== null && inicial.polea !== null) {
    await ponerPasos(panel, 'Cuerda de la polea', inicial.polea, solucion.polea);
  }
}

/**
 * Mueve los libros, de a uno, del reparto inicial al de la solución: de la pila o de los
 * carritos a los que les sobran, a los carritos a los que les faltan.
 */
async function ponerCarritos(
  panel: Locator,
  puzzle: PuzzleDe<'carritos'>,
  n: number,
  resuelta: Locator,
): Promise<void> {
  const etapa = puzzle.etapas[n];
  if (!etapa) return;
  const tiene = [...etapa.estado_inicial.carritos];
  const meta = etapa.solucion.carritos;
  const carrito = (i: number): Locator =>
    panel.getByRole('button', { name: new RegExp(`^Carrito del ${dia(i)}:`) });
  const pila = panel.getByRole('button', { name: /^Pila:/ });
  const origenes: { boton: Locator; sobran: number; carrito: number | null }[] = [
    {
      boton: pila,
      sobran: etapa.controles.libros - tiene.reduce((a, b) => a + b, 0),
      carrito: null,
    },
    ...tiene.map((libros, i) => ({
      boton: carrito(i),
      sobran: Math.max(0, libros - (meta[i] ?? 0)),
      carrito: i,
    })),
  ];
  const elegido = panel.locator('.carritos-lugar[aria-pressed="true"]');

  for (const origen of origenes) {
    if (origen.sobran === 0) continue;
    // Se saca de un solo lugar a la vez: si hay otro elegido, primero se suelta.
    if ((await origen.boton.getAttribute('aria-pressed')) !== 'true') {
      // Al empezar una etapa, el panel puede mostrar un instante el origen de la etapa
      // anterior antes de soltarlo. Si ya no está elegido al hacer clic, no hay nada que soltar.
      if ((await elegido.count()) > 0) {
        await elegido
          .first()
          .click({ timeout: 5000 })
          .catch(() => undefined);
      }
      await origen.boton.click();
      await expect(origen.boton).toHaveAttribute('aria-pressed', 'true');
    }
    for (let destino = 0; destino < meta.length && origen.sobran > 0; destino++) {
      while ((tiene[destino] ?? 0) < (meta[destino] ?? 0) && origen.sobran > 0) {
        // Otro reparto también puede cumplir la etapa. Si a mitad de camino la máquina ya
        // la aceptó (5 segundos quieta), los carritos quedan bloqueados y no hay más que mover.
        const movio = await carrito(destino)
          .click({ timeout: 5000 })
          .then(() => true)
          // Si el clic no termina a tiempo y la etapa no está resuelta, puede que el libro sí
          // se haya movido y sea Playwright el que no recibió la confirmación (pasó en
          // escritorio con el equipo ocupado): la cuenta de abajo dice si se movió.
          .catch(async () => !(await resuelta.isVisible()));
        if (!movio) return;
        tiene[destino] = (tiene[destino] ?? 0) + 1;
        if (origen.carrito !== null) tiene[origen.carrito] = (tiene[origen.carrito] ?? 0) - 1;
        origen.sobran--;
        await expect(carrito(destino).locator('.carritos-cuenta')).toHaveText(
          String(tiene[destino]),
        );
      }
    }
  }
}

async function ponerUrna(panel: Locator, puzzle: PuzzleDe<'urna'>, n: number): Promise<void> {
  const etapa = puzzle.etapas[n];
  if (!etapa) return;
  const { estado_inicial: inicial, solucion } = etapa;
  await ponerPasos(panel, 'Fichas azules (redondas)', inicial.azules, solucion.azules);
  await ponerPasos(panel, 'Fichas amarillas (cuadradas)', inicial.amarillas, solucion.amarillas);
}

/**
 * Resuelve una etapa desde el panel abierto: pone los ajustes del campo `solucion`, acciona
 * la máquina si la etapa se acciona y espera a que la acepte (las que responden solas tardan
 * 5 segundos; la corrida de los tanques, hasta 12). No toca «Seguir».
 */
export async function resolverEtapa(panel: Locator, puzzle: Puzzle, n: number): Promise<Locator> {
  const etapa = puzzle.etapas[n];
  if (!etapa) throw new Error(`${puzzle.id} no tiene la etapa ${n}`);
  const ultima = n === puzzle.etapas.length - 1;
  const seguir = panel.getByRole('button', {
    name: ultima ? 'Volver a la sala' : 'Seguir',
    exact: true,
  });
  await expect(panel).toContainText(textoEtapa(puzzle.sala, n, puzzle.etapas.length));

  switch (puzzle.mecanismo) {
    case 'etiquetadora':
      await ponerEtiquetadora(panel, puzzle, n);
      break;
    case 'tanques':
      await ponerTanques(panel, puzzle, n);
      break;
    case 'reflector':
      await ponerReflector(panel, puzzle, n);
      break;
    case 'carritos':
      await ponerCarritos(panel, puzzle, n, seguir);
      break;
    case 'urna':
      await ponerUrna(panel, puzzle, n);
      break;
  }
  if (etapa.intento.tipo === 'accionar') {
    await panel.getByRole('button', { name: TEXTO_ACCIONAR[puzzle.mecanismo] }).click();
  }
  await expect(seguir).toBeVisible({ timeout: 45_000 });
  // La máquina nunca califica: muestra lo que pasó.
  await expect(panel).not.toContainText(/incorrect/i);
  return seguir;
}

/**
 * Estando dentro de la sala, camina hasta su máquina, abre el panel y resuelve las tres
 * etapas. Termina con el panel cerrado y el sello nuevo en el HUD.
 */
export async function resolverMaquina(
  page: Page,
  caja: Caja,
  conDedo: boolean,
  numero: number,
): Promise<void> {
  const puzzle = puzzleDeSala(numero);
  const { objeto, ...alcance } = MAQUINAS[puzzle.mecanismo];
  await usar(page, caja, conDedo, objeto, alcance);
  const panel = page.getByRole('dialog', { name: puzzle.titulo });
  await expect(panel).toBeVisible();
  for (let n = 0; n < puzzle.etapas.length; n++) {
    const seguir = await resolverEtapa(panel, puzzle, n);
    await seguir.click();
  }
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('img', { name: `Sellos: ${numero} de 5` })).toBeVisible();
}
