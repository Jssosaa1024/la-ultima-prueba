/**
 * Marca de la prueba de estrés en `localStorage` (T11o y T11r).
 *
 * Safari en iPhone recarga la pestaña sin aviso cuando se queda sin memoria: la marca es lo
 * único que sobrevive. Antes de subir cada escalón se escribe `{ eje, escalon, estado:
 * "en-curso" }` con los escalones ya medidos. Si al abrir la página la marca sigue «en-curso»,
 * ese escalón se registra como «recarga por memoria».
 *
 * `localStorage` es texto no confiable (CLAUDE.md, «Seguridad»): se valida campo por campo y,
 * si algo no cuadra, se ignora. Todo acceso va dentro de `try/catch` (pestaña privada).
 */
import type { EscalonInforme, EstadoEscalon } from '../informe';

export const CLAVE_MARCA = 'lup-estres';

export const EJES = ['triangulos', 'draw-calls', 'texturas', 'pixeles'] as const;
export type Eje = (typeof EJES)[number];

export interface Marca {
  eje: Eje;
  escalon: number;
  /** `en-curso`: se estaba midiendo `escalon`; `recarga-por-memoria`: ya se detectó la recarga. */
  estado: 'en-curso' | 'recarga-por-memoria';
  /** Escalones ya medidos antes de `escalon`. */
  escalones: EscalonInforme[];
}

/** Lo mínimo de `localStorage` (en las pruebas de unidad, uno falso). */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

const ESTADOS_ESCALON: readonly EstadoEscalon[] = [
  'estable',
  'lento',
  'recarga-por-memoria',
  'contexto-perdido',
];
const MAX_ESCALONES = 100;
const CARGA_VALIDA = /^[\p{L}\p{N} +.,×%-]{1,40}$/u;

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const esEntero = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

const CAMPOS_NUMERO = [
  'mediana_ms',
  'p95_ms',
  'p1_ms',
  'triangulos',
  'draw_calls',
  'mb_texturas',
] as const;
const CAMPOS_ESCALON = new Set<string>(['escalon', 'carga', 'estado', ...CAMPOS_NUMERO]);

function leerEscalon(v: unknown): EscalonInforme | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => !CAMPOS_ESCALON.has(k))) return null;
  if (!esEntero(o['escalon'], 1, MAX_ESCALONES)) return null;
  if (typeof o['carga'] !== 'string' || !CARGA_VALIDA.test(o['carga'])) return null;
  const estado = ESTADOS_ESCALON.find((e) => e === o['estado']);
  if (!estado) return null;
  const escalon: EscalonInforme = { escalon: o['escalon'], carga: o['carga'], estado };
  for (const campo of CAMPOS_NUMERO) {
    const valor = o[campo];
    if (valor === undefined) continue;
    if (!esNumero(valor) || valor < 0 || valor > 1e9) return null;
    escalon[campo] = valor;
  }
  return escalon;
}

/** Valida una marca leída. Devuelve `null` si sobra, falta o no cuadra algo. */
export function validarMarca(texto: string | null): Marca | null {
  if (!texto || texto.length > 20_000) return null;
  let v: unknown;
  try {
    v = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const claves = Object.keys(o).sort().join(',');
  if (claves !== 'eje,escalon,escalones,estado') return null;
  const eje = EJES.find((e) => e === o['eje']);
  if (!eje || !esEntero(o['escalon'], 1, MAX_ESCALONES)) return null;
  if (o['estado'] !== 'en-curso' && o['estado'] !== 'recarga-por-memoria') return null;
  if (!Array.isArray(o['escalones']) || o['escalones'].length > MAX_ESCALONES) return null;
  const escalones: EscalonInforme[] = [];
  for (const e of o['escalones']) {
    const leido = leerEscalon(e);
    if (!leido) return null;
    escalones.push(leido);
  }
  return { eje, escalon: o['escalon'], estado: o['estado'], escalones };
}

export function almacenDelNavegador(): Almacen | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Escribe la marca. Si no se puede (pestaña privada, sin espacio), sigue sin ella. */
export function guardarMarca(almacen: Almacen | null, marca: Marca): boolean {
  try {
    almacen?.setItem(CLAVE_MARCA, JSON.stringify(marca));
    return almacen !== null;
  } catch {
    return false;
  }
}

export function leerMarca(almacen: Almacen | null): Marca | null {
  try {
    return validarMarca(almacen?.getItem(CLAVE_MARCA) ?? null);
  } catch {
    return null;
  }
}

export function borrarMarca(almacen: Almacen | null): void {
  try {
    almacen?.removeItem(CLAVE_MARCA);
  } catch {
    // Sin almacenamiento no hay marca que borrar.
  }
}

/**
 * Al abrir la página: si la marca sigue «en-curso», la pestaña se recargó en ese escalón
 * (casi siempre, por memoria). Se anota así y se guarda ya con ese estado, para que el
 * resultado se pueda exportar aunque se vuelva a recargar.
 */
export function revisarRecarga(
  almacen: Almacen | null,
  describir: (eje: Eje, escalon: number) => string,
): Marca | null {
  const marca = leerMarca(almacen);
  if (!marca) {
    // Una marca dañada o de otra versión no sirve: se borra.
    borrarMarca(almacen);
    return null;
  }
  if (marca.estado === 'recarga-por-memoria') return marca;
  const anotada: Marca = {
    ...marca,
    estado: 'recarga-por-memoria',
    escalones: [
      ...marca.escalones,
      {
        escalon: marca.escalon,
        carga: describir(marca.eje, marca.escalon),
        estado: 'recarga-por-memoria',
      },
    ],
  };
  guardarMarca(almacen, anotada);
  return anotada;
}
