import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { iniciarControlador } from '../../src/signals/controlador';
import {
  datosEncontrados,
  limpiarNota,
  MAX_NOTA,
  notas,
  reiniciarCuaderno,
} from '../../src/signals/cuaderno';
import { quitarEjemplo } from '../../src/signals/ejemplo';
import { reiniciarInterfaz } from '../../src/signals/interfaz';
import { reiniciarPartida } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';

let detener: () => void;

beforeEach(() => {
  detener = iniciarControlador({ documento: null });
  enviar({ t: 'iniciar', modo: 'individual' });
});

afterEach(() => {
  detener();
  quitarEjemplo();
  reiniciarPartida();
  reiniciarInterfaz();
  reiniciarCuaderno();
});

describe('limpiarNota', () => {
  it('quita espacios a los lados', () => {
    expect(limpiarNota('  20.000 × 0,85  ')).toBe('20.000 × 0,85');
  });

  it(`corta en ${MAX_NOTA} caracteres sin partir emojis ni tildes`, () => {
    const largo = 'á'.repeat(MAX_NOTA + 20);
    expect([...limpiarNota(largo)]).toHaveLength(MAX_NOTA);
    expect(limpiarNota('😀'.repeat(MAX_NOTA + 1))).toBe('😀'.repeat(MAX_NOTA));
  });
});

describe('notas del cuaderno', () => {
  it('agrega y borra notas', () => {
    enviar({ t: 'nota', op: 'agregar', texto: '4 × 5.000 = 20.000' });
    enviar({ t: 'nota', op: 'agregar', texto: '15 % de 20.000' });
    expect(notas.value.map((n) => n.texto)).toEqual(['4 × 5.000 = 20.000', '15 % de 20.000']);
    const primera = notas.value[0];
    if (!primera) throw new Error('falta la nota');
    enviar({ t: 'nota', op: 'borrar', id: primera.id });
    expect(notas.value.map((n) => n.texto)).toEqual(['15 % de 20.000']);
  });

  it('ignora notas vacías', () => {
    enviar({ t: 'nota', op: 'agregar', texto: '   ' });
    expect(notas.value).toEqual([]);
  });

  it('una partida nueva empieza con el cuaderno vacío', () => {
    enviar({ t: 'nota', op: 'agregar', texto: 'algo' });
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(notas.value).toEqual([]);
  });
});

describe('datos encontrados', () => {
  it('examinar un objeto lo anota una sola vez', () => {
    enviar({ t: 'ejemplo', final: null });
    enviar({ t: 'accion', objeto: 's1-factura', accion: 'examinar' });
    expect(datosEncontrados.value).toEqual(['s1-factura']);
  });
});
