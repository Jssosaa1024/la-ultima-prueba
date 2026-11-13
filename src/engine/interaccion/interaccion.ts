/**
 * Interacción con objetos (T18): raycast al tocar, resaltado y objeto enfocado.
 *
 * El motor escribe `enfocado` (signals/interfaz.ts) y el HUD muestra el botón contextual
 * («Usar», «Recoger», «Examinar»). La orden vuelve por el puente y la atiende la lógica del
 * juego; aquí solo se reacciona a lo que cambie en los signals:
 * - si `enfocado` se vacía o cambia, se quita el resaltado;
 * - si un objeto entra al `inventario`, desaparece de la escena.
 */
import { effect } from '@preact/signals';
import { Color, Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Material, Mesh, Object3D } from 'three';
import { enfocado } from '../../signals/interfaz';
import type { AccionObjeto, ObjetoEnfocado } from '../../signals/interfaz';
import { inventario } from '../../signals/partida';

/** Hasta dónde alcanza la mano, en metros desde los ojos. */
export const ALCANCE = 3;
/** Al alejarse más que esto, el objeto deja de estar enfocado. */
export const ALCANCE_SOLTAR = 3.5;

const BRILLO = new Color(0x5a4210);

export interface DatosInteractivo {
  id: string;
  nombre: string;
  accion: AccionObjeto;
}

interface Resaltable {
  material: Material & { emissive?: Color };
  original: Color | null;
}

/**
 * Marca un objeto como interactivo. Copia sus materiales para que el resaltado no se
 * contagie a otros objetos que compartían el mismo material.
 */
export function marcarInteractivo<T extends Object3D>(objeto: T, datos: DatosInteractivo): T {
  objeto.userData['interactivo'] = datos;
  objeto.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    malla.material = Array.isArray(malla.material)
      ? malla.material.map((m) => m.clone())
      : malla.material.clone();
  });
  return objeto;
}

/** El objeto interactivo al que pertenece `o` (él mismo o un padre), si lo hay. */
export function interactivoDe(o: Object3D | null): Object3D | null {
  for (let actual = o; actual; actual = actual.parent) {
    if (actual.userData['interactivo']) return actual;
  }
  return null;
}

const datosDe = (o: Object3D): DatosInteractivo => o.userData['interactivo'] as DatosInteractivo;

/** `true` si el objeto y todos sus padres están visibles. */
function esVisible(o: Object3D): boolean {
  for (let actual: Object3D | null = o; actual; actual = actual.parent) {
    if (!actual.visible) return false;
  }
  return true;
}

const posicion = new Vector3();

function resaltables(objeto: Object3D): Resaltable[] {
  const lista: Resaltable[] = [];
  objeto.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    for (const m of Array.isArray(malla.material) ? malla.material : [malla.material]) {
      const material = m as Material & { emissive?: Color };
      lista.push({ material, original: material.emissive ? material.emissive.clone() : null });
    }
  });
  return lista;
}

export interface Interaccion {
  /** Toque en coordenadas normalizadas de pantalla (−1 a 1). Selecciona o suelta. */
  tocar(x: number, y: number): void;
  /** Cada cuadro: suelta el objeto si el jugador se alejó. */
  actualizar(): void;
  /** Id del objeto resaltado, o `null`. */
  readonly seleccionado: string | null;
  liberar(): void;
}

/**
 * @param raiz  la sala: se buscan objetos interactivos dentro y lo sólido tapa la vista.
 */
export function crearInteraccion(camara: Camera, raiz: Object3D): Interaccion {
  const rayo = new Raycaster();
  rayo.far = ALCANCE;
  const punto = new Vector2();
  let actual: { objeto: Object3D; partes: Resaltable[] } | null = null;

  const quitarResaltado = (): void => {
    if (!actual) return;
    for (const { material, original } of actual.partes) {
      if (material.emissive && original) material.emissive.copy(original);
    }
    actual = null;
  };

  const resaltar = (objeto: Object3D): void => {
    quitarResaltado();
    const partes = resaltables(objeto);
    for (const { material } of partes) material.emissive?.copy(BRILLO);
    actual = { objeto, partes };
    const { id, nombre, accion } = datosDe(objeto);
    const nuevo: ObjetoEnfocado = { id, nombre, accion };
    enfocado.value = nuevo;
  };

  const soltar = (): void => {
    const id = actual ? datosDe(actual.objeto).id : null;
    quitarResaltado();
    // Solo se vacía `enfocado` si era nuestro: otro módulo pudo haber puesto otra cosa.
    if (id && enfocado.value?.id === id) enfocado.value = null;
  };

  // Si la lógica del juego vacía o cambia `enfocado` (por ejemplo, tras «Recoger»), se apaga
  // el resaltado. Si un objeto entra al inventario, desaparece de la sala.
  const dejarDeVigilar = effect(() => {
    const e = enfocado.value;
    if (actual && e?.id !== datosDe(actual.objeto).id) quitarResaltado();
  });
  const dejarDeVigilarInventario = effect(() => {
    const ids = new Set(inventario.value.map((o) => o.id));
    raiz.traverse((o) => {
      const datos = o.userData['interactivo'] as DatosInteractivo | undefined;
      if (datos && ids.has(datos.id)) o.visible = false;
    });
  });

  return {
    tocar(x, y) {
      punto.set(x, y);
      rayo.setFromCamera(punto, camara);
      // El primer objeto visible que toca el rayo: si es una pared, tapa lo que hay detrás.
      const choque = rayo.intersectObject(raiz, true).find((i) => esVisible(i.object));
      const objeto = choque ? interactivoDe(choque.object) : null;
      if (objeto) resaltar(objeto);
      else soltar();
    },
    actualizar() {
      if (!actual) return;
      const distancia = camara.position.distanceTo(actual.objeto.getWorldPosition(posicion));
      if (!esVisible(actual.objeto) || distancia > ALCANCE_SOLTAR) soltar();
    },
    get seleccionado() {
      return actual ? datosDe(actual.objeto).id : null;
    },
    liberar() {
      dejarDeVigilar();
      dejarDeVigilarInventario();
      soltar();
    },
  };
}
