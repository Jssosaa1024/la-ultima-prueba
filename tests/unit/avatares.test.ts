import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import {
  ALTO_ETIQUETA,
  ALTURA_ETIQUETA,
  ANCHO_ETIQUETA,
  HEX_COLOR,
  MAX_COMPANEROS,
  NOMBRE_ALIAS,
  crearEtiquetas,
} from '../../src/engine/coop/avatares';
import type { Lienzo } from '../../src/engine/coop/avatares';
import { COLOR, NOMBRE_ALIAS as NOMBRES_UI } from '../../src/ui/coop/nombres';

/** Lienzo falso: cuenta los textos dibujados. */
function lienzoFalso(textos: string[]): () => Lienzo {
  return () => {
    const contexto = new Proxy(
      {},
      {
        get: (_o, clave) =>
          clave === 'fillText' ? (t: string) => textos.push(t) : () => undefined,
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    return { width: 0, height: 0, getContext: () => contexto };
  };
}

describe('alias de los compañeros (T83, T83c)', () => {
  it('las 3 etiquetas son una sola draw call y solo se ven las que se muestran', () => {
    const a = crearEtiquetas(lienzoFalso([]));
    expect(a.malla.visible).toBe(false);
    for (let i = 0; i < MAX_COMPANEROS; i++) a.poner(i, i, 0, 0, 'coral', 'buho');
    a.mostrar(3);
    expect(a.malla.visible).toBe(true);
    expect(a.malla.children).toHaveLength(0);
    a.mostrar(1);
    expect(a.centro(0)).not.toBeNull();
    expect(a.centro(1)).toBeNull();
    // Nunca más de 3 compañeros.
    a.mostrar(9);
    expect(a.centro(MAX_COMPANEROS - 1)).not.toBeNull();
    a.mostrar(0);
    expect(a.malla.visible).toBe(false);
    a.liberar();
  });

  it('cada etiqueta mira a la cámara, del tamaño de antes, y las ocultas no dibujan nada', () => {
    const a = crearEtiquetas(lienzoFalso([]));
    a.poner(0, 2, 0, -3, 'coral', 'buho');
    a.poner(1, 0, 0, -3, 'ambar', 'oso');
    a.mostrar(1);
    const camara = new PerspectiveCamera();
    camara.updateMatrixWorld();
    a.orientar(camara);
    const p = a.malla.geometry.getAttribute('position');
    const xs = [0, 1, 2, 3].map((v) => p.getX(v));
    const ys = [0, 1, 2, 3].map((v) => p.getY(v));
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(ANCHO_ETIQUETA);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(ALTO_ETIQUETA);
    expect(new Set([0, 1, 2, 3].map((v) => p.getZ(v)))).toEqual(new Set([-3]));
    // La segunda no se muestra: sus cuatro vértices quedan en el mismo punto.
    const segunda = [4, 5, 6, 7].map((v) => `${p.getX(v)},${p.getY(v)},${p.getZ(v)}`);
    expect(new Set(segunda).size).toBe(1);
    a.liberar();
  });

  it('la etiqueta va encima de la cabeza y se dibuja solo cuando cambia el alias', () => {
    const textos: string[] = [];
    const a = crearEtiquetas(lienzoFalso(textos));
    a.poner(0, 2, 0, -3, 'turquesa', 'colibri');
    a.poner(0, 2.5, 0, -3, 'turquesa', 'colibri');
    a.mostrar(1);
    expect(textos).toEqual(['Colibrí']);
    expect(a.centro(0)?.toArray()).toEqual([2.5, ALTURA_ETIQUETA, -3]);
    a.poner(0, 2.5, 0, -3, 'turquesa', 'tucan');
    expect(textos).toEqual(['Colibrí', 'Tucán']);
    a.liberar();
  });

  it('nombres y colores iguales a los de la interfaz', () => {
    expect(NOMBRE_ALIAS).toEqual(NOMBRES_UI);
    for (const [c, { css }] of Object.entries(COLOR)) {
      expect(`#${HEX_COLOR[c as keyof typeof HEX_COLOR].toString(16).padStart(6, '0')}`).toBe(css);
    }
  });
});
