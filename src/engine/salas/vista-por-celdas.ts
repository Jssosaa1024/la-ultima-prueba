/**
 * Dibujar solo lo que se puede ver (pasillos, `docs/pasillos.md`): en una sala con tramos, al
 * cambiar de celda del piso, los objetos que no se ven desde ella salen de la capa que dibuja
 * la cámara. La tabla de qué se ve desde dónde sale de `visibilidad.ts` y se calcula una sola
 * vez por sala armada (la portería se queda armada todo el juego).
 *
 * Se usan capas (`layers`) y no `visible`: `visible` ya lo manejan la interacción (lo que se
 * lleva el jugador desaparece de la sala) y las animaciones. Lo que está fuera de la capa
 * tampoco recibe el rayo del toque, y no importa: desde esa celda no se ve.
 *
 * No se tocan las luces, las mallas instanciadas (una draw call para todas sus copias) ni lo
 * que cubre media sala (lo fijo, piso, paredes, techo, sombras y lámparas).
 */
import { Box3 } from 'three';
import type { InstancedMesh, Light, Mesh, Object3D } from 'three';
import type { Sala } from '../../content/esquema-salas';
import { rectangulosDe } from '../../content/tramos';
import { paredesDeRectangulos } from './planta';
import { celdaEn, celdasDe, segmentosDeParedes, visiblesPorCelda } from './visibilidad';
import type { Celda, Huella } from './visibilidad';

/** Lo que ocupa más que esto en el piso (m²) se dibuja siempre: lo fijo, el piso, el techo. */
const AREA_MAXIMA = 20;
/** En `userData` de la raíz: la tabla ya calculada. */
const TABLA = 'vistaPorCeldas';

interface Tabla {
  celdas: Celda[];
  objetos: Object3D[];
  /** Para cada celda, si cada objeto se ve. */
  vistos: boolean[][];
}

export interface VistaPorCeldas {
  /** Pone a dibujar lo que se ve desde (x, z). Solo trabaja si cambió la celda. */
  actualizar(x: number, z: number): void;
  /** La celda actual (−1 antes de la primera). */
  readonly celda: number;
  /** Cuántos objetos se dejan de dibujar desde la celda actual. */
  readonly ocultos: number;
  /** Vuelve a dibujar todo (al salir de la sala). */
  liberar(): void;
}

function cuentaSiempre(o: Object3D): boolean {
  return Boolean((o as Light).isLight) || Boolean((o as InstancedMesh).isInstancedMesh);
}

function armarTabla(raiz: Object3D, sala: Sala): Tabla {
  const rects = rectangulosDe(sala);
  const celdas = celdasDe(rects);
  const paredes = segmentosDeParedes(paredesDeRectangulos(rects));
  raiz.updateMatrixWorld(true);
  const caja = new Box3();
  const objetos: Object3D[] = [];
  const huellas: Huella[] = [];
  for (const o of raiz.children) {
    if (cuentaSiempre(o)) continue;
    caja.setFromObject(o);
    if (caja.isEmpty()) continue;
    const area = (caja.max.x - caja.min.x) * (caja.max.z - caja.min.z);
    if (area > AREA_MAXIMA) continue;
    objetos.push(o);
    huellas.push({ minX: caja.min.x, maxX: caja.max.x, minZ: caja.min.z, maxZ: caja.max.z });
  }
  const visibles = visiblesPorCelda(celdas, huellas, paredes);
  const vistos = visibles.map((lista) => {
    const fila = objetos.map(() => false);
    for (const i of lista) fila[i] = true;
    return fila;
  });
  return { celdas, objetos, vistos };
}

function ponerCapa(o: Object3D, dibujar: boolean): void {
  o.traverse((x) => {
    if (!(x as Mesh).isMesh && !(x as { isSprite?: boolean }).isSprite) return;
    if (dibujar) x.layers.set(0);
    else x.layers.disableAll();
  });
}

/**
 * Prepara la sala ya armada, vestida y con su animación (lo que la animación agrega también
 * cuenta). Sin tramos, `null`: las salas de un solo rectángulo se ven enteras.
 */
export function crearVistaPorCeldas(raiz: Object3D, sala: Sala): VistaPorCeldas | null {
  if (!sala.tramos) return null;
  const guardada = raiz.userData[TABLA] as Tabla | undefined;
  const tabla = guardada ?? armarTabla(raiz, sala);
  raiz.userData[TABLA] = tabla;
  let celda = -1;
  let ocultos = 0;

  return {
    actualizar(x, z) {
      // Casi siempre sigue en la misma celda: se mira esa primero.
      const actual = tabla.celdas[celda];
      if (actual && x >= actual.x[0] && x <= actual.x[1] && z >= actual.z[0] && z <= actual.z[1]) {
        return;
      }
      const nueva = celdaEn(tabla.celdas, x, z);
      if (nueva === -1 || nueva === celda) return;
      celda = nueva;
      const fila = tabla.vistos[nueva] ?? [];
      ocultos = 0;
      tabla.objetos.forEach((o, i) => {
        const ver = fila[i] ?? true;
        if (!ver) ocultos++;
        ponerCapa(o, ver);
      });
    },
    get celda() {
      return celda;
    },
    get ocultos() {
      return ocultos;
    },
    liberar() {
      for (const o of tabla.objetos) ponerCapa(o, true);
      celda = -1;
      ocultos = 0;
    },
  };
}
