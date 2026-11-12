import { describe, expect, it } from 'vitest';
import { DT_MAX, crearBucle } from '../../src/engine/loop';
import type { EstadoBucle } from '../../src/engine/loop';

/** Documento falso: se puede ocultar y mostrar a mano. */
function documentoFalso(oculto = false) {
  const oyentes = new Set<() => void>();
  return {
    hidden: oculto,
    addEventListener: (_: 'visibilitychange', fn: () => void) => oyentes.add(fn),
    removeEventListener: (_: 'visibilitychange', fn: () => void) => oyentes.delete(fn),
    cambiar(oculto: boolean) {
      this.hidden = oculto;
      oyentes.forEach((fn) => fn());
    },
    get oyentes() {
      return oyentes.size;
    },
  };
}

/** `setAnimationLoop` falso: guarda la función y deja avanzar el tiempo a mano. */
function programadorFalso() {
  let cuadro: ((t: number) => void) | null = null;
  return {
    programar: (fn: ((t: number) => void) | null) => {
      cuadro = fn;
    },
    get corriendo() {
      return cuadro !== null;
    },
    tic(t: number) {
      cuadro?.(t);
    },
  };
}

describe('bucle de juego', () => {
  it('llama a alCuadro con el paso en segundos y lo limita a DT_MAX', () => {
    const doc = documentoFalso();
    const reloj = programadorFalso();
    const pasos: number[] = [];
    crearBucle({ programar: reloj.programar, alCuadro: (dt) => pasos.push(dt), documento: doc });

    reloj.tic(1000);
    reloj.tic(1016);
    reloj.tic(1049);
    reloj.tic(3000); // un tirón de casi 2 s
    expect(pasos).toEqual([0, 0.016, 0.033, DT_MAX]);
  });

  it('se pausa al ocultar la pestaña y al volver no salta el tiempo', () => {
    const doc = documentoFalso();
    const reloj = programadorFalso();
    const estados: EstadoBucle[] = [];
    const pasos: number[] = [];
    const bucle = crearBucle({
      programar: reloj.programar,
      alCuadro: (dt) => pasos.push(dt),
      alCambiarEstado: (e) => estados.push(e),
      documento: doc,
    });
    reloj.tic(0);
    reloj.tic(16);

    doc.cambiar(true);
    expect(reloj.corriendo).toBe(false);
    expect(bucle.estado).toBe('pausado');

    doc.cambiar(false);
    expect(reloj.corriendo).toBe(true);
    reloj.tic(60_000);
    reloj.tic(60_016);
    expect(pasos).toEqual([0, 0.016, 0, 0.016]);
    expect(estados).toEqual(['activo', 'pausado', 'activo']);
  });

  it('arranca en pausa si la pestaña ya está oculta', () => {
    const doc = documentoFalso(true);
    const reloj = programadorFalso();
    const bucle = crearBucle({ programar: reloj.programar, alCuadro: () => {}, documento: doc });
    expect(bucle.estado).toBe('pausado');
    expect(reloj.corriendo).toBe(false);
    doc.cambiar(false);
    expect(bucle.estado).toBe('activo');
  });

  it('detener quita el oyente y no vuelve a arrancar', () => {
    const doc = documentoFalso();
    const reloj = programadorFalso();
    const bucle = crearBucle({ programar: reloj.programar, alCuadro: () => {}, documento: doc });
    bucle.detener();
    expect(bucle.estado).toBe('detenido');
    expect(reloj.corriendo).toBe(false);
    expect(doc.oyentes).toBe(0);
    doc.cambiar(true);
    doc.cambiar(false);
    expect(reloj.corriendo).toBe(false);
  });
});
