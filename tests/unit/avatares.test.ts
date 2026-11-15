import { describe, expect, it } from 'vitest';
import type { Mesh, Object3D, Sprite } from 'three';
import {
  ALTURA_ETIQUETA,
  HEX_COLOR,
  MAX_COMPANEROS,
  NOMBRE_ALIAS,
  crearAvatares,
  crearGeometriaAvatar,
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

/** Draw calls que suma el grupo de avatares: la malla instanciada (si tiene instancias) y cada etiqueta visible. */
function llamadas(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    if ((o as Mesh).isMesh && (o as unknown as { count: number }).count > 0) n++;
    if ((o as Sprite).isSprite && o.visible) n++;
  });
  return n;
}

describe('avatares de bajo polígono (T83)', () => {
  it('cada avatar tiene muy pocos triángulos (presupuesto: 2.000)', () => {
    const g = crearGeometriaAvatar();
    const triangulos = g.getAttribute('position').count / 3;
    expect(triangulos).toBeLessThan(200);
    expect(g.getAttribute('color')).toBeDefined();
  });

  it('con 4 jugadores (3 compañeros) suman como máximo 4 draw calls', () => {
    const a = crearAvatares(lienzoFalso([]));
    expect(llamadas(a.malla)).toBe(0);
    for (let i = 0; i < MAX_COMPANEROS; i++) a.poner(i, i, 0, 0, 0, 'coral', 'buho');
    a.mostrar(3);
    expect(llamadas(a.malla)).toBe(4);
    a.mostrar(1);
    expect(llamadas(a.malla)).toBe(2);
    // Nunca más de 3 compañeros.
    a.mostrar(9);
    expect(a.malla.count).toBe(MAX_COMPANEROS);
    a.liberar();
  });

  it('la etiqueta va encima de la cabeza y se dibuja solo cuando cambia el alias', () => {
    const textos: string[] = [];
    const a = crearAvatares(lienzoFalso(textos));
    a.poner(0, 2, 0, -3, 0, 'turquesa', 'colibri');
    a.poner(0, 2.5, 0, -3, 0, 'turquesa', 'colibri');
    a.mostrar(1);
    expect(textos).toEqual(['Colibrí']);
    const etiqueta = a.etiquetas[0];
    expect(etiqueta?.position.toArray()).toEqual([2.5, ALTURA_ETIQUETA, -3]);
    a.poner(0, 2.5, 0, -3, 0, 'turquesa', 'tucan');
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
