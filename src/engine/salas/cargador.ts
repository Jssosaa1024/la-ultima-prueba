/**
 * Cargador de salas (T20): entrar a una sala, liberar la anterior y preparar la siguiente.
 *
 * - **compileAsync**: antes de mostrar una sala se compilan sus shaders sin bloquear el
 *   cuadro, para que entrar no dé un tirón en un celular de gama baja.
 * - **Memoria**: en la GPU solo quedan la portería y la sala actual (especificación,
 *   sección 0). Al salir de una sala se libera con `dispose()`; la portería se conserva.
 * - **Precarga**: la siguiente sala se arma en la CPU en un momento libre, sin subirla a la
 *   GPU; al entrar solo falta compilar y dibujar.
 *
 * Las salas son geometría por código (`construir.ts`): no hay archivos que descargar.
 * Cuando lleguen los GLB de cada sala (Fase 6 y 7), la precarga los dejará en la caché.
 */
import type { Camera, Object3D, Scene } from 'three';
import type { Lugar, Sala } from '../../content/esquema-salas';
import { carga } from '../../signals/interfaz';
import { liberarObjeto } from '../carga/liberar';
import type { SalaConstruida } from './construir';

/** Lo mínimo del renderer que usa el cargador (en los tests se usa uno falso). */
export interface CompiladorShaders {
  compileAsync(objeto: Object3D, camara: Camera, escena?: Scene | null): Promise<unknown>;
}

export interface OpcionesCargador {
  renderer: CompiladorShaders;
  escena: Scene;
  camara: Camera;
  /** Busca la distribución de un lugar. */
  distribucion: (lugar: Lugar) => Sala;
  construir: (sala: Sala) => SalaConstruida;
}

export interface CargadorSalas {
  /**
   * Muestra la sala `lugar`. Si mientras tanto se pide otra, la última gana y esta
   * promesa resuelve `null`.
   */
  entrar(lugar: Lugar): Promise<SalaConstruida | null>;
  /** Arma la sala en la CPU para entrar más rápido después. */
  precargar(lugar: Lugar): void;
  readonly actual: SalaConstruida | null;
  /** Salas armadas que no se están dibujando (la portería y la precargada). */
  readonly enEspera: readonly Lugar[];
  liberar(): void;
}

/** La portería es el centro del recorrido: se vuelve a ella después de cada sala. */
const SE_CONSERVA: Lugar = 'porteria';

export function crearCargadorSalas({
  renderer,
  escena,
  camara,
  distribucion,
  construir,
}: OpcionesCargador): CargadorSalas {
  const espera = new Map<Lugar, SalaConstruida>();
  let actual: SalaConstruida | null = null;
  let pedido = 0;

  const tomar = (lugar: Lugar): SalaConstruida => {
    const lista = espera.get(lugar);
    if (lista) {
      espera.delete(lugar);
      return lista;
    }
    return construir(distribucion(lugar));
  };

  /** Saca la sala de la escena: la portería queda en espera; las demás se liberan. */
  const guardarOLiberar = (sala: SalaConstruida): void => {
    sala.raiz.removeFromParent();
    if (sala.id === SE_CONSERVA) espera.set(sala.id, sala);
    else liberarObjeto(sala.raiz);
  };

  return {
    async entrar(lugar) {
      if (actual?.id === lugar) return actual;
      const este = ++pedido;
      carga.value = { estado: 'cargando', progreso: 0 };
      try {
        const nueva = tomar(lugar);
        carga.value = { estado: 'cargando', progreso: 0.5 };
        await renderer.compileAsync(nueva.raiz, camara, escena);
        if (este !== pedido) {
          // Mientras se compilaba se pidió otra sala: esta ya no se muestra.
          guardarOLiberar(nueva);
          return null;
        }
        if (actual) guardarOLiberar(actual);
        escena.add(nueva.raiz);
        actual = nueva;
        carga.value = { estado: 'lista', progreso: 1 };
        return nueva;
      } catch (error) {
        if (este === pedido) carga.value = { estado: 'error', progreso: 0 };
        throw error;
      }
    },
    precargar(lugar) {
      if (lugar === actual?.id || espera.has(lugar)) return;
      espera.set(lugar, construir(distribucion(lugar)));
      // Solo una sala precargada además de la portería: la memoria es poca.
      for (const [id, sala] of espera) {
        if (id !== lugar && id !== SE_CONSERVA) {
          liberarObjeto(sala.raiz);
          espera.delete(id);
        }
      }
    },
    get actual() {
      return actual;
    },
    get enEspera() {
      return [...espera.keys()];
    },
    liberar() {
      pedido++;
      if (actual) liberarObjeto(actual.raiz);
      actual = null;
      for (const sala of espera.values()) liberarObjeto(sala.raiz);
      espera.clear();
      carga.value = { estado: 'inactiva', progreso: 0 };
    },
  };
}
