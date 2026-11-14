import { PerspectiveCamera, Vector2 } from 'three';
import type { WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { seguirTamano } from '../../src/engine/renderer';

/** Renderer falso: solo lo que usa `seguirTamano`. */
function rendererFalso(ancho: number, alto: number, bufer = { x: ancho, y: alto }) {
  const canvas = { width: ancho, height: alto };
  const llamadas: [number, number][] = [];
  const renderer = {
    domElement: canvas,
    getDrawingBufferSize: (v: Vector2) => v.set(bufer.x, bufer.y),
    setSize: (w: number, h: number) => {
      bufer = { x: w, y: h };
      llamadas.push([w, h]);
    },
  } as unknown as WebGLRenderer;
  return { renderer, canvas, llamadas };
}

describe('seguirTamano', () => {
  it('en el primer cuadro la cámara toma la proporción del canvas, aunque el búfer ya coincida', () => {
    const { renderer } = rendererFalso(491, 909);
    const camara = new PerspectiveCamera(70, 1, 0.05, 50);
    seguirTamano(renderer, camara);
    expect(camara.aspect).toBeCloseTo(491 / 909, 6);
  });

  it('si nada cambió, no vuelve a tocar el renderer', () => {
    const { renderer, llamadas } = rendererFalso(1280, 720);
    const camara = new PerspectiveCamera(70, 1, 0.05, 50);
    seguirTamano(renderer, camara);
    seguirTamano(renderer, camara);
    expect(llamadas).toHaveLength(1);
  });

  it('al girar el teléfono sigue el tamaño nuevo', () => {
    const { renderer, canvas, llamadas } = rendererFalso(491, 909);
    const camara = new PerspectiveCamera(70, 1, 0.05, 50);
    seguirTamano(renderer, camara);
    canvas.width = 909;
    canvas.height = 491;
    seguirTamano(renderer, camara);
    expect(llamadas.at(-1)).toEqual([909, 491]);
    expect(camara.aspect).toBeCloseTo(909 / 491, 6);
  });
});
