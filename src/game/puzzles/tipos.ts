/** Qué condiciones de la etapa se cumplen, por id (por ejemplo, una por lámpara). */
export type Condiciones = Readonly<Record<string, boolean>>;

export interface Evaluacion {
  condiciones: Condiciones;
  /** Verdadero si se cumplen todas las condiciones de la etapa. */
  resuelta: boolean;
}

export function evaluacion(condiciones: Record<string, boolean>): Evaluacion {
  const valores = Object.values(condiciones);
  return { condiciones, resuelta: valores.length > 0 && valores.every(Boolean) };
}

// Ayudas para revisar datos que llegan de fuera (red, localStorage): nunca confiar en la forma.

export const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const esEntero = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/** Verdadero si el objeto tiene exactamente estas claves. */
export function soloClaves(x: Record<string, unknown>, claves: readonly string[]): boolean {
  const propias = Object.keys(x);
  return propias.length === claves.length && claves.every((c) => Object.hasOwn(x, c));
}

/** Compara dos valores JSON por contenido, sin importar el orden de las claves. */
export function iguales(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => iguales(x, b[i]))
    );
  }
  if (!esObjeto(a) || !esObjeto(b)) return false;
  const claves = Object.keys(a);
  return soloClaves(b, claves) && claves.every((k) => iguales(a[k], b[k]));
}
