import { z } from 'astro/zod';
import { LUGARES, type Lugar } from './lugares';

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

export { LUGARES, type Lugar };

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
/** `porteria-…` o `s1-…` a `s5-…`: minúsculas, números y guiones. */
const idObjeto = z.string().regex(/^(porteria|s[1-5])-[a-z0-9]+(-[a-z0-9]+)*$/);

const pieza = z.strictObject({
  forma: z.enum(['caja', 'cilindro', 'esfera', 'plano']),
  tam: tam3,
  /** Relativa a la posición del objeto. */
  pos: vec3,
  color: color.optional(),
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
  /** Piezas de un grupo (por ejemplo, los cinco carritos). */
  partes: z.array(pieza).min(1).optional(),
  /** Modelo CC0 del manifiesto que reemplaza a la primitiva (T19d). */
  modelo: idModelo.optional(),
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
    })
    .optional(),
  /** Dónde aparece el jugador al entrar y hacia dónde mira (grados, 0 = hacia −Z). */
  inicio: z.strictObject({ x: metros, z: metros, giro: metros }),
  objetos: z.array(esquemaObjeto).min(1),
});

export type ObjetoSala = z.infer<typeof esquemaObjeto>;
export type Sala = z.infer<typeof esquemaSala>;
export type PiezaObjeto = z.infer<typeof pieza>;

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

/** Problemas de una sala: objetos fuera de la sala, ids repetidos o de otra sala, nombres. */
export function problemasDeSala(sala: Sala): ProblemaSala[] {
  const problemas: ProblemaSala[] = [];
  const reportar = (mensaje: string) => problemas.push({ sala: sala.id, mensaje });
  const prefijo = sala.id === 'porteria' ? 'porteria-' : `${sala.id.slice(0, 2)}-`;
  const vistos = new Set<string>();

  for (const o of sala.objetos) {
    if (!o.id.startsWith(prefijo))
      reportar(`${o.id}: los ids de esta sala empiezan por «${prefijo}»`);
    if (vistos.has(o.id)) reportar(`${o.id}: id repetido`);
    vistos.add(o.id);
    if (o.accion && !o.nombre) reportar(`${o.id}: un objeto con acción necesita nombre`);
    if (o.puerta && o.accion !== 'usar') reportar(`${o.id}: una puerta se usa («accion»: «usar»)`);
    if (o.puerta === sala.id) reportar(`${o.id}: la puerta lleva a la misma sala`);
    if ((o.forma === 'grupo') !== Boolean(o.partes)) {
      reportar(`${o.id}: un grupo necesita «partes» y solo un grupo las lleva`);
    }

    const m = medioTamano(o);
    const [x, y, z] = o.pos;
    const fuera =
      Math.abs(x) + m.x > sala.ancho / 2 + TOLERANCIA ||
      Math.abs(z) + m.z > sala.fondo / 2 + TOLERANCIA ||
      y < -TOLERANCIA ||
      y + o.tam[1] > sala.alto + TOLERANCIA;
    if (fuera && o.forma !== 'grupo') reportar(`${o.id}: queda fuera de la sala`);
  }

  const { x, z } = sala.inicio;
  if (Math.abs(x) > sala.ancho / 2 - 0.3 || Math.abs(z) > sala.fondo / 2 - 0.3) {
    reportar('el punto de inicio queda fuera de la sala o pegado a una pared');
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
