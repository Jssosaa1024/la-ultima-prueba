import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  abrirInspeccion,
  cerrarPanel,
  controlesActivos,
  enfocado,
  inspeccionando,
  panel,
  reiniciarInterfaz,
} from '../../src/signals/interfaz';
import {
  DURACION_MS,
  fase,
  reiniciarPartida,
  reloj,
  restanteEn,
  SALAS_CON_SELLO,
  sellos,
  totalSellos,
} from '../../src/signals/partida';
import { enviar, escuchar, type Comando } from '../../src/signals/puente';

afterEach(() => {
  reiniciarPartida();
  reiniciarInterfaz();
});

describe('restanteEn', () => {
  it('descuenta desde el instante de referencia cuando corre', () => {
    expect(restanteEn({ restanteMs: 10_000, pausado: false, desde: 1_000 }, 4_000)).toBe(7_000);
  });

  it('no descuenta en pausa', () => {
    expect(restanteEn({ restanteMs: 10_000, pausado: true, desde: 1_000 }, 99_000)).toBe(10_000);
  });

  it('nunca devuelve tiempo negativo', () => {
    expect(restanteEn({ restanteMs: 1_000, pausado: false, desde: 0 }, 5_000)).toBe(0);
  });
});

describe('estado de la partida', () => {
  it('cinco salas dan sello y la portería no', () => {
    expect(SALAS_CON_SELLO).toHaveLength(5);
    expect(SALAS_CON_SELLO).not.toContain('porteria');
  });

  it('totalSellos sigue a sellos', () => {
    sellos.value = ['s1-cooperativa', 's2-laboratorio'];
    expect(totalSellos.value).toBe(2);
  });

  it('reiniciarPartida vuelve a 40 minutos en pausa y sin sellos', () => {
    fase.value = 'jugando';
    sellos.value = ['s1-cooperativa'];
    reloj.value = { restanteMs: 5, pausado: false, desde: 3 };
    reiniciarPartida();
    expect(fase.value).toBe('inicio');
    expect(sellos.value).toEqual([]);
    expect(reloj.value).toEqual({ restanteMs: DURACION_MS, pausado: true, desde: 0 });
  });
});

describe('estado de la interfaz', () => {
  it('los controles solo están activos jugando y sin panel', () => {
    expect(controlesActivos.value).toBe(false);
    fase.value = 'jugando';
    expect(controlesActivos.value).toBe(true);
    abrirInspeccion('s1-factura');
    expect(panel.value).toBe('inspeccion');
    expect(inspeccionando.value).toBe('s1-factura');
    expect(controlesActivos.value).toBe(false);
    cerrarPanel();
    expect(inspeccionando.value).toBeNull();
    expect(controlesActivos.value).toBe(true);
  });

  it('reiniciarInterfaz quita el objeto enfocado', () => {
    enfocado.value = { id: 's1-caja', nombre: 'Caja', accion: 'examinar' };
    reiniciarInterfaz();
    expect(enfocado.value).toBeNull();
  });
});

describe('puente de órdenes', () => {
  it('entrega cada orden a todos los oyentes, en orden', () => {
    const recibidas: string[] = [];
    const a = escuchar((c) => recibidas.push(`a:${c.t}`));
    const b = escuchar((c) => recibidas.push(`b:${c.t}`));
    enviar({ t: 'pausar' });
    enviar({ t: 'reanudar' });
    a();
    b();
    expect(recibidas).toEqual(['a:pausar', 'b:pausar', 'a:reanudar', 'b:reanudar']);
  });

  it('deja de entregar después de cancelar la suscripción', () => {
    const oyente = vi.fn<(c: Comando) => void>();
    const cancelar = escuchar(oyente);
    cancelar();
    enviar({ t: 'salir' });
    expect(oyente).not.toHaveBeenCalled();
  });

  it('si un oyente falla, los demás reciben la orden y el error no se pierde', async () => {
    const segundo = vi.fn<(c: Comando) => void>();
    const errores: unknown[] = [];
    const microtarea = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((fn) => {
      try {
        fn();
      } catch (e) {
        errores.push(e);
      }
    });
    const a = escuchar(() => {
      throw new Error('falló');
    });
    const b = escuchar(segundo);
    enviar({ t: 'iniciar', modo: 'individual' });
    a();
    b();
    microtarea.mockRestore();
    expect(segundo).toHaveBeenCalledWith({ t: 'iniciar', modo: 'individual' });
    expect(errores).toHaveLength(1);
  });
});
