import { z } from 'astro/zod';

/**
 * Esquema del guion de La Voz (T34a): cada cosa que La Voz dice en la partida, con su id.
 *
 * `src/content/guion.json` trae una línea por entrada: la portería, la entrada y el sello de
 * cada sala, la espera, el tercer intento fallido, las tres grabaciones y los cuatro finales,
 * según `docs/salas-y-puzzles.md` («Guion de La Voz» y «Grabaciones y finales»). Los
 * subtítulos (T34) muestran `texto`; la voz grabada usará el mismo `id` como nombre de
 * archivo, y en el cooperativo viaja solo el id.
 *
 * Este archivo lo usa `src/content.config.ts` para validar el JSON en cada build y
 * `scripts/exportar-guion.ts` para el CSV. Solo importa zod: así corre también con Node,
 * sin Vite. El juego importa únicamente los TIPOS.
 *
 * Reglas (de `docs/salas-y-puzzles.md`): cada línea de La Voz dura menos de 6 segundos (unas
 * 15 palabras), nunca dice la respuesta ni el procedimiento y siempre tiene subtítulo. Cada
 * grabación dura menos de 20 segundos.
 */

/** Dónde suena la línea. `cualquiera` es para las que pueden sonar en cualquier sala. */
export const SALAS_GUION = [
  'porteria',
  's1-cooperativa',
  's2-laboratorio',
  's3-gimnasio',
  's4-biblioteca',
  's5-rectoria',
  'cualquiera',
] as const;
export type SalaGuion = (typeof SALAS_GUION)[number];

/** Las cinco salas, en orden: cada una tiene una línea al entrar y otra al ganar el sello. */
export const SALAS_CON_MAQUINA = SALAS_GUION.slice(1, 6) as readonly Exclude<
  SalaGuion,
  'porteria' | 'cualquiera'
>[];

/** Cuándo suena. */
export const MOMENTOS_GUION = [
  /** Se cierra la puerta de la portería al empezar. */
  'puerta_cerrada',
  /** Primer paso en la portería. */
  'primer_paso',
  /** El jugador mira el reloj de la portería. */
  'mira_reloj',
  /** Entra a una sala por primera vez. */
  'entrar_sala',
  /** Gana el sello de la sala (resuelve la etapa 3). */
  'sello',
  /** 90 s sin interactuar en una sala. */
  'espera',
  /** Tercer intento fallido en una etapa. */
  'fallo',
  /** Llega a la portería con los cinco sellos. */
  'cinco_sellos',
  /** Recoge una grabación (la voz es la del profe Tobías, sin efectos de parlante). */
  'grabacion',
  /** Pantalla de un final. */
  'final',
  /**
   * Pasillos: toca una puerta falsa del pasillo (`src/content/puertas-falsas.json`). Cada línea
   * es la frase de una sola puerta.
   */
  'puerta_falsa',
] as const;
export type MomentoGuion = (typeof MOMENTOS_GUION)[number];

/** Los cuatro finales (los mismos ids de `game/partida.ts`). */
export const FINALES_GUION = [
  'justo_a_tiempo',
  'el_legado',
  'pedir_ayuda',
  'tiempo_cumplido',
] as const;

/**
 * De dónde sale el texto: `salas-y-puzzles` está escrito tal cual en el diseño; `propuesta`
 * lo escribió una sesión porque el diseño no lo trae (los finales). Alex revisa las propuestas.
 */
export const ORIGENES_GUION = ['salas-y-puzzles', 'propuesta'] as const;

/** Límites de duración del diseño, en segundos. */
export const MAX_SEGUNDOS_LINEA = 6;
export const MAX_SEGUNDOS_GRABACION = 20;
/** «Unas 15 palabras» por línea: se acepta una de más. */
export const MAX_PALABRAS_LINEA = 16;
export const MAX_PALABRAS_GRABACION = 50;

/** Ritmo de lectura que se supone para estimar: un profe que habla con calma. */
export const PALABRAS_POR_SEGUNDO = 2.8;

/** Palabras de un texto (los números como «00:40» cuentan como una). */
export function contarPalabras(texto: string): number {
  return texto.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

/**
 * Duración estimada al leer el texto en voz alta, en segundos y redondeada hacia arriba a
 * medio segundo: las palabras al ritmo de `PALABRAS_POR_SEGUNDO` más medio segundo de aire.
 * Cuando exista el audio de verdad, la duración se toma del archivo.
 */
export function duracionEstimada(texto: string): number {
  const segundos = contarPalabras(texto) / PALABRAS_POR_SEGUNDO + 0.5;
  return Math.ceil(segundos * 2) / 2;
}

export const esquemaLineaGuion = z.strictObject({
  /** `voz-…` para La Voz por los parlantes; `grab-1` a `grab-3` para las grabaciones. */
  id: z.string().regex(/^(voz-[a-z0-9]+(-[a-z0-9]+)*|grab-[1-3])$/),
  sala: z.enum(SALAS_GUION),
  momento: z.enum(MOMENTOS_GUION),
  /** Solo en las líneas de un final: cuál. */
  final: z.enum(FINALES_GUION).optional(),
  /** Lo que se oye y lo que dice el subtítulo, palabra por palabra. */
  texto: z.string().trim().min(1).max(300),
  /** Segundos estimados (múltiplo de 0,5). */
  duracion_s: z.number().positive().multipleOf(0.5),
  origen: z.enum(ORIGENES_GUION),
});

export type LineaGuion = z.infer<typeof esquemaLineaGuion>;

// ---------- Reglas que el esquema no expresa ----------

/** En qué sala está escondida cada grabación (`game/partida.ts`, `GRABACION_EN_SALA`). */
const SALA_DE_GRABACION: Readonly<Record<string, SalaGuion>> = {
  'grab-1': 's2-laboratorio',
  'grab-2': 's3-gimnasio',
  'grab-3': 's4-biblioteca',
};

/** Momentos que pasan siempre en la portería. */
const EN_PORTERIA: readonly MomentoGuion[] = [
  'puerta_cerrada',
  'primer_paso',
  'mira_reloj',
  'cinco_sellos',
  'final',
  'puerta_falsa',
];

/** Problemas de una línea sola: sala, momento, id y duración que no cuadran. */
export function problemasDeLinea(l: LineaGuion): string[] {
  const problemas: string[] = [];
  const esGrabacion = l.momento === 'grabacion';

  if (esGrabacion !== l.id.startsWith('grab-')) {
    problemas.push(`«${l.id}»: solo las grabaciones usan los ids grab-1 a grab-3`);
  }
  if (esGrabacion && SALA_DE_GRABACION[l.id] !== l.sala) {
    problemas.push(
      `«${l.id}» está escondida en ${SALA_DE_GRABACION[l.id] ?? '—'}, no en ${l.sala}`,
    );
  }
  if (EN_PORTERIA.includes(l.momento) && l.sala !== 'porteria') {
    problemas.push(`«${l.id}»: el momento «${l.momento}» pasa en la portería`);
  }
  if ((l.momento === 'entrar_sala' || l.momento === 'sello') && !esSalaConMaquina(l.sala)) {
    problemas.push(`«${l.id}»: «${l.momento}» necesita una de las cinco salas`);
  }
  if ((l.momento === 'espera' || l.momento === 'fallo') && l.sala !== 'cualquiera') {
    problemas.push(`«${l.id}»: «${l.momento}» puede sonar en cualquier sala`);
  }
  if ((l.momento === 'final') !== (l.final !== undefined)) {
    problemas.push(`«${l.id}»: «final» va solo, y siempre, en las líneas de un final`);
  }

  const palabras = contarPalabras(l.texto);
  const maxPalabras = esGrabacion ? MAX_PALABRAS_GRABACION : MAX_PALABRAS_LINEA;
  const maxSegundos = esGrabacion ? MAX_SEGUNDOS_GRABACION : MAX_SEGUNDOS_LINEA;
  if (palabras > maxPalabras) {
    problemas.push(`«${l.id}»: ${palabras} palabras; el máximo es ${maxPalabras}`);
  }
  if (l.duracion_s > maxSegundos) {
    problemas.push(`«${l.id}»: dura ${l.duracion_s} s; el máximo es ${maxSegundos} s`);
  }
  const estimada = duracionEstimada(l.texto);
  if (Math.abs(l.duracion_s - estimada) > 1.5) {
    problemas.push(
      `«${l.id}»: dice ${l.duracion_s} s, pero el texto se lee en unos ${estimada} s. ` +
        'Si cambiaste el texto, actualiza duracion_s.',
    );
  }
  return problemas;
}

function esSalaConMaquina(sala: SalaGuion): boolean {
  return (SALAS_CON_MAQUINA as readonly string[]).includes(sala);
}

/**
 * Problemas del guion completo: ids repetidos y momentos que faltan. Cada sala necesita su
 * entrada y su sello, y deben estar las tres grabaciones y los cuatro finales.
 */
export function problemasDelGuion(lineas: readonly LineaGuion[]): string[] {
  const problemas = lineas.flatMap(problemasDeLinea);
  const vistos = new Set<string>();
  for (const l of lineas) {
    if (vistos.has(l.id)) problemas.push(`el id «${l.id}» está repetido`);
    vistos.add(l.id);
  }
  const hay = (momento: MomentoGuion, sala?: SalaGuion): boolean =>
    lineas.some((l) => l.momento === momento && (sala === undefined || l.sala === sala));

  for (const sala of SALAS_CON_MAQUINA) {
    if (!hay('entrar_sala', sala)) problemas.push(`falta la línea al entrar a ${sala}`);
    if (!hay('sello', sala)) problemas.push(`falta la línea del sello de ${sala}`);
  }
  for (const momento of ['puerta_cerrada', 'espera', 'fallo', 'cinco_sellos'] as const) {
    if (!hay(momento)) problemas.push(`falta una línea para «${momento}»`);
  }
  for (const id of Object.keys(SALA_DE_GRABACION)) {
    if (!lineas.some((l) => l.id === id)) problemas.push(`falta la grabación «${id}»`);
  }
  for (const final of FINALES_GUION) {
    if (!lineas.some((l) => l.final === final))
      problemas.push(`falta la línea del final «${final}»`);
  }
  return problemas;
}

/** Una línea con sus reglas propias (la colección de Astro valida línea por línea). */
export const esquemaLineaGuionValidada = esquemaLineaGuion.superRefine((linea, ctx) => {
  for (const mensaje of problemasDeLinea(linea)) ctx.addIssue({ code: 'custom', message: mensaje });
});
