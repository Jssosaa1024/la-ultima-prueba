import { Frustum, Matrix4, PerspectiveCamera } from 'three';
import type { Material, Mesh, Object3D } from 'three';
import type { Sala } from '../../src/content/esquema-salas';
import { lamparasDe } from '../../src/engine/salas/acabados';
import type { SalaConstruida } from '../../src/engine/salas/construir';
import { celdasDe } from '../../src/engine/salas/visibilidad';
import { rectangulosDe } from '../../src/content/tramos';
import { crearVistaPorCeldas } from '../../src/engine/salas/vista-por-celdas';

/**
 * Ayudas de las pruebas para la portería con su pasillo (`docs/pasillos.md`).
 *
 * Muchas pruebas viejas usan la portería como ejemplo de sala rectangular (sus 4 paredes, su
 * piso de 6 × 10 m). `sinPasillo` la deja como era: sin tramos, sin lo que queda fuera del
 * rectángulo y con sus tres lámparas. El pasillo se prueba aparte (`pasillo.test.ts`).
 */
export function sinPasillo(sala: Sala): Sala {
  const adentro = (x: number, z: number): boolean =>
    Math.abs(x) <= sala.ancho / 2 && Math.abs(z) <= sala.fondo / 2;
  const copia: Sala = {
    ...sala,
    objetos: sala.objetos.filter((o) => adentro(o.pos[0], o.pos[2])),
  };
  delete copia.tramos;
  if (sala.acabados?.lamparas) {
    copia.acabados = {
      ...sala.acabados,
      lamparas: sala.acabados.lamparas.slice(0, lamparasDe(sala).length),
    };
  }
  return copia;
}

const materiales = (m: Mesh): Material[] => ([] as Material[]).concat(m.material);

/** Una malla que se puede dibujar: algún material visible (lo oculto por animación cuenta). */
function dibujable(o: Object3D): o is Mesh {
  const malla = o as Mesh & { isInstancedMesh?: boolean; count?: number };
  if (!malla.isMesh) return false;
  if (malla.isInstancedMesh && malla.count === 0) return false;
  return materiales(malla).some((m) => m.visible);
}

/**
 * Draw calls de la peor mirada en una sala con tramos: desde cada celda del piso (16 puntos por
 * celda, 16 direcciones, cámara del juego de 70° con una pantalla de 20:9), lo que deja la vista
 * por celdas y entra en el encuadre. Cuenta también lo que una animación puede mostrar (está
 * oculto, pero su material es visible). Sin tramos, todas las mallas (como antes).
 */
export function llamadasPorCuadro(construida: SalaConstruida, sala: Sala): number {
  if (!sala.tramos) {
    let n = 0;
    construida.raiz.traverse((o) => {
      if (dibujable(o)) n += materiales(o).filter((m) => m.visible).length;
    });
    return n;
  }
  const raiz = construida.raiz;
  const vista = crearVistaPorCeldas(raiz, sala);
  if (!vista) throw new Error('sin vista por celdas');
  const camara = new PerspectiveCamera(70, 20 / 9, 0.05, 50);
  const frustum = new Frustum();
  const m = new Matrix4();
  let peor = 0;
  for (const c of celdasDe(rectangulosDe(sala))) {
    for (const fx of [0.05, 0.35, 0.65, 0.95]) {
      for (const fz of [0.05, 0.35, 0.65, 0.95]) {
        const x = c.x[0] + (c.x[1] - c.x[0]) * fx;
        const z = c.z[0] + (c.z[1] - c.z[0]) * fz;
        vista.actualizar(x, z);
        for (let k = 0; k < 16; k++) {
          camara.position.set(x, 1.6, z);
          camara.rotation.set(-0.12, (k / 16) * Math.PI * 2, 0, 'YXZ');
          camara.updateMatrixWorld(true);
          frustum.setFromProjectionMatrix(
            m.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse),
          );
          let n = 0;
          raiz.updateMatrixWorld(true);
          raiz.traverse((o) => {
            if (!dibujable(o) || !o.layers.test(camara.layers)) return;
            if (o.frustumCulled && !frustum.intersectsObject(o)) return;
            n += materiales(o).filter((x) => x.visible).length;
          });
          peor = Math.max(peor, n);
        }
      }
    }
  }
  vista.liberar();
  return peor;
}
