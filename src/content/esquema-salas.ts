import { z } from 'astro/zod';
import { LUGARES, type Lugar } from './lugares';
import { rectangulosDe, type Rectangulo } from './tramos';

/**
 * Esquema de la distribución de las salas (tarea «salas por código»).
 *
 * `src/content/salas.json` describe la portería y las cinco salas de
 * `docs/salas-y-puzzles.md`: medidas, colores, dónde aparece el jugador y cada objeto como
 * una primitiva de Three.js (caja, cilindro, esfera, plano o grupo de piezas). El motor las arma por
 * código; no hay modelos que descargar.
 *
 * Este archivo lo usa `src/content.config.ts` para validar el JSON en cada build. El motor
 * solo importa los TIPOS (`import type`), para no meter zod en el bundle del juego.
 *
 * Convenciones (en metros, el piso en y = 0, el centro de la sala en x = 0, z = 0):
 * - El fondo de la sala es −Z (pared norte) y la entrada desde la portería, +Z (pared sur).
 * - `pos` es el centro del objeto en x y z, y la altura de su BASE en y.
 * - `tam` es [ancho (x), alto (y), fondo (z)]. En un cilindro, [diámetro, alto, —].
 *   En una esfera, [diámetro, diámetro, —].
 *   En un plano (cartel, puerta, pizarra), [ancho, alto, —]: mira hacia +Z sin girar.
 * - `giro` es en grados alrededor del eje vertical: 90 mira hacia +X, −90 hacia −X, 180 hacia −Z.
 * - `modelo` (opcional, T19d) es el id de un modelo del manifiesto (`public/assets/manifest.json`):
 *   el nombre del GLB en `salas/<sala>/` sin el hash ni la extensión (`mostrador` →
 *   `salas/s1-cooperativa/mostrador.<hash>.glb`). Si está, el motor muestra ese modelo; la forma,
 *   `tam` y `pos` siguen siendo la caja que choca y la que se usa si el modelo no carga.
 */

export { LUGARES, type Lugar, rectangulosDe, type Rectangulo };

export const FORMAS = ['caja', 'cilindro', 'esfera', 'plano', 'grupo'] as const;
export const ACCIONES = ['usar', 'recoger', 'examinar'] as const;

const color = z.string().regex(/^#[0-9a-f]{6}$/, 'Color en hexadecimal, por ejemplo #8a5a2b');
const metros = z.number().finite();
const positivo = z.number().finite().positive();
const vec3 = z.tuple([metros, metros, metros]);
const tam3 = z.tuple([positivo, positivo, z.number().finite().min(0)]);
/** Id de un modelo del manifiesto: minúsculas, números y guiones, sin hash ni extensión. */
const idModelo = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Id de modelo: minúsculas, números y guiones, sin hash ni «.glb»',
  );
/**
 * `porteria-…`, `pasillo-…` (el pasillo es parte de la portería) o `s1-…` a `s5-…`:
 * minúsculas, números y guiones.
 */
const idObjeto = z.string().regex(/^(porteria|pasillo|s[1-5])-[a-z0-9]+(-[a-z0-9]+)*$/);
/** Id de una frase de puerta falsa (`src/content/puertas-falsas.json`). */
export const ID_FRASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const pieza = z.strictObject({
  forma: z.enum(['caja', 'cilindro', 'esfera', 'plano']),
  tam: tam3,
  /** Relativa a la posición del objeto. */
  pos: vec3,
  color: color.optional(),
});

/**
 * Tipos de lámina (pulir las salas, sesión C): cómo se dibuja la cara de un plano legible.
 * pizarra (de tiza, o blanca si su color es claro), corcho con notas, planilla en su tablilla,
 * papel (hoja, ficha, carta), cuadrícula (papel de gráfica con ejes), marcador de dígitos,
 * cartel y tablero pintado (placa con el título arriba y el centro libre para una máquina). Los dibuja `src/engine/salas/laminas.ts`.
 */
export const TIPOS_LAMINA = [
  'pizarra',
  'corcho',
  'planilla',
  'papel',
  'cuadricula',
  'marcador',
  'cartel',
  'tablero',
] as const;

/**
 * Lámina de un plano o de una hoja (pulir las salas): el motor dibuja su cara con marco,
 * título y renglones. El `color` del objeto es el de su superficie. Lo que hace falta para
 * resolver va en la vista 2D, no aquí: la lámina da el título y el aspecto.
 */
const lamina = z.strictObject({
  tipo: z.enum(TIPOS_LAMINA),
  /** Título con letra grande y clara. */
  titulo: z.string().trim().min(1).max(28).optional(),
  /**
   * Opcional: renglones de texto corto. Sin ellos se dibujan garabatos. En la planilla, `|`
   * separa columnas; en el marcador, cada línea es un tablero («LOCAL 12» o «12»: solo
   * dígitos, «:» y «-» al final); en la cuadrícula, solo dos (eje horizontal y vertical).
   */
  lineas: z.array(z.string().trim().min(1).max(32)).min(1).max(8).optional(),
});

export const esquemaObjeto = z.strictObject({
  id: idObjeto,
  /** Nombre que se ve en el botón del HUD; obligatorio si el objeto tiene acción. */
  nombre: z.string().trim().min(1).max(40).optional(),
  forma: z.enum(FORMAS),
  tam: tam3,
  pos: vec3,
  giro: metros.optional(),
  color,
  /** El jugador no lo atraviesa. */
  solido: z.boolean().optional(),
  /** Si se puede tocar: qué dice el botón contextual del HUD. */
  accion: z.enum(ACCIONES).optional(),
  /** Si es una puerta: a dónde lleva. */
  puerta: z.enum(LUGARES).optional(),
  /**
   * Opcional (pasillos): si es una puerta falsa del pasillo, el id de su frase en
   * `src/content/puertas-falsas.json`. Está cerrada: tocarla solo da la frase.
   */
  falsa: z.string().regex(ID_FRASE).optional(),
  /** Piezas de un grupo (por ejemplo, los cinco carritos). */
  partes: z.array(pieza).min(1).optional(),
  /** Modelo CC0 del manifiesto que reemplaza a la primitiva (T19d). */
  modelo: idModelo.optional(),
  /** Opcional: lámina legible dibujada por código en su cara (planos y hojas). */
  lamina: lamina.optional(),
  /**
   * Opcional: pieza por código que reemplaza a la primitiva (`src/engine/salas/piezas/`), con
   * más detalle y en una sola malla. Cabe en `tam`; la forma queda de respaldo.
   */
  pieza: idModelo.optional(),
});

/**
 * Id de una textura de color en el manifiesto (T19g): `<carpeta>/<nombre>`, el archivo
 * `public/assets/salas/<carpeta>/<nombre>.<hash>.ktx2` sin el hash ni la extensión. La carpeta
 * es un lugar o `compartido` (las de ambientCG sirven para todas las salas).
 */
export const ID_TEXTURA = /^(compartido|porteria|s[1-5]-[a-z]+)\/[a-z0-9]+(-[a-z0-9]+)*$/;

const idTextura = z
  .string()
  .regex(ID_TEXTURA, 'Id del manifiesto: <carpeta>/<nombre>, por ejemplo compartido/piso-madera');

/** Cómo está una lámpara de techo (T19k). La que titila baja de vez en cuando, nunca a negro. */
export const ESTADOS_LAMPARA = ['encendida', 'apagada', 'titila'] as const;
export type EstadoLampara = (typeof ESTADOS_LAMPARA)[number];

/** Paredes por su lado: norte en −Z, sur en +Z, oeste en −X y este en +X. */
export const PAREDES = ['norte', 'sur', 'oeste', 'este'] as const;

/** Un intervalo [desde, hasta] en metros, con desde < hasta. */
const intervalo = z
  .tuple([metros, metros])
  .refine(([a, b]) => a < b, 'El intervalo va de menor a mayor: [desde, hasta]');

/**
 * Un tramo de piso que se suma al rectángulo de la sala (pasillos, `docs/pasillos.md`): de
 * `x[0]` a `x[1]` y de `z[0]` a `z[1]`, en las coordenadas de la sala. El motor pone piso y techo
 * en cada tramo y levanta las paredes solo en el borde de la unión: donde un tramo toca a otro o
 * a la sala, queda abierto.
 */
const tramo = z.strictObject({ x: intervalo, z: intervalo });

/** Una ventana alta en una pared (T19k): el vidrio, sin contar el marco. */
const ventana = z.strictObject({
  pared: z.enum(PAREDES),
  /** Centro a lo largo de la pared: x en norte y sur, z en oeste y este. */
  centro: metros,
  /** Borde de abajo del vidrio. */
  y: positivo,
  ancho: positivo,
  alto: positivo,
  /** Si en esta ventana se ve la luna. */
  luna: z.boolean().optional(),
});

export const esquemaSala = z.strictObject({
  id: z.enum(LUGARES),
  nombre: z.string().trim().min(1).max(40),
  ancho: positivo,
  fondo: positivo,
  alto: positivo,
  colores: z.strictObject({ piso: color, paredes: color, techo: color }),
  /**
   * Opcional (T19g): textura de color (KTX2 de 1024, repetida) para el piso, las paredes y el
   * techo. Sin textura, o si no se puede cargar, queda el color de `colores`.
   */
  texturas: z
    .strictObject({
      piso: idTextura.optional(),
      paredes: idTextura.optional(),
      techo: idTextura.optional(),
      /** Metros que cubre una repetición (por defecto, 2: `METROS_POR_REPETICION` en el motor). */
      metros: positivo.optional(),
      /**
       * Opcional (T19k): color que tiñe la textura de cada superficie (multiplica). Sin tinte,
       * la textura se ve con sus colores, igual en todas las salas.
       */
      tinte: z
        .strictObject({
          piso: color.optional(),
          paredes: color.optional(),
          techo: color.optional(),
        })
        .optional(),
    })
    .optional(),
  /**
   * Opcional (T19k): la luz de la sala. Siempre son las mismas dos luces (hemisférica y
   * direccional), porque cambiar de juego de luces recompila los shaders al pasar de sala; aquí
   * cambian sus colores, su fuerza, de dónde viene la direccional y la exposición del tono.
   * Sin este campo, la luz de T19i.
   */
  luz: z
    .strictObject({
      /** Color de lo que mira hacia arriba (cielo) y hacia abajo (suelo) de la hemisférica. */
      cielo: color,
      suelo: color,
      fuerza: positivo,
      direccional: color,
      fuerzaDireccional: positivo,
      /** Dónde está la direccional, en metros desde el centro de la sala; apunta al centro. */
      desde: vec3.optional(),
      /** Exposición del tono (`toneMappingExposure`); el ajuste «Brillo» la multiplica. */
      exposicion: positivo,
    })
    .optional(),
  /**
   * Opcional (T19j): acabados por código, para que la sala no se vea como una caja. Zócalo
   * pintado en la parte baja de las paredes con su franja, rodapié y cornisa; marcos en las
   * puertas y los tableros; lámparas de techo con su brillo y rincones oscurecidos.
   */
  acabados: z
    .strictObject({
      /** Pintura de la parte baja de las paredes. */
      zocalo: color,
      /** La línea que separa el zócalo del resto de la pared. */
      franja: color,
      /** Rodapié y marcos de puertas y tableros. */
      marcos: color,
      /**
       * Opcional (T19k): cómo está cada lámpara de techo, en el orden en que se reparten a lo
       * largo de la sala (de −X a +X o de −Z a +Z). Las que falten, encendidas.
       */
      lamparas: z.array(z.enum(ESTADOS_LAMPARA)).optional(),
      /** Opcional (T19k): ventanas altas con el cielo de noche, hechas por código. */
      ventanas: z.array(ventana).optional(),
    })
    .optional(),
  /**
   * Opcional (pasillos): tramos de piso que se suman a la sala, con la misma altura. Las
   * lámparas de cada tramo siguen en `acabados.lamparas` después de las de la sala.
   */
  tramos: z.array(tramo).min(1).optional(),
  /** Dónde aparece el jugador al entrar y hacia dónde mira (grados, 0 = hacia −Z). */
  inicio: z.strictObject({ x: metros, z: metros, giro: metros }),
  objetos: z.array(esquemaObjeto).min(1),
});

export type ObjetoSala = z.infer<typeof esquemaObjeto>;
export type Sala = z.infer<typeof esquemaSala>;
export type PiezaObjeto = z.infer<typeof pieza>;
export type Tramo = z.infer<typeof tramo>;

// ---------- Reglas que el esquema no expresa ----------

export interface ProblemaSala {
  sala: string;
  mensaje: string;
}

/** Medio tamaño en x y z de un objeto ya girado (caja envolvente alineada a los ejes). */
export function medioTamano(o: Pick<ObjetoSala, 'forma' | 'tam' | 'giro'>): {
  x: number;
  z: number;
} {
  const [ancho, , fondoBruto] = o.tam;
  const redondo = o.forma === 'cilindro' || o.forma === 'esfera';
  const fondo = redondo ? ancho : o.forma === 'plano' ? 0.03 : fondoBruto;
  const g = ((o.giro ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(g));
  const s = Math.abs(Math.sin(g));
  return { x: (ancho * c + fondo * s) / 2, z: (ancho * s + fondo * c) / 2 };
}

const TOLERANCIA = 0.05;

/** `true` si el punto cae en alguno de los rectángulos, con `margen` metros de holgura. */
function dentro(rects: readonly Rectangulo[], x: number, z: number, margen: number): boolean {
  return rects.some(
    (r) =>
      x >= r.x[0] - margen && x <= r.x[1] + margen && z >= r.z[0] - margen && z <= r.z[1] + margen,
  );
}

/** Metros que dos rectángulos se montan uno sobre otro (0 si solo se tocan o están lejos). */
function solape(a: Rectangulo, b: Rectangulo): number {
  const x = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]);
  const z = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
  return x > 0 && z > 0 ? x * z : 0;
}

/**
 * Una línea del marcador: un rótulo opcional sin números ni signos («LOCAL») y después solo
 * dígitos, «:», «-» o espacios. Sin coma decimal ni «$»: son dígitos de siete segmentos.
 */
export const LINEA_MARCADOR = /^([^\d.,$]*?)\s*([0-9][0-9: -]*)$/;

/** Problemas de una sala: objetos fuera de la sala, ids repetidos o de otra sala, nombres. */
export function problemasDeSala(sala: Sala): ProblemaSala[] {
  const problemas: ProblemaSala[] = [];
  const reportar = (mensaje: string) => problemas.push({ sala: sala.id, mensaje });
  const prefijos = sala.id === 'porteria' ? ['porteria-', 'pasillo-'] : [`${sala.id.slice(0, 2)}-`];
  const rects = rectangulosDe(sala);
  const vistos = new Set<string>();

  for (const o of sala.objetos) {
    if (!prefijos.some((p) => o.id.startsWith(p))) {
      reportar(`${o.id}: los ids de esta sala empiezan por «${prefijos.join('» o «')}»`);
    }
    if (vistos.has(o.id)) reportar(`${o.id}: id repetido`);
    vistos.add(o.id);
    if (o.accion && !o.nombre) reportar(`${o.id}: un objeto con acción necesita nombre`);
    if (o.puerta && o.accion !== 'usar') reportar(`${o.id}: una puerta se usa («accion»: «usar»)`);
    if (o.puerta === sala.id) reportar(`${o.id}: la puerta lleva a la misma sala`);
    if (o.falsa && (o.puerta || o.accion !== 'usar')) {
      reportar(`${o.id}: una puerta falsa se usa («accion»: «usar») y no lleva a ninguna sala`);
    }
    if ((o.forma === 'grupo') !== Boolean(o.partes)) {
      reportar(`${o.id}: un grupo necesita «partes» y solo un grupo las lleva`);
    }
    if (o.lamina && o.forma !== 'plano' && o.forma !== 'caja') {
      reportar(`${o.id}: una lámina va en un plano o en una caja`);
    }
    if (o.lamina && (o.modelo || o.pieza)) {
      reportar(`${o.id}: una lámina no lleva modelo ni pieza: se dibuja en la primitiva`);
    }
    if (o.pieza && o.modelo) reportar(`${o.id}: una pieza por código no lleva modelo`);
    const lineas = o.lamina?.lineas ?? [];
    if (o.lamina?.tipo === 'marcador') {
      for (const l of lineas.filter((x) => !LINEA_MARCADOR.test(x))) {
        reportar(`${o.id}: «${l}» no cabe en el marcador (rótulo y dígitos, «LOCAL 12»)`);
      }
    }
    if (o.lamina?.tipo === 'cuadricula' && lineas.length > 2) {
      reportar(`${o.id}: la cuadrícula solo dibuja dos líneas (eje horizontal y vertical)`);
    }

    const m = medioTamano(o);
    const [x, y, z] = o.pos;
    // Las cuatro esquinas de su huella y el centro deben caer en el piso de la sala o de un
    // tramo (en una sala sin tramos, lo mismo que estar dentro del rectángulo).
    const huella: [number, number][] = [
      [x, z],
      [x - m.x, z - m.z],
      [x + m.x, z - m.z],
      [x - m.x, z + m.z],
      [x + m.x, z + m.z],
    ];
    const fuera =
      huella.some(([a, b]) => !dentro(rects, a, b, TOLERANCIA)) ||
      y < -TOLERANCIA ||
      y + o.tam[1] > sala.alto + TOLERANCIA;
    if (fuera && o.forma !== 'grupo') reportar(`${o.id}: queda fuera de la sala`);
  }

  const { x, z } = sala.inicio;
  if (Math.abs(x) > sala.ancho / 2 - 0.3 || Math.abs(z) > sala.fondo / 2 - 0.3) {
    reportar('el punto de inicio queda fuera de la sala o pegado a una pared');
  }

  rects.forEach((a, i) => {
    rects.slice(i + 1).forEach((b, k) => {
      const nombre = (n: number) => (n === 0 ? 'la sala' : `el tramo ${n}`);
      if (solape(a, b) > 1e-6) reportar(`${nombre(i)} y ${nombre(i + k + 1)} se montan`);
    });
  });
  if (sala.tramos && sala.id !== 'porteria') {
    reportar('solo la portería tiene tramos de pasillo');
  }

  const puertas = sala.objetos.filter((o) => o.puerta).map((o) => o.puerta);
  if (sala.id === 'porteria') {
    for (const destino of LUGARES.filter((l) => l !== 'porteria')) {
      if (!puertas.includes(destino)) reportar(`falta la puerta a ${destino}`);
    }
  } else if (!puertas.includes('porteria')) {
    reportar('falta la puerta de vuelta a la portería');
  }
  return problemas;
}

/** Problemas de todo el archivo: las seis salas, una vez cada una. */
export function problemasDeSalas(salas: readonly Sala[]): ProblemaSala[] {
  const problemas = salas.flatMap(problemasDeSala);
  for (const lugar of LUGARES) {
    const n = salas.filter((s) => s.id === lugar).length;
    if (n !== 1) problemas.push({ sala: lugar, mensaje: `aparece ${n} veces; debe aparecer una` });
  }
  return problemas;
}

/** Esquema del archivo completo, con las reglas cruzadas. */
export const esquemaSalas = z.array(esquemaSala).superRefine((salas, ctx) => {
  for (const p of problemasDeSalas(salas)) {
    ctx.addIssue({ code: 'custom', message: `${p.sala}: ${p.mensaje}` });
  }
});

/** Una sala con sus reglas propias (para la colección de Astro, que valida sala por sala). */
export const esquemaSalaValidada = esquemaSala.superRefine((sala, ctx) => {
  for (const p of problemasDeSala(sala)) ctx.addIssue({ code: 'custom', message: p.mensaje });
});
