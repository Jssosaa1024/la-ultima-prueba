import { z } from 'astro/zod';

/**
 * Esquema de un puzzle (T21, especificación v1.2, sección 2).
 *
 * Cada sala es una máquina con una regla matemática que el jugador descubre manipulándola.
 * Un puzzle tiene tres etapas (presentar, torcer, dominar); cada etapa trae su estado
 * inicial, los controles que el jugador puede mover, la condición de éxito y una solución
 * de ejemplo. No hay opciones ni distractores.
 *
 * Este archivo lo usa `src/content.config.ts` para validar en build los JSON de
 * `src/content/puzzles/`. `game/` solo importa sus TIPOS (`import type`), para no meter zod
 * en el bundle del juego.
 */

export const ETAPAS = ['presentar', 'torcer', 'dominar'] as const;
export type EtapaId = (typeof ETAPAS)[number];

export const TEMAS = [
  'porcentajes',
  'funciones_lineales',
  'semejanza_tangente',
  'medidas_estadisticas',
  'probabilidad_sin_reemplazo',
] as const;

/**
 * Procesos generales de los Estándares Básicos de Competencias en Matemáticas del MEN (2006):
 * formular y resolver problemas; modelar procesos y fenómenos de la realidad; comunicar;
 * razonar; y formular, comparar y ejercitar procedimientos.
 */
export const PROCESOS = [
  'formular_resolver',
  'modelar',
  'comunicar',
  'razonar',
  'procedimientos',
] as const;

export const MECANISMOS = ['etiquetadora', 'tanques', 'reflector', 'carritos', 'urna'] as const;
export type Mecanismo = (typeof MECANISMOS)[number];

/** Cada sala tiene una máquina fija. */
export const MECANISMO_POR_SALA: Readonly<Record<number, Mecanismo>> = {
  1: 'etiquetadora',
  2: 'tanques',
  3: 'reflector',
  4: 'carritos',
  5: 'urna',
};

export const ROLES = ['A', 'B', 'C', 'D'] as const;

// ---------- Piezas comunes ----------

const texto = (max: number) => z.string().trim().min(1).max(max);
const entero = () => z.number().int();
/** Ids de objetos y postes: minúsculas, números y guiones. */
const idSimple = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const idObjetoSala = z.string().regex(/^s[1-5]-[a-z0-9]+(-[a-z0-9]+)*$/);

const pista = z.strictObject({
  nivel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Se ofrece tras N segundos en la etapa actual… */
  tras_segundos: entero().min(0),
  /** …o tras N intentos fallidos en ella, lo que pase primero. */
  tras_intentos: entero().min(1).optional(),
  texto: texto(160),
});

const pistaRol = z.strictObject({ objeto: idObjetoSala, texto: texto(160) });

const comunes = {
  id: z.string().regex(/^s[1-5]-[a-z0-9]+(-[a-z0-9]+)*$/),
  version: entero().min(1),
  sala: entero().min(1).max(5),
  titulo: texto(60),
  tema: z.enum(TEMAS),
  proceso: z.enum(PROCESOS),
  /** Grado en que se estudia el concepto que nombra el cuaderno. */
  grado: z.union([z.literal(9), z.literal(10), z.literal(11)]),
  dificultad: entero().min(1).max(3),
  concepto: texto(200),
  intuicion: texto(160),
  pistas: z.array(pista).length(3),
  cuaderno: z.strictObject({ concepto: texto(80), texto: texto(300) }),
  pista_por_jugador: z.strictObject({ A: pistaRol, B: pistaRol, C: pistaRol, D: pistaRol }),
};

function etapa<E extends z.ZodType, C extends z.ZodType, X extends z.ZodType>(
  estado: E,
  controles: C,
  exito: X,
) {
  return z.strictObject({
    id: z.enum(ETAPAS),
    situacion: texto(280),
    aja: texto(200),
    estado_inicial: estado,
    controles,
    exito,
    solucion: estado,
  });
}

// ---------- Sala 1 · La etiquetadora ----------

const estadoEtiquetadora = z.strictObject({
  producto: idSimple,
  /** Precio de la etiqueta en pesos. */
  precio: entero().positive(),
  /** Rodillos puestos en la máquina, en porcentaje (−20 = baja 20 %). */
  rodillos: z.array(entero()),
});
const controlesEtiquetadora = z.strictObject({
  /** La caja de rodillos: cada uno es un cambio de p % (p > −100). */
  rodillos: z.array(entero().min(-99).max(500)).min(1),
  max_rodillos: entero().min(1).max(3),
});
const exitoEtiquetadora = z.strictObject({
  /** El precio de la pizarra: la etiqueta impresa debe dar exactamente esto. */
  precio: entero().positive(),
});

// ---------- Sala 2 · Los tanques ----------

const tanque = z.strictObject({
  /** Altura del líquido en cm al empezar la corrida. */
  nivel: entero().min(0),
  /** cm por segundo; negativo si se vacía. */
  caudal: entero(),
  /** Falso si el tanque está tapado y no se ve su nivel. */
  visible: z.boolean(),
  /** Marcas de un registro anterior (la hoja de ayer): segundo y altura. */
  registro: z.array(z.strictObject({ t: entero().min(0), nivel: entero().min(0) })).optional(),
});
const estadoTanques = z.strictObject({ a: tanque, b: tanque.nullable() });
const controlesTanques = z.strictObject({
  /** Perillas que se pueden girar en la etapa; las demás están bloqueadas. */
  perillas: z.array(z.enum(['a', 'b'])).min(1),
  caudal_min: entero(),
  caudal_max: entero(),
  altura_cm: entero().positive(),
});
const exitoTanques = z.strictObject({
  /** Segundo en que suena la campana. */
  campana_s: entero().positive(),
  objetivo: z.discriminatedUnion('tipo', [
    z.strictObject({ tipo: z.literal('linea'), nivel: entero().min(0) }),
    z.strictObject({ tipo: z.literal('cruce') }),
  ]),
});

// ---------- Sala 3 · El reflector ----------

const poste = z.strictObject({
  id: idSimple,
  /** Metros. */
  altura: entero().positive(),
  /** Metros entre la base del poste y su sensor; null si no tiene sensor. */
  distancia: entero().min(0).nullable(),
});
const estadoReflector = z.strictObject({
  /** Inclinación del reflector, en grados. */
  muesca: entero().min(1).max(89),
  postes: z.array(poste),
  /** Longitud soltada de la polea, en metros; null si la etapa no tiene polea. */
  polea: entero().min(0).nullable(),
});
const rango = z.strictObject({ min: entero().min(0), max: entero().min(0) });
const controlesReflector = z.strictObject({
  muescas: z.array(entero().min(1).max(89)).min(1),
  /** Si el reflector se puede inclinar en esta etapa. */
  girar: z.boolean(),
  postes_moviles: z.array(idSimple),
  distancia_min: entero().min(0),
  distancia_max: entero().min(0),
  polea: rango.nullable(),
});
const exitoReflector = z.strictObject({
  /** Postes cuya sombra debe tocar su sensor. */
  sensores: z.array(idSimple),
  /** Si existe, la polea debe soltar exactamente la altura del marcador. */
  marcador: z.strictObject({ altura: entero().positive() }).nullable(),
});

// ---------- Sala 4 · Los carritos ----------

const estadoCarritos = z.strictObject({
  /** Libros en cada carrito, de lunes a viernes. */
  carritos: z.array(entero().min(0)).min(1),
});
const controlesCarritos = z.strictObject({
  carritos: entero().min(1).max(7),
  libros: entero().positive(),
});
const exitoCarritos = z.strictObject({
  /** Lámparas encendidas en la etapa y el valor que muestra cada una. */
  lamparas: z
    .strictObject({
      media: z.number().min(0).optional(),
      mediana: z.number().min(0).optional(),
      moda: entero().min(0).optional(),
      rango: entero().min(0).optional(),
    })
    .refine((l) => Object.keys(l).length > 0, 'Debe haber al menos una lámpara encendida'),
});

// ---------- Sala 5 · La urna ----------

const estadoUrna = z.strictObject({ azules: entero().min(0), amarillas: entero().min(0) });
const controlesUrna = z.strictObject({ max_por_color: entero().min(1).max(20) });
const exitoUrna = z.strictObject({
  /** Total de fichas que pide la placa. */
  fichas: entero().min(2),
  juego: z.enum(['siempre_gana', 'justo']),
});

// ---------- Puzzle ----------

function variante<
  M extends Mecanismo,
  E extends z.ZodType,
  C extends z.ZodType,
  X extends z.ZodType,
>(mecanismo: M, estado: E, controles: C, exito: X) {
  return z.strictObject({
    ...comunes,
    mecanismo: z.literal(mecanismo),
    etapas: z.array(etapa(estado, controles, exito)).length(3),
  });
}

/** Esquema por campo, sin las validaciones cruzadas. */
export const esquemaPuzzleBase = z.discriminatedUnion('mecanismo', [
  variante('etiquetadora', estadoEtiquetadora, controlesEtiquetadora, exitoEtiquetadora),
  variante('tanques', estadoTanques, controlesTanques, exitoTanques),
  variante('reflector', estadoReflector, controlesReflector, exitoReflector),
  variante('carritos', estadoCarritos, controlesCarritos, exitoCarritos),
  variante('urna', estadoUrna, controlesUrna, exitoUrna),
]);

export type Puzzle = z.infer<typeof esquemaPuzzleBase>;
export type PuzzleDe<M extends Mecanismo> = Extract<Puzzle, { mecanismo: M }>;
export type EtapaDe<M extends Mecanismo> = PuzzleDe<M>['etapas'][number];
export type EstadoDe<M extends Mecanismo> = EtapaDe<M>['solucion'];
export type ControlesDe<M extends Mecanismo> = EtapaDe<M>['controles'];
export type ExitoDe<M extends Mecanismo> = EtapaDe<M>['exito'];

// ---------- Validaciones cruzadas ----------

export interface Problema {
  ruta: (string | number)[];
  mensaje: string;
}

type Reportar = (ruta: (string | number)[], mensaje: string) => void;

const iguales = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Reglas que el esquema por campo no expresa. Devuelve la lista de problemas (vacía si el
 * puzzle está bien). La usa `esquemaPuzzle` y se puede probar sola.
 */
export function problemasDelPuzzle(p: Puzzle): Problema[] {
  const problemas: Problema[] = [];
  const reportar: Reportar = (ruta, mensaje) => problemas.push({ ruta, mensaje });

  if (!p.id.startsWith(`s${p.sala}-`)) {
    reportar(
      ['id'],
      `El id debe empezar por «s${p.sala}-» porque el puzzle es de la sala ${p.sala}`,
    );
  }
  if (MECANISMO_POR_SALA[p.sala] !== p.mecanismo) {
    reportar(['mecanismo'], `La sala ${p.sala} usa el mecanismo «${MECANISMO_POR_SALA[p.sala]}»`);
  }

  p.etapas.forEach((e, i) => {
    if (e.id !== ETAPAS[i])
      reportar(['etapas', i, 'id'], `La etapa ${i + 1} debe ser «${ETAPAS[i]}»`);
  });

  p.pistas.forEach((pi, i) => {
    if (pi.nivel !== i + 1)
      reportar(['pistas', i, 'nivel'], `La pista ${i + 1} debe ser de nivel ${i + 1}`);
    const anterior = p.pistas[i - 1];
    if (!anterior) return;
    if (pi.tras_segundos <= anterior.tras_segundos) {
      reportar(['pistas', i, 'tras_segundos'], 'tras_segundos debe crecer con el nivel');
    }
    if ((pi.tras_intentos === undefined) !== (anterior.tras_intentos === undefined)) {
      reportar(['pistas', i, 'tras_intentos'], 'tras_intentos va en las tres pistas o en ninguna');
    } else if (
      pi.tras_intentos !== undefined &&
      anterior.tras_intentos !== undefined &&
      pi.tras_intentos <= anterior.tras_intentos
    ) {
      reportar(['pistas', i, 'tras_intentos'], 'tras_intentos debe crecer con el nivel');
    }
  });

  for (const rol of ROLES) {
    const { objeto } = p.pista_por_jugador[rol];
    if (!objeto.startsWith(`s${p.sala}-`)) {
      reportar(['pista_por_jugador', rol, 'objeto'], `El objeto debe ser de la sala ${p.sala}`);
    }
  }

  const enEtapa =
    (i: number): Reportar =>
    (ruta, mensaje) =>
      reportar(['etapas', i, ...ruta], mensaje);
  switch (p.mecanismo) {
    case 'etiquetadora':
      p.etapas.forEach((e, i) => revisarEtiquetadora(e, enEtapa(i)));
      break;
    case 'tanques':
      p.etapas.forEach((e, i) => revisarTanques(e, enEtapa(i)));
      break;
    case 'reflector':
      p.etapas.forEach((e, i) => revisarReflector(e, enEtapa(i)));
      break;
    case 'carritos':
      p.etapas.forEach((e, i) => revisarCarritos(e, enEtapa(i)));
      break;
    case 'urna':
      p.etapas.forEach((e, i) => revisarUrna(e, enEtapa(i)));
      break;
  }

  return problemas;
}

const ESTADOS = ['estado_inicial', 'solucion'] as const;

function revisarEtiquetadora(e: EtapaDe<'etiquetadora'>, r: Reportar): void {
  const { rodillos, max_rodillos } = e.controles;
  if (new Set(rodillos).size !== rodillos.length)
    r(['controles', 'rodillos'], 'Rodillos repetidos en la caja');
  for (const cual of ESTADOS) {
    const estado = e[cual];
    if (estado.rodillos.length > max_rodillos)
      r([cual, 'rodillos'], `Máximo ${max_rodillos} rodillos`);
    if (new Set(estado.rodillos).size !== estado.rodillos.length) {
      r([cual, 'rodillos'], 'Un rodillo no se puede poner dos veces');
    }
    if (estado.rodillos.some((x) => !rodillos.includes(x))) {
      r([cual, 'rodillos'], 'Hay un rodillo que no está en la caja');
    }
  }
  if (
    e.solucion.producto !== e.estado_inicial.producto ||
    e.solucion.precio !== e.estado_inicial.precio
  ) {
    r(['solucion'], 'La solución solo puede cambiar los rodillos');
  }
}

function revisarTanques(e: EtapaDe<'tanques'>, r: Reportar): void {
  const c = e.controles;
  if (c.caudal_min > c.caudal_max) r(['controles'], 'caudal_min no puede ser mayor que caudal_max');
  if (e.exito.objetivo.tipo === 'linea' && e.exito.objetivo.nivel > c.altura_cm) {
    r(['exito', 'objetivo', 'nivel'], 'La línea queda por encima del tanque');
  }
  for (const cual of ESTADOS) {
    const estado = e[cual];
    if (e.exito.objetivo.tipo === 'cruce' && estado.b === null) {
      r([cual, 'b'], 'Para un cruce se necesitan los dos tanques');
    }
    for (const id of ['a', 'b'] as const) {
      const t = estado[id];
      if (!t) {
        if (c.perillas.includes(id)) r([cual, id], `La perilla «${id}» no tiene tanque`);
        continue;
      }
      if (t.nivel > c.altura_cm) r([cual, id, 'nivel'], 'El nivel supera la altura del tanque');
      if (c.perillas.includes(id) && (t.caudal < c.caudal_min || t.caudal > c.caudal_max)) {
        r([cual, id, 'caudal'], 'El caudal está fuera del rango de la perilla');
      }
    }
  }
  for (const id of ['a', 'b'] as const) {
    const antes = e.estado_inicial[id];
    const despues = e.solucion[id];
    const fijo = c.perillas.includes(id) ? { ...antes, caudal: 0 } : antes;
    const final = c.perillas.includes(id) && despues ? { ...despues, caudal: 0 } : despues;
    if (!iguales(fijo, final))
      r(['solucion', id], 'La solución solo puede girar las perillas de la etapa');
  }
}

function revisarReflector(e: EtapaDe<'reflector'>, r: Reportar): void {
  const c = e.controles;
  if (c.distancia_min > c.distancia_max)
    r(['controles'], 'distancia_min no puede ser mayor que distancia_max');
  if (c.polea && c.polea.min > c.polea.max)
    r(['controles', 'polea'], 'polea.min no puede ser mayor que polea.max');
  const ids = e.estado_inicial.postes.map((x) => x.id);
  if (new Set(ids).size !== ids.length) r(['estado_inicial', 'postes'], 'Postes con id repetido');
  for (const id of c.postes_moviles) {
    if (!ids.includes(id)) r(['controles', 'postes_moviles'], `No existe el poste «${id}»`);
  }
  for (const id of e.exito.sensores) {
    const x = e.estado_inicial.postes.find((y) => y.id === id);
    if (!x || x.distancia === null) r(['exito', 'sensores'], `El poste «${id}» no tiene sensor`);
  }
  if ((e.exito.marcador === null) !== (c.polea === null)) {
    r(['exito', 'marcador'], 'El marcador y la polea van juntos');
  }
  for (const cual of ESTADOS) {
    const estado = e[cual];
    if (!c.muescas.includes(estado.muesca))
      r([cual, 'muesca'], 'Esa muesca no existe en el reflector');
    if ((estado.polea === null) !== (c.polea === null))
      r([cual, 'polea'], 'La polea no coincide con los controles');
    if (
      estado.polea !== null &&
      c.polea &&
      (estado.polea < c.polea.min || estado.polea > c.polea.max)
    ) {
      r([cual, 'polea'], 'La polea está fuera de su rango');
    }
    estado.postes.forEach((x, j) => {
      if (
        c.postes_moviles.includes(x.id) &&
        (x.distancia === null || x.distancia < c.distancia_min || x.distancia > c.distancia_max)
      ) {
        r([cual, 'postes', j, 'distancia'], 'El poste móvil está fuera del riel');
      }
    });
  }
  const sinMover = (estado: EstadoDe<'reflector'>) => ({
    muesca: c.girar ? 0 : estado.muesca,
    polea: c.polea ? 0 : estado.polea,
    postes: estado.postes.map((x) =>
      c.postes_moviles.includes(x.id) ? { ...x, distancia: 0 } : x,
    ),
  });
  if (!iguales(sinMover(e.estado_inicial), sinMover(e.solucion))) {
    r(['solucion'], 'La solución solo puede cambiar lo que permiten los controles');
  }
}

function revisarCarritos(e: EtapaDe<'carritos'>, r: Reportar): void {
  for (const cual of ESTADOS) {
    const { carritos } = e[cual];
    if (carritos.length !== e.controles.carritos) {
      r([cual, 'carritos'], `Debe haber ${e.controles.carritos} carritos`);
    }
    const total = carritos.reduce((s, x) => s + x, 0);
    if (total > e.controles.libros) r([cual, 'carritos'], `Solo hay ${e.controles.libros} libros`);
  }
}

function revisarUrna(e: EtapaDe<'urna'>, r: Reportar): void {
  for (const cual of ESTADOS) {
    const { azules, amarillas } = e[cual];
    if (azules > e.controles.max_por_color || amarillas > e.controles.max_por_color) {
      r([cual], `Máximo ${e.controles.max_por_color} fichas por color`);
    }
  }
  if (e.exito.fichas > 2 * e.controles.max_por_color) {
    r(['exito', 'fichas'], 'Los dispensadores no alcanzan para esa cantidad de fichas');
  }
}

/** Esquema completo: por campo y con las validaciones cruzadas. */
export const esquemaPuzzle = esquemaPuzzleBase.superRefine((p, ctx) => {
  for (const { ruta, mensaje } of problemasDelPuzzle(p)) {
    ctx.addIssue({ code: 'custom', path: ruta, message: mensaje });
  }
});
