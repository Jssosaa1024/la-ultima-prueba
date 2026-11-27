/**
 * Escenas de la historia (Historia A, 27 de noviembre de 2026): la intro y los tres finales del
 * caso de Don Efraín, dentro del juego, con la portería en Three.js, la cámara guiada, La Voz y
 * subtítulos. Siguen el guion de cámara de `docs/escenas.md`; en lugar de un video, cada plano
 * dice dónde va la cámara, qué tarjeta 2D se ve (las fotos y documentos de 1991, la pantalla de la
 * portería), qué se oye y dónde está Don Efraín.
 *
 * Aquí solo hay datos y funciones puras (sin DOM ni Three): el motor (`engine/escenas/`) mueve la
 * cámara y la interfaz (`ui/escenas/`) muestra las tarjetas y los subtítulos con el mismo reloj.
 * Nada de esto se descarga aparte: la portería ya está en la GPU y Don Efraín, la pantalla y la
 * luz de la puerta son primitivas hechas por código.
 *
 * «También vale pedir ayuda» no tiene escena: es una salida amable, sin giro, y sigue directo a
 * la pantalla de final.
 */

/** Escenas que existen. Los ids de los finales son los de `game/partida.ts`. */
export const ESCENAS = ['intro', 'el_legado', 'justo_a_tiempo', 'tiempo_cumplido'] as const;
export type EscenaId = (typeof ESCENAS)[number];

export function esEscena(id: unknown): id is EscenaId {
  return typeof id === 'string' && (ESCENAS as readonly string[]).includes(id);
}

/** Un punto de la portería en metros: x (este), y (altura), z (sur). */
export type Punto3 = readonly [number, number, number];

/** Dónde está la cámara y hacia qué punto mira. */
export interface Toma {
  pos: Punto3;
  mira: Punto3;
}

/**
 * Las tarjetas 2D: lo que se lee (fotos, documentos y la pantalla de la portería) va en la vista
 * 2D, nunca como textura (AGENTS.md). Las `completa` tapan la escena; las de la pantalla dejan
 * ver la portería alrededor.
 */
export const TARJETAS = [
  'titulo',
  'feria',
  'foto-1991',
  'datos',
  'acta',
  'carpeta',
  'copiando',
  'foto-legado',
  'foto-vieja',
  'reloj',
  'migracion',
] as const;
export type TarjetaId = (typeof TARJETAS)[number];

/** Las tarjetas que tapan la escena (las demás son la pantalla o un cartel). */
export const TARJETAS_COMPLETAS: readonly TarjetaId[] = [
  'titulo',
  'foto-1991',
  'datos',
  'acta',
  'foto-legado',
  'foto-vieja',
];

/**
 * Efectos de `engine/audio/sintesis.ts` que usan las escenas (una prueba revisa que existan).
 * Se repiten aquí como texto para que el contenido no importe del motor.
 */
export type SonidoEscena = 'puerta-cerrada' | 'puerta' | 'clac' | 'casilleros' | 'bip' | 'clic';

/** Cómo está la pantalla de la portería (encima del casillero). */
export type EstadoPantalla = 'apagada' | 'encendida' | 'copiando' | 'borrada';

/** Don Efraín: dónde está parado (en el piso), hacia qué punto mira y si tiene la gorra puesta. */
export interface Efrain {
  x: number;
  z: number;
  mira: readonly [number, number];
  gorra: boolean;
}

export interface Plano {
  /** Segundos. */
  dura: number;
  /** Toma al empezar y, si se mueve, al terminar (con movimiento reducido se usa la final). */
  desde: Toma;
  hasta?: Toma;
  tarjeta?: TarjetaId;
  /** Texto en pantalla que no es voz (la narración de la intro, por ejemplo). */
  texto?: string;
  /** Línea de La Voz (id de `guion.json`): suena y se subtitula. */
  voz?: string;
  /** Lo que dice Don Efraín: solo subtítulo (no tiene voz grabada; decisión pendiente de Alex). */
  efrainDice?: string;
  sonido?: SonidoEscena;
  /** La puerta de salida abierta: un rectángulo de luz de la calle (Don Efraín, a contraluz). */
  puerta?: boolean;
  pantalla?: EstadoPantalla;
  /** `null` o ausente: no está. */
  efrain?: Efrain | null;
  /** Termina en negro: el fundido al resumen o al juego. */
  fundido?: boolean;
}

export interface Escena {
  id: EscenaId;
  /** Nombre para el lector de pantalla. */
  nombre: string;
  planos: readonly Plano[];
}

/** La altura de los ojos del jugador (`engine/motor.ts`). */
const OJOS = 1.6;
/**
 * Donde empieza la partida en la portería (`salas.json`, `inicio`), mirando a la salida y
 * 0,12 rad hacia abajo, como `PITCH_INICIAL` del motor.
 */
const INICIO: Toma = { pos: [0, OJOS, 4.2], mira: [0, OJOS - 9.2 * Math.tan(0.12), -5] };
/** Puntos de la portería (`salas.json`). */
const CASILLERO: Punto3 = [2, 1.05, -4.7];
const PUERTA: Punto3 = [0, 1.35, -5];
const RELOJ: Punto3 = [0, 2.55, -4.98];
/** La pantalla de la portería: un monitor sobre el casillero (prop de la escena). */
export const PANTALLA: Punto3 = [2, 2.12, -4.62];
/** Don Efraín mirando hacia el jugador (al sur). */
const AL_SUR: readonly [number, number] = [0, 5];

const INTRO: Escena = {
  id: 'intro',
  nombre: 'Intro: el caso de 1991',
  planos: [
    {
      dura: 4,
      desde: { pos: [0, OJOS, 4.6], mira: CASILLERO },
      tarjeta: 'titulo',
      pantalla: 'apagada',
    },
    {
      dura: 6,
      desde: { pos: [-1.6, 1.75, 4.6], mira: CASILLERO },
      hasta: { pos: [-0.6, 1.65, 3.2], mira: CASILLERO },
      tarjeta: 'feria',
      texto:
        'Mañana presentas tu proyecto en la feria de ciencias. Tu memoria USB se quedó adentro.',
      pantalla: 'apagada',
    },
    {
      dura: 6.5,
      desde: { pos: [-0.6, 1.65, 3.2], mira: CASILLERO },
      tarjeta: 'foto-1991',
      voz: 'voz-intro-caso-1',
    },
    {
      dura: 7,
      desde: { pos: [-0.6, 1.65, 3.2], mira: CASILLERO },
      tarjeta: 'datos',
      voz: 'voz-intro-caso-2',
    },
    {
      dura: 6,
      desde: { pos: [-0.6, 1.65, 3.2], mira: CASILLERO },
      tarjeta: 'acta',
      voz: 'voz-intro-caso-3',
      sonido: 'clac',
    },
    {
      dura: 5.5,
      desde: { pos: [0.9, 1.95, -2.4], mira: PANTALLA },
      hasta: { pos: [1.5, 2.15, -3.5], mira: PANTALLA },
      tarjeta: 'carpeta',
      voz: 'voz-intro-caso-4',
      pantalla: 'encendida',
    },
    {
      dura: 3.5,
      desde: { pos: [0, OJOS, 4.85], mira: CASILLERO },
      hasta: { pos: [0, OJOS, 4.2], mira: CASILLERO },
      pantalla: 'encendida',
    },
    {
      // Detrás, la puerta automática se cierra (se oye; la entrada no se ve).
      dura: 2.5,
      desde: { pos: [0, OJOS, 4.2], mira: CASILLERO },
      sonido: 'puerta-cerrada',
      pantalla: 'encendida',
    },
    {
      // Mira hacia la salida, donde empieza la partida. Al terminar, corte al juego.
      dura: 2,
      desde: { pos: [0, OJOS, 4.2], mira: CASILLERO },
      hasta: INICIO,
      pantalla: 'encendida',
    },
  ],
};

const EL_LEGADO: Escena = {
  id: 'el_legado',
  nombre: 'Final: El legado',
  planos: [
    {
      dura: 5,
      desde: { pos: [0.6, 1.7, -1.4], mira: PANTALLA },
      hasta: { pos: [1.0, 1.85, -2.2], mira: PANTALLA },
      tarjeta: 'copiando',
      pantalla: 'copiando',
      sonido: 'bip',
    },
    {
      dura: 4.5,
      desde: { pos: [0, OJOS, -1.2], mira: PUERTA },
      hasta: { pos: [0, OJOS, -1.9], mira: PUERTA },
      puerta: true,
      pantalla: 'copiando',
      sonido: 'puerta',
      efrain: { x: 0, z: -4.55, mira: AL_SUR, gorra: true },
    },
    {
      // Por encima del hombro de Don Efraín, hacia la pantalla.
      dura: 6.5,
      desde: { pos: [-0.6, 1.8, -3.5], mira: PANTALLA },
      hasta: { pos: [0.1, 1.95, -3.95], mira: PANTALLA },
      tarjeta: 'foto-legado',
      voz: 'voz-fin-legado',
      puerta: true,
      pantalla: 'encendida',
      efrain: { x: 0.7, z: -4.25, mira: [PANTALLA[0], PANTALLA[2]], gorra: true },
    },
    {
      // Plano medio, de frente y a un lado: se quita la gorra y mira la pantalla un largo rato.
      dura: 5,
      desde: { pos: [1.9, 1.5, -2.7], mira: [0.7, 1.35, -4.25] },
      hasta: { pos: [1.7, 1.5, -3.1], mira: [0.7, 1.35, -4.25] },
      efrainDice: 'Ese era yo.',
      puerta: true,
      pantalla: 'encendida',
      efrain: { x: 0.7, z: -4.25, mira: [PANTALLA[0], PANTALLA[2]], gorra: false },
    },
    {
      // Se hace a un lado: la puerta abierta a la calle de noche.
      dura: 6.5,
      desde: { pos: [0, OJOS, -1.4], mira: PUERTA },
      hasta: { pos: [0, OJOS, -2.6], mira: PUERTA },
      efrainDice: 'Mañana llegue temprano a su feria. Yo le abro.',
      puerta: true,
      pantalla: 'encendida',
      efrain: { x: -1.15, z: -4.45, mira: AL_SUR, gorra: false },
      fundido: true,
    },
  ],
};

const JUSTO_A_TIEMPO: Escena = {
  id: 'justo_a_tiempo',
  nombre: 'Final: Justo a tiempo',
  planos: [
    {
      dura: 4.5,
      desde: { pos: [0.6, 1.65, -1.9], mira: CASILLERO },
      hasta: { pos: [1.2, 1.5, -3.0], mira: CASILLERO },
      texto: 'Tu memoria USB.',
      sonido: 'casilleros',
      pantalla: 'encendida',
    },
    {
      dura: 5.5,
      desde: { pos: [0.2, OJOS, -1.6], mira: [-0.5, 1.4, -4.8] },
      hasta: { pos: [0.1, OJOS, -2.2], mira: [-0.5, 1.4, -4.8] },
      efrainDice: 'Suerte mañana en su feria.',
      sonido: 'puerta',
      puerta: true,
      pantalla: 'encendida',
      efrain: { x: -1.0, z: -4.45, mira: AL_SUR, gorra: true },
    },
    {
      // En la otra mano: la misma foto de la prueba de la sala 3.
      dura: 4,
      desde: { pos: [0.1, OJOS, -2.2], mira: [-0.5, 1.4, -4.8] },
      tarjeta: 'foto-vieja',
      texto: 'En la otra mano tiene una foto vieja de una feria de ciencias.',
      puerta: true,
      pantalla: 'encendida',
      efrain: { x: -1.0, z: -4.45, mira: AL_SUR, gorra: true },
    },
    {
      // Mirando hacia atrás: el reloj llega a las 00:40...
      dura: 4,
      desde: { pos: [-0.4, 1.7, -1.8], mira: [1.0, 2.4, -4.95] },
      voz: 'voz-fin-justo',
      tarjeta: 'reloj',
      puerta: true,
      pantalla: 'encendida',
      efrain: { x: -1.0, z: -4.45, mira: AL_SUR, gorra: true },
    },
    {
      // ... y la pantalla se apaga.
      dura: 3.5,
      desde: { pos: [-0.4, 1.7, -1.8], mira: [1.0, 2.4, -4.95] },
      puerta: true,
      pantalla: 'apagada',
      efrain: { x: -1.0, z: -4.45, mira: AL_SUR, gorra: true },
    },
    {
      // Don Efraín, solo, frente a la pantalla oscura.
      dura: 4,
      desde: { pos: [-1.0, OJOS, -0.6], mira: [1.4, 1.5, -4.3] },
      hasta: { pos: [-0.9, OJOS, -1.1], mira: [1.4, 1.5, -4.3] },
      puerta: true,
      pantalla: 'apagada',
      efrain: { x: 1.3, z: -3.9, mira: [PANTALLA[0], PANTALLA[2]], gorra: true },
      fundido: true,
    },
  ],
};

const TIEMPO_CUMPLIDO: Escena = {
  id: 'tiempo_cumplido',
  nombre: 'Final: Tiempo cumplido',
  planos: [
    {
      dura: 4.5,
      desde: { pos: [0, 2.15, -3.4], mira: RELOJ },
      hasta: { pos: [0, 2.35, -4.0], mira: RELOJ },
      tarjeta: 'reloj',
      sonido: 'clic',
      pantalla: 'encendida',
    },
    {
      dura: 7.5,
      desde: { pos: [0.9, 1.95, -2.4], mira: PANTALLA },
      hasta: { pos: [1.4, 2.1, -3.4], mira: PANTALLA },
      tarjeta: 'migracion',
      voz: 'voz-fin-tiempo',
      pantalla: 'borrada',
    },
    {
      // Las cerraduras ceden.
      dura: 3.5,
      desde: { pos: [0, OJOS, -2.4], mira: PUERTA },
      sonido: 'clac',
      pantalla: 'apagada',
    },
    {
      // Don Efraín abre y, sin decir nada, mira la pantalla oscura.
      dura: 5.5,
      desde: { pos: [-0.7, OJOS, -2.0], mira: [0.6, 1.6, -4.6] },
      hasta: { pos: [-0.6, OJOS, -2.5], mira: [0.6, 1.6, -4.6] },
      puerta: true,
      pantalla: 'apagada',
      efrain: { x: 0.25, z: -4.45, mira: [PANTALLA[0], PANTALLA[2]], gorra: true },
    },
    {
      // Guarda en el bolsillo la foto de la sala 3 y se hace a un lado.
      dura: 5,
      desde: { pos: [0, OJOS, -1.8], mira: PUERTA },
      tarjeta: 'foto-vieja',
      texto: 'Guarda en el bolsillo una foto vieja de una feria de ciencias.',
      puerta: true,
      pantalla: 'apagada',
      efrain: { x: -1.1, z: -4.45, mira: AL_SUR, gorra: true },
      fundido: true,
    },
  ],
};

const POR_ID: Readonly<Record<EscenaId, Escena>> = {
  intro: INTRO,
  el_legado: EL_LEGADO,
  justo_a_tiempo: JUSTO_A_TIEMPO,
  tiempo_cumplido: TIEMPO_CUMPLIDO,
};

export function escenaPorId(id: EscenaId): Escena {
  return POR_ID[id];
}

/** Segundos que dura la escena completa. */
export function duracionDe(e: Escena): number {
  return e.planos.reduce((s, p) => s + p.dura, 0);
}

/** El plano que se ve en el segundo `t`, su inicio y cuánto lleva (0 a 1). `null` si terminó. */
export function planoEn(
  e: Escena,
  t: number,
): { indice: number; plano: Plano; inicio: number; avance: number } | null {
  let inicio = 0;
  for (let indice = 0; indice < e.planos.length; indice++) {
    const plano = e.planos[indice] as Plano;
    if (t < inicio + plano.dura) {
      const avance = Math.min(1, Math.max(0, (t - inicio) / plano.dura));
      return { indice, plano, inicio, avance };
    }
    inicio += plano.dura;
  }
  return null;
}

/** Cuándo empieza cada plano (segundos desde el inicio de la escena). */
export function iniciosDe(e: Escena): number[] {
  const inicios: number[] = [];
  let t = 0;
  for (const p of e.planos) {
    inicios.push(t);
    t += p.dura;
  }
  return inicios;
}

/** Suavizado de entrada y salida: la cámara arranca y frena despacio. */
export function suavizar(x: number): number {
  const v = Math.min(1, Math.max(0, x));
  return v * v * (3 - 2 * v);
}

/**
 * La toma en ese punto del plano. Con movimiento reducido no hay desplazamiento: se queda en la
 * toma final (un corte seco por plano).
 */
export function tomaEn(plano: Plano, avance: number, reducido: boolean): Toma {
  const hasta = plano.hasta;
  if (!hasta) return plano.desde;
  if (reducido) return hasta;
  const k = suavizar(avance);
  const mezclar = (a: Punto3, b: Punto3): Punto3 => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  return { pos: mezclar(plano.desde.pos, hasta.pos), mira: mezclar(plano.desde.mira, hasta.mira) };
}

/** Giro de la cámara para mirar de `pos` a `mira`: yaw 0 mira hacia −Z (`jugador/camara.ts`). */
export function orientacionHacia(pos: Punto3, mira: Punto3): { yaw: number; pitch: number } {
  const dx = mira[0] - pos[0];
  const dy = mira[1] - pos[1];
  const dz = mira[2] - pos[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/**
 * Segundos para leer un subtítulo sin voz con calma: 2,4 palabras por segundo más un poco de
 * aire, y nunca menos de 3 s. (Es más lento que `duracionEstimada` de `esquema-guion.ts`, que
 * no se importa porque trae zod.)
 */
export function segundosDeLectura(texto: string): number {
  const palabras = texto.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  return Math.max(3, palabras / 2.4 + 1.2);
}

/** Quién habla en un subtítulo. */
export type QuienHabla = 'voz' | 'efrain';

export interface SubtituloEscena {
  quien: QuienHabla;
  /** Id de la línea del guion, si es de La Voz. */
  id?: string;
  texto: string;
  /** Segundo de la escena en que empezó. */
  desde: number;
  /**
   * Segundos que se lee, estimados. Con la voz grabada manda el audio (`ui/escenas/`); sin
   * audio, o para Don Efraín, que no tiene voz, se usa este tiempo.
   */
  estimada: number;
}

/**
 * La última línea que empezó antes del segundo `t`, aunque haya cambiado el plano: una línea
 * larga sigue en pantalla. Cuándo se quita lo decide la interfaz (con el audio o `estimada`).
 * `lineaDeVoz` da el texto y la duración de una línea de La Voz (el guion del bundle).
 */
export function subtituloEn(
  e: Escena,
  t: number,
  lineaDeVoz: (id: string) => { texto: string; duracion_s: number } | null,
): SubtituloEscena | null {
  const inicios = iniciosDe(e);
  let actual: SubtituloEscena | null = null;
  e.planos.forEach((p, i) => {
    const desde = inicios[i] ?? 0;
    if (desde > t) return;
    if (p.voz) {
      const linea = lineaDeVoz(p.voz);
      if (linea) {
        actual = { quien: 'voz', id: p.voz, texto: linea.texto, desde, estimada: linea.duracion_s };
      }
    } else if (p.efrainDice) {
      const estimada = segundosDeLectura(p.efrainDice);
      actual = { quien: 'efrain', texto: p.efrainDice, desde, estimada };
    }
  });
  return t < duracionDe(e) ? actual : null;
}

/**
 * Segundos que tiene una línea para sonar antes de que empiece la siguiente línea o termine la
 * escena. Las pruebas comparan este tiempo con lo que dura el audio grabado.
 */
export function tiempoParaHablar(e: Escena, indice: number): number {
  const inicios = iniciosDe(e);
  const desde = inicios[indice] ?? 0;
  for (let i = indice + 1; i < e.planos.length; i++) {
    const p = e.planos[i] as Plano;
    if (p.voz || p.efrainDice) return (inicios[i] ?? 0) - desde;
  }
  return duracionDe(e) - desde;
}

// ---------- Escenas ya vistas en este equipo ----------

/** Clave de `localStorage`. Lo guardado es texto no confiable: solo se aceptan ids conocidos. */
export const CLAVE_ESCENAS_VISTAS = 'lup:escenas-vistas';

/** Lee la lista guardada (`intro,el_legado`). Lo que no sea un id conocido se descarta. */
export function leerVistas(texto: string | null): Set<EscenaId> {
  const vistas = new Set<EscenaId>();
  if (typeof texto !== 'string' || texto.length > 200) return vistas;
  for (const parte of texto.split(',')) if (esEscena(parte)) vistas.add(parte);
  return vistas;
}

export function escribirVistas(vistas: ReadonlySet<EscenaId>): string {
  return ESCENAS.filter((id) => vistas.has(id)).join(',');
}
