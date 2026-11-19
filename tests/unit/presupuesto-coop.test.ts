import { describe, expect, it } from 'vitest';
import type { Mesh, Object3D, Sprite } from 'three';
import { LUGARES } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { LIMITES_PANEL } from '../../src/debug/metricas';
import { crearAvatares, MAX_COMPANEROS } from '../../src/engine/coop/avatares';
import type { Lienzo } from '../../src/engine/coop/avatares';
import { crearMarcadores, MAX_MARCADORES } from '../../src/engine/coop/marcadores';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { construirSala } from '../../src/engine/salas/construir';
import type { SenalCoop } from '../../src/signals/coop';

// T83b: con 4 jugadores (3 avatares con su alias en cada pantalla) y las señales, ninguna sala
// pasa de los 40 draw calls de AGENTS.md, aunque se viera todo a la vez.

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
  it('avatares, alias y señales suman 5 draw calls', () => {
    const avatares = crearAvatares(lienzoMudo);
    for (let i = 0; i < MAX_COMPANEROS; i++) avatares.poner(i, i, 0, 0, 0, 'coral', 'buho');
    avatares.mostrar(MAX_COMPANEROS);
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
    // Las etiquetas cuelgan de la malla de los avatares: se cuentan con ella.
    const coop = maximoDeLlamadas(avatares.malla) + maximoDeLlamadas(marcadores.malla);
    expect(coop).toBe(1 + MAX_COMPANEROS + 1);
    avatares.liberar();
    marcadores.liberar();
  });

  it.each(LUGARES)('%s, con todo a la vista, sigue dentro de los 40 draw calls', (lugar) => {
    const sala = construirSala(salaPorId(lugar));
    animacionDeSala(lugar, sala.raiz)?.actualizar(1 / 30);
    const coop = 1 + MAX_COMPANEROS + 1;
    expect(maximoDeLlamadas(sala.raiz) + coop).toBeLessThanOrEqual(LIMITES_PANEL.drawCalls);
  });
});
