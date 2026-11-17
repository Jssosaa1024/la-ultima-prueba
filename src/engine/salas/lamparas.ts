/**
 * La lámpara que titila (T19k): de vez en cuando baja una o dos veces, como un tubo viejo.
 *
 * Es seguro para quien es sensible a los destellos: nunca llega a negro (baja al 62 % como
 * mucho), son a lo sumo dos bajadas en un segundo (el límite de WCAG 2.3.1 es tres) y es una
 * parte pequeña de la pantalla. Con «reducir movimiento» del sistema no titila.
 *
 * Solo cambia el color por vértice de la lámpara en las mallas de difusores y brillos
 * (`acabados.ts` guarda cuáles vértices son y su color encendido): nada de draw calls nuevas,
 * y en un cuadro sin cambios no se toca nada.
 */
import type { BufferAttribute, Mesh, Object3D } from 'three';
import type { AnimacionSala } from '../mecanismos/tipos';
import { TITILEO } from './acabados';
import type { Titileo } from './acabados';

/** Cada cuánto puede haber una racha, en segundos. */
export const CICLO_TITILEO_S = 9;
/** Cuánto dura cada bajada y cuánto baja (fracción de la luz encendida). */
const BAJADAS = [
  { desde: 0, dura: 0.18, nivel: 0.62 },
  { desde: 0.62, dura: 0.14, nivel: 0.78 },
] as const;

/** Número entre 0 y 1 que depende solo de `n`. */
function azar(n: number): number {
  const x = Math.sin(n * 91.345 + 47.853) * 24634.6345;
  return x - Math.floor(x);
}

/**
 * Cuánta luz da la lámpara que titila a los `t` segundos: 1 casi siempre. En cada ciclo de
 * `CICLO_TITILEO_S` hay (o no, una de cada cuatro veces) una racha de una o dos bajadas.
 */
export function nivelTitileo(t: number): number {
  const ciclo = Math.floor(t / CICLO_TITILEO_S);
  if (azar(ciclo) < 0.25) return 1;
  const inicio = 1 + azar(ciclo + 0.5) * (CICLO_TITILEO_S - 3);
  const dentro = t - ciclo * CICLO_TITILEO_S - inicio;
  const cuantas = azar(ciclo + 0.25) < 0.5 ? 1 : 2;
  for (let i = 0; i < cuantas; i++) {
    const b = BAJADAS[i];
    if (b && dentro >= b.desde && dentro < b.desde + b.dura) return b.nivel;
  }
  return 1;
}

/** `true` si el sistema pide reducir el movimiento. */
function prefiereQuieto(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

interface Objetivo {
  color: BufferAttribute;
  titileo: Titileo;
}

/** Pone los vértices de la lámpara que titila al `nivel` de su color encendido. */
function aplicar({ color, titileo }: Objetivo, nivel: number): void {
  const datos = color.array as Float32Array;
  let k = 0;
  for (const [inicio, n] of titileo.rangos) {
    for (let i = inicio * 3; i < (inicio + n) * 3; i++) {
      datos[i] = (titileo.base[k] ?? 0) * nivel;
      k++;
    }
    color.addUpdateRange(inicio * 3, n * 3);
  }
  color.needsUpdate = true;
}

/**
 * Anima las lámparas que titilan en la sala ya construida, o `null` si no hay ninguna.
 * `quieto` = sin titileo (para «reducir movimiento»).
 */
export function animarLamparas(
  raiz: Object3D,
  quieto: boolean = prefiereQuieto(),
): AnimacionSala | null {
  const objetivos: Objetivo[] = [];
  for (const nombre of ['difusores', 'brillos']) {
    const malla = raiz.getObjectByName(nombre) as Mesh | undefined;
    const titileo = malla?.userData[TITILEO] as Titileo | undefined;
    const color = malla?.geometry.getAttribute('color') as BufferAttribute | undefined;
    if (titileo && color) objetivos.push({ color, titileo });
  }
  if (objetivos.length === 0) return null;

  let tiempo = 0;
  let aplicado = 1;
  const poner = (nivel: number): void => {
    if (nivel === aplicado) return;
    aplicado = nivel;
    for (const o of objetivos) aplicar(o, nivel);
  };
  return {
    actualizar(dt) {
      tiempo += dt;
      poner(quieto ? 1 : nivelTitileo(tiempo));
    },
    get estado() {
      return aplicado < 1 ? 'lampara-baja' : 'lampara-llena';
    },
    // La sala se puede volver a mostrar (la portería queda en memoria): se va encendida.
    liberar() {
      poner(1);
    },
  };
}
