/**
 * Cargador de salas (T20): entrar a una sala, liberar la anterior y preparar la siguiente.
 *
 * - **compileAsync**: antes de mostrar una sala se compilan sus shaders sin bloquear el
 *   cuadro, para que entrar no dé un tirón en un celular de gama baja. Se compilan con las
 *   luces que la sala va a tener al dibujarse, no con las de la anterior (T20d).
 * - **Memoria**: en la GPU solo quedan la portería y la sala actual (especificación,
 *   sección 0). Al salir de una sala se libera con `dispose()`; la portería se conserva.
 * - **Precarga**: la siguiente sala se arma en la CPU en un momento libre, sin subirla a la
 *   GPU; al entrar solo falta compilar y dibujar.
 *
 * Las salas son geometría por código (`construir.ts`). Lo que se descarga (texturas, T19g) se
 * pone después con `vestir`, una sola vez por sala armada, antes de compilar; la precarga solo
 * deja esos archivos en la caché, sin decodificarlos (`precalentar`).
 */
import type { Camera, Light, Object3D, Scene } from 'three';
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
  /** Descarga y pone lo que la sala usa (T19g). No debe fallar: lo que no carga queda como está. */
  vestir?: (construida: SalaConstruida, sala: Sala) => Promise<void>;
  /** Deja en la caché los archivos de la sala, sin decodificarlos. */
  precalentar?: (sala: Sala) => void;
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
  vestir,
  precalentar,
}: OpcionesCargador): CargadorSalas {
  const espera = new Map<Lugar, SalaConstruida>();
  /** Las salas armadas que ya se vistieron (la portería se viste una sola vez). */
  const vestidas = new WeakSet<SalaConstruida>();
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

  /**
   * Compila la sala nueva solo con sus luces (T20d). `compile` de three suma las luces visibles
   * de la escena y las de la sala nueva: con la sala actual todavía en la escena vería dos
   * hemisféricas y dos direccionales, y en el primer cuadro, con una de cada una, three tendría
   * que compilar otra vez lo que falte (el tirón que se quería evitar). Las luces de la sala
   * actual se apagan solo mientras three las cuenta, que es la parte síncrona de
   * `compileAsync`: se prenden antes de que se dibuje cualquier cuadro.
   */
  const compilarConSusLuces = (nueva: SalaConstruida): Promise<unknown> => {
    const apagadas: Object3D[] = [];
    actual?.raiz.traverse((o) => {
      if ((o as Light).isLight && o.visible) {
        o.visible = false;
        apagadas.push(o);
      }
    });
    try {
      return renderer.compileAsync(nueva.raiz, camara, escena);
    } finally {
      for (const luz of apagadas) luz.visible = true;
    }
  };

  return {
    async entrar(lugar) {
      if (actual?.id === lugar) return actual;
      const este = ++pedido;
      carga.value = { estado: 'cargando', progreso: 0 };
      try {
        const nueva = tomar(lugar);
        carga.value = { estado: 'cargando', progreso: 0.3 };
        if (vestir && !vestidas.has(nueva)) {
          vestidas.add(nueva);
          await vestir(nueva, distribucion(lugar)).catch((error: unknown) => {
            console.warn(`No se pudo vestir ${lugar}`, error);
          });
        }
        carga.value = { estado: 'cargando', progreso: 0.5 };
        await compilarConSusLuces(nueva);
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
      const datos = distribucion(lugar);
      espera.set(lugar, construir(datos));
      precalentar?.(datos);
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
