import { afterEach, describe, expect, it, vi } from 'vitest';
import { tieneWebGL2 } from '../../src/engine/compatibilidad';

/** Simula `window` y `document` mínimos: el test corre en Node, sin navegador. */
function simular(opciones: {
  busqueda?: string;
  webgl2Definido?: boolean;
  contexto?: 'ok' | 'null' | 'error';
}): { loseContext: ReturnType<typeof vi.fn> } {
  const { busqueda = '', webgl2Definido = true, contexto = 'ok' } = opciones;
  const loseContext = vi.fn();
  vi.stubGlobal('window', { location: { search: busqueda } });
  if (webgl2Definido) vi.stubGlobal('WebGL2RenderingContext', function WebGL2RenderingContext() {});
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: (tipo: string) => {
        if (contexto === 'error') throw new Error('GPU en lista negra');
        if (contexto === 'null' || tipo !== 'webgl2') return null;
        return { getExtension: () => ({ loseContext }) };
      },
    }),
  });
  return { loseContext };
}

describe('tieneWebGL2', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('es true si el navegador crea un contexto WebGL2', () => {
    simular({});
    expect(tieneWebGL2()).toBe(true);
  });

  it('libera el contexto de prueba al terminar', () => {
    const { loseContext } = simular({});
    tieneWebGL2();
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('es false si no existe WebGL2RenderingContext', () => {
    simular({ webgl2Definido: false });
    expect(tieneWebGL2()).toBe(false);
  });

  it('es false si getContext devuelve null', () => {
    simular({ contexto: 'null' });
    expect(tieneWebGL2()).toBe(false);
  });

  it('es false si getContext lanza un error', () => {
    simular({ contexto: 'error' });
    expect(tieneWebGL2()).toBe(false);
  });

  it('es false con ?sinwebgl2=1, aunque el equipo lo tenga', () => {
    simular({ busqueda: '?sinwebgl2=1' });
    expect(tieneWebGL2()).toBe(false);
  });
});
