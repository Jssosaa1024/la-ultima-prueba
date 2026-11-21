import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import type { Mesh, Object3D, Sprite } from 'three';
import { LUGARES } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { LIMITES_PANEL } from '../../src/debug/metricas';
import { crearEtiquetas, MAX_COMPANEROS } from '../../src/engine/coop/avatares';
import type { Lienzo } from '../../src/engine/coop/avatares';
import { crearMarcadores, MAX_MARCADORES } from '../../src/engine/coop/marcadores';
import { crearModeloDePrueba } from '../../src/engine/coop/personaje-prueba';
import { crearPersonajes } from '../../src/engine/coop/personajes';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { construirSala } from '../../src/engine/salas/construir';
import type { SenalCoop } from '../../src/signals/coop';

// T83b: con 4 jugadores (3 compañeros con su alias en cada pantalla) y las señales, ninguna sala
// pasa de los 40 draw calls de AGENTS.md, aunque se viera todo a la vez.
// T83c: los compañeros son personajes con piel, sin instanciar: una draw call cada uno (el
// pipeline une el cuerpo y la cabeza del paquete en una malla). Las 3 etiquetas son una sola
// malla. Total del cooperativo: 3 personajes + 1 de alias + 1 de señales = 5, como en T83b.

/** Draw calls de cada personaje (también los del paquete). */
const POR_PERSONAJE = 1;

/** Lienzo que no dibuja nada: aquí solo se cuentan objetos. */
const lienzoMudo = (): Lienzo => ({
  width: 0,
  height: 0,
  getContext: () =>
    new Proxy({}, { get: () => () => undefined, set: () => true }) as CanvasRenderingContext2D,
});

/**
 * Draw calls como máximo: cada malla, una por material, aunque ahora esté oculta (una animación
 * la puede mostrar); la malla instanciada solo si tiene instancias, y cada `Sprite` visible.
 * Un material con `visible = false` no se dibuja nunca (la caja invisible que choca y se toca
 * de una pieza por código): no cuenta.
 */
function maximoDeLlamadas(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    const malla = o as Mesh & { isInstancedMesh?: boolean; count?: number };
    if (malla.isMesh) {
      if (malla.isInstancedMesh && malla.count === 0) return;
      const materiales = Array.isArray(malla.material) ? malla.material : [malla.material];
      n += materiales.filter((m) => m.visible).length;
    }
    if ((o as Sprite).isSprite && o.visible) n++;
  });
  return n;
}

describe('presupuesto del cooperativo con 4 jugadores (T83b)', () => {
  it('personajes, alias y señales: 1 por personaje, 1 de los alias y 1 de las señales', () => {
    const personajes = crearPersonajes(crearModeloDePrueba());
    const etiquetas = crearEtiquetas(lienzoMudo);
    const camara = new PerspectiveCamera(70, 1, 0.05, 50);
    for (let i = 0; i < MAX_COMPANEROS; i++) {
      personajes.poner(
        `j_${i}`,
        (['coral', 'ambar', 'violeta'] as const)[i] ?? 'coral',
        i - 1,
        0,
        -4,
        0,
        0,
      );
      etiquetas.poner(i, i - 1, 0, -4, 'coral', 'buho');
    }
    personajes.terminar(0, camara);
    etiquetas.mostrar(MAX_COMPANEROS);
    const marcadores = crearMarcadores();
    const senales: SenalCoop[] = Array.from({ length: MAX_MARCADORES }, (_, n) => ({
      n,
      jugador: 'j_1',
      s: 1,
      x: 100 * n,
      y: 0,
      z: 100,
      frase: null,
      en: 0,
    }));
    expect(marcadores.cuadro(1000, 1, senales, () => 'coral')).toBe(MAX_MARCADORES);
    const coop =
      maximoDeLlamadas(personajes.grupo) +
      maximoDeLlamadas(etiquetas.malla) +
      maximoDeLlamadas(marcadores.malla);
    expect(coop).toBe(POR_PERSONAJE * MAX_COMPANEROS + 1 + 1);
    personajes.liberar();
    etiquetas.liberar();
    marcadores.liberar();
  });

  it.each(LUGARES)('%s, con todo a la vista, sigue dentro de los 40 draw calls', (lugar) => {
    const sala = construirSala(salaPorId(lugar));
    animacionDeSala(lugar, sala.raiz)?.actualizar(1 / 30);
    const coop = POR_PERSONAJE * MAX_COMPANEROS + 1 + 1;
    expect(maximoDeLlamadas(sala.raiz) + coop).toBeLessThanOrEqual(LIMITES_PANEL.drawCalls);
  });
});
