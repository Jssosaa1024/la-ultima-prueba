import { grabacionDeObjeto } from '../../content/grabaciones';
import { PUZZLES } from '../../content/puzzles';
import { SALAS_3D } from '../../content/salas';
import type { Puzzle } from '../../content/esquema';
import type { GrabacionId, Lugar, SalaId } from '../partida';
import { SALAS } from '../partida';

/**
 * Lo que el anfitrión necesita saber del contenido para decidir (T84): qué objetos se
 * recogen, dónde está cada uno al empezar, qué se examina y qué herramienta pide cada dato.
 * Todo sale de `src/content/`; aquí solo se arman tablas.
 */

const LUGAR_POR_PREFIJO: Readonly<Record<string, Lugar>> = {
  porteria: 'porteria',
  s1: 's1-cooperativa',
  s2: 's2-laboratorio',
  s3: 's3-gimnasio',
  s4: 's4-biblioteca',
  s5: 's5-rectoria',
};

/** Lugar donde está el objeto al empezar la partida (por su id), o null si no existe. */
export function lugarInicial(objeto: string): Lugar | null {
  const existe = SALAS_3D.some((s) => s.objetos.some((o) => o.id === objeto));
  if (!existe) return null;
  return LUGAR_POR_PREFIJO[objeto.slice(0, objeto.indexOf('-'))] ?? null;
}

function accionDe(objeto: string): string | null {
  for (const s of SALAS_3D) {
    const o = s.objetos.find((x) => x.id === objeto);
    if (o) return o.accion ?? null;
  }
  return null;
}

/** Objetos que se pueden llevar (acción «recoger» en `salas.json`). */
export const esRecogible = (objeto: string): boolean => accionDe(objeto) === 'recoger';

/** Herramientas: objetos recogibles que revelan datos al usarlos sobre otro objeto. */
export const HERRAMIENTAS: readonly string[] = ['porteria-linterna'];

/**
 * Datos que solo se leen con una herramienta (`docs/salas-y-puzzles.md`, «Cooperativo»):
 * la pizarra de la cooperativa está en penumbra y necesita la linterna.
 */
export const REQUIERE_HERRAMIENTA: Readonly<Record<string, string>> = {
  's1-pizarra': 'porteria-linterna',
};

/**
 * Qué pasa al usar `objetivo` con `herramienta` (o sin nada). `null` si no se puede:
 * - `grabacion`: el objetivo esconde una grabación;
 * - `revelado`: el objetivo es un dato que se examina (o que pide esa herramienta).
 */
export function efectoDeUsar(
  herramienta: string | null,
  objetivo: string,
): { t: 'grabacion'; grabacion: GrabacionId } | { t: 'revelado' } | null {
  const pide = REQUIERE_HERRAMIENTA[objetivo];
  if (pide !== undefined) return herramienta === pide ? { t: 'revelado' } : null;
  if (herramienta !== null) return null;
  const g = grabacionDeObjeto(objetivo);
  if (g) return { t: 'grabacion', grabacion: g.id };
  return accionDe(objetivo) === 'examinar' ? { t: 'revelado' } : null;
}

/** Puzzle por id. */
export const puzzlePorId = (id: string): Puzzle | undefined => PUZZLES.find((p) => p.id === id);

/** Sala (id) del puzzle. */
export function salaDelPuzzle(p: Puzzle): SalaId | undefined {
  return SALAS[p.sala - 1];
}

/** Puzzle de la sala, si el lugar es una sala. */
export function puzzleDeLugar(lugar: Lugar): Puzzle | undefined {
  const i = SALAS.indexOf(lugar as SalaId);
  return i < 0 ? undefined : PUZZLES.find((p) => p.sala === i + 1);
}
