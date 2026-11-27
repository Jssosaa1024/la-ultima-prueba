import { afterEach, describe, expect, it, vi } from 'vitest';
import { aviso, cerrarAviso, type Aviso } from '../../src/signals/interfaz';
import { colaVoz } from '../../src/signals/voz';

// Dos frases de prueba: una escrita y una que dice La Voz (con una línea que sí existe en el
// guion, para no depender de las que la sesión B vaya agregando).
vi.mock('../../src/content/puertas-falsas', () => {
  const frases = [
    { id: 'escrita', rotulo: 'Aula 10-A', texto: 'Cerrada. No hay nadie.' },
    { id: 'hablada', rotulo: 'Cuarto del aseo', voz: 'voz-intro-2' },
    { id: 'sin-linea', rotulo: 'Baños', voz: 'voz-que-no-existe' },
  ];
  return {
    FRASES_PUERTAS_FALSAS: frases,
    frasePuertaFalsa: (id: string) => frases.find((f) => f.id === id) ?? null,
  };
});

const { tocarPuertaFalsa } = await import('../../src/signals/puertas-falsas');
const { duracionDeAviso, textoDeAviso, textoDeAvisoParaLector, FRASE_RESPALDO } =
  await import('../../src/ui/hud/formato');

/** El aviso que dejó el último toque (falla si no hay). */
function ultimoAviso(): Aviso {
  const a = aviso.value;
  if (!a) throw new Error('la puerta no dejó aviso');
  return a;
}

afterEach(() => {
  cerrarAviso();
  colaVoz.value = [];
});

describe('puertas falsas: el toque', () => {
  it('una frase escrita sale en el aviso, con el rótulo para el lector de pantalla', () => {
    tocarPuertaFalsa('escrita', new Set());
    const a = aviso.value;
    expect(a).toEqual({ t: 'puerta_falsa', frase: 'escrita', hablada: false });
    if (!a) throw new Error('sin aviso');
    expect(textoDeAviso(a)).toBe('Cerrada. No hay nadie.');
    expect(textoDeAvisoParaLector(a)).toBe('Aula 10-A: Cerrada. No hay nadie.');
    expect(colaVoz.value).toEqual([]);
  });

  it('cada toque es un aviso nuevo, para que vuelva a sonar y a verse', () => {
    tocarPuertaFalsa('escrita', new Set());
    const primero = aviso.value;
    tocarPuertaFalsa('escrita', new Set());
    expect(aviso.value).not.toBe(primero);
  });

  it('La Voz dice su frase solo la primera vez; después sale escrita', () => {
    const dichas = new Set<string>();
    tocarPuertaFalsa('hablada', dichas);
    expect(colaVoz.value).toEqual(['voz-intro-2']);
    expect(aviso.value).toEqual({ t: 'puerta_falsa', frase: 'hablada', hablada: true });
    // Mientras habla, el subtítulo ya lo anuncia: el lector no lo repite.
    expect(textoDeAvisoParaLector(ultimoAviso())).toBeNull();

    colaVoz.value = [];
    tocarPuertaFalsa('hablada', dichas);
    expect(colaVoz.value).toEqual([]);
    expect(aviso.value).toEqual({ t: 'puerta_falsa', frase: 'hablada', hablada: false });
    expect(textoDeAviso(ultimoAviso())).toBe(
      'Cinco salas, cinco sellos. Cada sello guarda una prueba de un caso de 1991.',
    );
  });

  it('si la línea de La Voz no existe, la puerta igual responde', () => {
    tocarPuertaFalsa('sin-linea', new Set());
    expect(aviso.value).toEqual({ t: 'puerta_falsa', frase: 'sin-linea', hablada: false });
    expect(textoDeAviso(ultimoAviso())).toBe(FRASE_RESPALDO);
  });

  it('una frase que no está en el contenido usa la de respaldo', () => {
    tocarPuertaFalsa('no-existe', new Set());
    expect(textoDeAviso(ultimoAviso())).toBe(FRASE_RESPALDO);
    expect(textoDeAvisoParaLector(ultimoAviso())).toBe(FRASE_RESPALDO);
  });

  it('el aviso de una puerta falsa se va antes que los demás, entre 3,5 y 6 s', () => {
    const corto = duracionDeAviso({ t: 'puerta_falsa', frase: 'escrita', hablada: false });
    expect(corto).toBeGreaterThanOrEqual(3500);
    expect(corto).toBeLessThan(6000);
    expect(duracionDeAviso({ t: 'puerta_cerrada', sala: 2 })).toBe(6000);
  });
});
