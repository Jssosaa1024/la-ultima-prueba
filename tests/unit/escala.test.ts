import { describe, expect, it } from 'vitest';
import { crearEscalaDinamica, ESCALA_MAX, ESCALA_MIN, VENTANA_S } from '../../src/engine/escala';

// T13: escala dinámica de resolución según los fps medidos.

/** Registra `segundos` de cuadros a `fps` y devuelve la última escala nueva (o null). */
function jugar(escala: ReturnType<typeof crearEscalaDinamica>, fps: number, segundos: number) {
  let ultima: number | null = null;
  // Un cuadro de más: sumar 1/60 muchas veces queda un pelo por debajo de 2 s.
  for (let t = 0; t <= segundos * fps; t++) {
    const nueva = escala.registrar(1 / fps);
    if (nueva !== null) ultima = nueva;
  }
  return ultima;
}

describe('escala dinámica de resolución', () => {
  it('empieza en 1 y no cambia a 30 fps o más', () => {
    const e = crearEscalaDinamica();
    expect(e.valor).toBe(ESCALA_MAX);
    expect(jugar(e, 30, 10)).toBeNull();
    expect(jugar(e, 60, 10)).toBeNull();
    expect(e.valor).toBe(ESCALA_MAX);
  });

  it('a 20 fps baja cada 2 s hasta 0,5 y no más', () => {
    const e = crearEscalaDinamica();
    expect(jugar(e, 20, VENTANA_S)).toBe(0.85);
    jugar(e, 20, 20);
    expect(e.valor).toBe(ESCALA_MIN);
  });

  it('con fps de sobra vuelve a subir despacio hasta 1', () => {
    const e = crearEscalaDinamica(0.5);
    expect(jugar(e, 60, VENTANA_S)).toBe(0.55);
    jugar(e, 60, 40);
    expect(e.valor).toBe(ESCALA_MAX);
  });

  it('entre 27 y 50 fps se queda donde está: no sube y baja sin parar', () => {
    const e = crearEscalaDinamica(0.7);
    expect(jugar(e, 40, 10)).toBeNull();
    expect(e.valor).toBe(0.7);
  });

  it('el primer cuadro tras una pausa (dt = 0) no cuenta, y reiniciar olvida la ventana', () => {
    const e = crearEscalaDinamica();
    expect(e.registrar(0)).toBeNull();
    jugar(e, 10, VENTANA_S * 0.9);
    e.reiniciar();
    // Sin reiniciar, esto cerraría la ventana con unos 15 fps.
    expect(jugar(e, 60, VENTANA_S * 0.5)).toBeNull();
    expect(e.valor).toBe(ESCALA_MAX);
  });

  it('la escala inicial se limita a 0,5–1', () => {
    expect(crearEscalaDinamica(0.1).valor).toBe(ESCALA_MIN);
    expect(crearEscalaDinamica(3).valor).toBe(ESCALA_MAX);
  });
});
