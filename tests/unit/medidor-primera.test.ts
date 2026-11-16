import { afterEach, describe, expect, it } from 'vitest';
import { Group } from 'three';
import type { WebGLRenderer } from 'three';
import { crearMedidor } from '../../src/debug/medidor';
import { metricas } from '../../src/debug/metricas';

// Ola 6: el panel ?debug=1 no se da por «listo» con 0 cuadros medidos (la e2e exportaba el
// JSON enseguida y a veces salía p95 = 0).

const rendererFalso = {
  info: { render: { triangles: 0, calls: 0 }, memory: { geometries: 0, textures: 0 } },
} as unknown as WebGLRenderer;

const inicial = metricas.peek();
afterEach(() => {
  metricas.value = inicial;
});

describe('primera publicación del medidor', () => {
  it('espera medio segundo de cuadros y ya trae el p95', () => {
    const medidor = crearMedidor({
      renderer: rendererFalso,
      escena: new Group(),
      sala: () => 'porteria',
      pixeles: () => ({ equipo: 1, usado: 1 }),
    });
    medidor.cuadro(1000);
    expect(metricas.value.lista).toBe(false);
    for (let t = 1016; t < 1500; t += 16) medidor.cuadro(t);
    expect(metricas.value.lista).toBe(false);
    medidor.cuadro(1512);
    expect(metricas.value.lista).toBe(true);
    expect(metricas.value.cuadro.cuadros).toBeGreaterThan(20);
    expect(metricas.value.cuadro.p95Ms).toBeGreaterThan(0);
    medidor.liberar();
  });
});
