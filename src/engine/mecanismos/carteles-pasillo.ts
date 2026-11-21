/**
 * Los carteles de las salas en el pasillo (pasillos, sesión C): el cartel encima de la puerta
 * de una sala que ya tiene su sello lo lleva estampado (`laminas.ts`, `selloDeSala`), con la
 * figura y el color de su pieza en el mural de la portería.
 *
 * No agrega mallas: vuelve a pintar el lienzo del mismo cartel (`marcarLamina`), así que la
 * peor mirada del pasillo sigue con sus draw calls. Solo se pinta cuando cambian los sellos
 * (al ganar uno, al continuar una partida o al empezar otra), nunca en cada cuadro.
 */
import { effect } from '@preact/signals';
import type { Material, Mesh, Object3D, Texture } from 'three';
import { sellos } from '../../signals/partida';
import { marcarLamina } from '../salas/laminas';
import { ORDEN_SALAS } from '../salas/recorrido';
import type { AnimacionSala } from './tipos';

/** Id del cartel de la sala `n` (1 a 5) en `salas.json`. */
export const idCartelDeSala = (n: number): string => `pasillo-cartel-s${n}`;

/** La textura dibujada de la lámina que cuelga de `objeto` (la malla o su primer hijo con mapa). */
function texturaDe(objeto: Object3D): Texture | null {
  let textura: Texture | null = null;
  objeto.traverse((x) => {
    if (textura || !(x as Mesh).isMesh) return;
    const material = (x as Mesh).material as Material | Material[];
    const uno = Array.isArray(material) ? material[0] : material;
    const mapa = (uno as Material & { map?: Texture | null } | undefined)?.map;
    if (mapa) textura = mapa;
  });
  return textura;
}

/** Busca en la sala armada los carteles de las cinco salas, en orden (los que falten se saltan). */
function buscarCarteles(raiz: Object3D): { sala: string; numero: number; textura: Texture }[] {
  return ORDEN_SALAS.flatMap((sala, i) => {
    const objeto = raiz.getObjectByName(idCartelDeSala(i + 1));
    const textura = objeto ? texturaDe(objeto) : null;
    return textura ? [{ sala, numero: i + 1, textura }] : [];
  });
}

/** Estampa el sello en el cartel de cada sala que lo tiene, y lo quita de las demás. */
export function animarCartelesDeSalas(raiz: Object3D): AnimacionSala {
  const carteles = buscarCarteles(raiz);
  let conSello = 0;
  const dejar = effect(() => {
    const ganados = sellos.value;
    conSello = 0;
    for (const c of carteles) {
      const tiene = (ganados as readonly string[]).includes(c.sala);
      marcarLamina(c.textura, tiene ? { sello: c.numero } : {});
      if (tiene) conSello++;
    }
  });
  return {
    actualizar: () => undefined,
    get estado() {
      return `carteles-${conSello}`;
    },
    liberar() {
      dejar();
    },
  };
}
