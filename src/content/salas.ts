import type { Lugar, ObjetoSala, Sala } from './esquema-salas';
import datos from './salas.json';

/**
 * La portería y las cinco salas, como las arma el motor (tarea «salas por código»).
 *
 * El JSON se valida con el esquema en cada build (`src/content.config.ts`) y en
 * `tests/unit/salas.test.ts`; por eso aquí solo se declara su tipo, sin cargar zod en el
 * bundle del juego.
 */
export const SALAS_3D = datos as unknown as readonly Sala[];

/** La distribución de un lugar. Siempre existe: el build falla si falta alguno. */
export function salaPorId(id: Lugar): Sala {
  const sala = SALAS_3D.find((s) => s.id === id);
  if (!sala) throw new Error(`No hay distribución para ${id}`);
  return sala;
}

/**
 * Si el objeto es una puerta, a dónde lleva. Lo usa la lógica del juego al recibir
 * `{ t: 'accion', objeto, accion: 'usar' }` sobre una puerta.
 */
export function destinoDePuerta(objeto: string): Lugar | null {
  for (const sala of SALAS_3D) {
    const o: ObjetoSala | undefined = sala.objetos.find((x) => x.id === objeto);
    if (o) return o.puerta ?? null;
  }
  return null;
}

/** Nombre del objeto con ese id, para el HUD y el inventario. */
export function nombreDeObjeto(objeto: string): string | null {
  for (const sala of SALAS_3D) {
    const o = sala.objetos.find((x) => x.id === objeto);
    if (o) return o.nombre ?? null;
  }
  return null;
}
