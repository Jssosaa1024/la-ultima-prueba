/**
 * Modelos en las salas (T19e): poner el GLB de un objeto encima de su primitiva.
 *
 * - El modelo se ajusta a `tam` sin deformarse (la escala que cabe en la caja), centrado en x
 *   y z y con su base en el piso del objeto. Hereda `pos` y `giro` del objeto.
 * - La primitiva se queda donde está, invisible: sigue siendo la caja que choca (T17) y la que
 *   se toca (T18). Así la interacción y las colisiones no cambian con el modelo.
 * - Lo que se toca lleva su propia copia, con materiales propios (el resaltado no se contagia).
 * - Los objetos fijos que repiten modelo (dos o más estantes iguales) van en una malla
 *   instanciada por cada malla del modelo: una draw call para todos.
 * - Los materiales pasan a Lambert, como el resto de la sala: un solo estilo y menos cálculo
 *   por píxel en un celular de gama baja.
 */
import { Box3, InstancedMesh, Matrix4, MeshLambertMaterial, Vector3 } from 'three';
import type { Material, Mesh, Object3D } from 'three';
import type { ObjetoSala, Sala } from '../../content/esquema-salas';

/** En `userData` de lo que puso este módulo: el nombre del modelo. */
export const DE_MODELO = 'deModelo';
/** En `userData` del objeto que ya muestra su modelo. */
export const CON_MODELO = 'conModelo';

/** Ids de los objetos de la sala que ya muestran su modelo (para las e2e y el panel). */
export function objetosConModelo(raiz: Object3D): string[] {
  const ids: string[] = [];
  raiz.traverse((o) => {
    if (o.userData[CON_MODELO]) ids.push(o.name);
  });
  return ids.sort();
}

type MaterialConMapa = Material & {
  color?: MeshLambertMaterial['color'];
  map?: MeshLambertMaterial['map'];
  emissive?: MeshLambertMaterial['emissive'];
  emissiveMap?: MeshLambertMaterial['emissiveMap'];
  vertexColors?: boolean;
};

/** Medidas a las que se ajusta el modelo: ∞ en el eje que no limita (el fondo de un plano). */
export function medidasDeAjuste(o: Pick<ObjetoSala, 'forma' | 'tam'>): [number, number, number] {
  const [ancho, alto, fondo] = o.tam;
  switch (o.forma) {
    case 'esfera':
      return [ancho, ancho, ancho];
    case 'cilindro':
      return [ancho, alto, ancho];
    case 'plano':
      return [ancho, alto, Infinity];
    default:
      return [ancho, alto, fondo > 0 ? fondo : Infinity];
  }
}

/**
 * Matriz que lleva el modelo (en sus propias coordenadas) al objeto: escala uniforme para que
 * quepa en `tam`, centrado en x y z y con la base en y = 0.
 */
export function ajusteDeModelo(caja: Box3, o: Pick<ObjetoSala, 'forma' | 'tam'>): Matrix4 {
  const tam = caja.getSize(new Vector3());
  const centro = caja.getCenter(new Vector3());
  const [mx, my, mz] = medidasDeAjuste(o);
  const escalas = [
    [mx, tam.x],
    [my, tam.y],
    [mz, tam.z],
  ]
    .filter(([medida = 0, lado = 0]) => Number.isFinite(medida) && lado > 1e-6)
    .map(([medida = 0, lado = 1]) => medida / lado);
  const s = escalas.length > 0 ? Math.min(...escalas) : 1;
  return new Matrix4()
    .makeTranslation(-centro.x * s, -caja.min.y * s, -centro.z * s)
    .multiply(new Matrix4().makeScale(s, s, s));
}

/** Cambia los materiales del modelo por Lambert con el mismo color y mapa. */
export function aLambert(modelo: Object3D): void {
  const cambiados = new Map<Material, MeshLambertMaterial>();
  const cambiar = (m: Material): Material => {
    if ((m as MeshLambertMaterial).isMeshLambertMaterial) return m;
    let nuevo = cambiados.get(m);
    if (!nuevo) {
      const v = m as MaterialConMapa;
      nuevo = new MeshLambertMaterial({
        name: m.name,
        transparent: m.transparent,
        opacity: m.opacity,
        alphaTest: m.alphaTest,
        side: m.side,
        vertexColors: v.vertexColors ?? false,
      });
      if (v.color) nuevo.color.copy(v.color);
      if (v.map) nuevo.map = v.map;
      if (v.emissive) nuevo.emissive.copy(v.emissive);
      if (v.emissiveMap) nuevo.emissiveMap = v.emissiveMap;
      cambiados.set(m, nuevo);
      // Las texturas siguen en uso: solo se libera el material viejo.
      m.dispose();
    }
    return nuevo;
  };
  modelo.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    malla.material = Array.isArray(malla.material)
      ? malla.material.map(cambiar)
      : cambiar(malla.material);
  });
}

/** Esconde las mallas propias del objeto (la primitiva) sin quitarlas: siguen chocando y tocándose. */
function esconderPrimitiva(nodo: Object3D): void {
  nodo.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh || o.userData[DE_MODELO]) return;
    for (const m of Array.isArray(malla.material) ? malla.material : [malla.material]) {
      m.visible = false;
    }
  });
}

/** Copia del modelo con materiales propios, para lo que se resalta. */
function copiaConMateriales(modelo: Object3D): Object3D {
  const copia = modelo.clone();
  copia.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    malla.material = Array.isArray(malla.material)
      ? malla.material.map((m) => m.clone())
      : malla.material.clone();
  });
  return copia;
}

/** Un modelo se puede instanciar si sus mallas son comunes (sin instancias propias ni huesos). */
function instanciable(modelo: Object3D): boolean {
  let si = true;
  modelo.traverse((o) => {
    const m = o as Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean };
    if (m.isInstancedMesh || m.isSkinnedMesh) si = false;
  });
  return si;
}

export interface ModelosPuestos {
  /** Objetos que ya muestran su modelo. */
  objetos: string[];
  /** Mallas instanciadas que se agregaron a la sala. */
  instanciadas: number;
}

/**
 * Pone los modelos cargados (`cargados`: nombre → escena del GLB, ya en Lambert) sobre los
 * objetos de la sala. Lo que no tiene modelo cargado se queda con su primitiva.
 */
export function ponerModelos(
  raiz: Object3D,
  sala: Sala,
  cargados: ReadonlyMap<string, Object3D>,
): ModelosPuestos {
  const puestos: ModelosPuestos = { objetos: [], instanciadas: 0 };
  raiz.updateMatrixWorld(true);

  // Los fijos que repiten modelo se agrupan para instanciarlos.
  const repetidos = new Map<string, ObjetoSala[]>();
  for (const o of sala.objetos) {
    if (!o.modelo || o.accion || !cargados.has(o.modelo)) continue;
    repetidos.set(o.modelo, [...(repetidos.get(o.modelo) ?? []), o]);
  }

  for (const o of sala.objetos) {
    const modelo = o.modelo ? cargados.get(o.modelo) : undefined;
    const nodo = raiz.getObjectByName(o.id);
    if (!o.modelo || !modelo || !nodo) continue;
    const grupo = repetidos.get(o.modelo);
    if (!o.accion && grupo && grupo.length > 1 && instanciable(modelo)) continue;

    modelo.updateMatrixWorld(true);
    const copia = o.accion ? copiaConMateriales(modelo) : modelo.clone();
    copia.applyMatrix4(ajusteDeModelo(new Box3().setFromObject(modelo), o));
    copia.traverse((x) => {
      x.userData[DE_MODELO] = o.modelo;
    });
    copia.name = `${o.id}-modelo`;
    esconderPrimitiva(nodo);
    nodo.add(copia);
    nodo.userData[CON_MODELO] = true;
    puestos.objetos.push(o.id);
  }

  for (const [nombre, objetos] of repetidos) {
    const modelo = cargados.get(nombre);
    if (!modelo || objetos.length < 2 || !instanciable(modelo)) continue;
    modelo.updateMatrixWorld(true);
    const caja = new Box3().setFromObject(modelo);
    const nodos = objetos.map((o) => raiz.getObjectByName(o.id));
    // Relativas a la sala, que es la madre de las instancias.
    const deLaSala = raiz.matrixWorld.clone().invert();
    const matrices = objetos.map((o, i) => {
      const nodo = nodos[i];
      return nodo
        ? deLaSala.clone().multiply(nodo.matrixWorld).multiply(ajusteDeModelo(caja, o))
        : null;
    });
    const m = new Matrix4();
    modelo.traverse((x) => {
      const malla = x as Mesh;
      if (!malla.isMesh) return;
      const instancias = new InstancedMesh(malla.geometry, malla.material, objetos.length);
      let n = 0;
      for (const matriz of matrices) {
        if (!matriz) continue;
        instancias.setMatrixAt(n++, m.multiplyMatrices(matriz, malla.matrixWorld));
      }
      instancias.count = n;
      instancias.computeBoundingSphere();
      instancias.name = `${nombre}-instancias`;
      instancias.userData[DE_MODELO] = nombre;
      raiz.add(instancias);
      puestos.instanciadas++;
    });
    objetos.forEach((o, i) => {
      const nodo = nodos[i];
      if (!nodo) return;
      esconderPrimitiva(nodo);
      nodo.userData[CON_MODELO] = true;
      puestos.objetos.push(o.id);
    });
  }
  return puestos;
}
