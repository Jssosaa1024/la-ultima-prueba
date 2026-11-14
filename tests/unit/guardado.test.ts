import { describe, expect, it } from 'vitest';
import { PUZZLES } from '../../src/content/puzzles';
import {
  borrarGuardado,
  cargar,
  CLAVE_GUARDADO,
  guardar,
  leerGuardado,
  type Almacen,
  type Guardado,
} from '../../src/game/guardado';
import { aplicar, crearPartida, type Accion, type Partida } from '../../src/game/partida';
import { PISTAS_INICIALES } from '../../src/game/pistas';

/** `localStorage` de mentira, en memoria. */
function memoria(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
}

/** Un almacén que falla como Safari en modo privado o con la cuota llena. */
const roto: Almacen = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const varias = (p: Partida, acciones: Accion[]): Partida => acciones.reduce(aplicar, p);

/** Sala 1 resuelta y la sala 2 a mitad, con el jugador adentro. */
const enCurso = (): Guardado => ({
  v: 2,
  partida: varias(crearPartida(), [
    { t: 'entrar', sala: 's1-cooperativa' },
    { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 },
    { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 1 },
    { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 2 },
    { t: 'volver_porteria' },
    { t: 'entrar', sala: 's2-laboratorio' },
    { t: 'resolver_etapa', sala: 's2-laboratorio', etapa: 0 },
    { t: 'recoger_grabacion', grabacion: 'grab-1' },
  ]),
  restanteMs: 31 * 60 * 1000,
  pistas: {
    's1-cooperativa': { msEnEtapa: 0, intentosEnEtapa: 0, ofrecidas: 1, vistas: 1 },
    's2-laboratorio': { ...PISTAS_INICIALES, msEnEtapa: 45_000, intentosEnEtapa: 2 },
  },
  mecanismos: {
    's2-laboratorio': {
      a: { nivel: 10, caudal: 4, visible: true },
      b: { nivel: 50, caudal: -2, visible: true },
    },
  },
  notas: [{ id: 'n1', texto: 'B baja 2 cm cada segundo' }],
  datos: ['s2-hoja-ayer'],
  inventario: ['porteria-linterna', 'porteria-cuaderno'],
});

/** Guarda, cambia un campo del JSON y vuelve a leer. */
function conCambio(cambio: (g: Record<string, unknown>) => void): Guardado | null {
  const g = JSON.parse(JSON.stringify(enCurso())) as Record<string, unknown>;
  cambio(g);
  return leerGuardado(g, PUZZLES);
}

describe('guardar y reanudar (T30)', () => {
  it('lo guardado se lee igual al recargar', () => {
    const almacen = memoria();
    expect(guardar(almacen, enCurso())).toBe(true);
    expect(cargar(almacen, PUZZLES)).toEqual(enCurso());
  });

  it('sin nada guardado no hay partida que reanudar', () => {
    expect(cargar(memoria(), PUZZLES)).toBeNull();
  });

  it('un final borra el guardado', () => {
    const almacen = memoria();
    guardar(almacen, enCurso());
    const terminada = { ...enCurso(), partida: aplicar(enCurso().partida, { t: 'pedir_ayuda' }) };
    expect(guardar(almacen, terminada)).toBe(false);
    expect(almacen.datos.has(CLAVE_GUARDADO)).toBe(false);
  });

  it('borrar quita la partida guardada', () => {
    const almacen = memoria();
    guardar(almacen, enCurso());
    borrarGuardado(almacen);
    expect(cargar(almacen, PUZZLES)).toBeNull();
  });

  it('si el almacenamiento falla, se sigue jugando sin errores', () => {
    expect(guardar(roto, enCurso())).toBe(false);
    expect(cargar(roto, PUZZLES)).toBeNull();
    expect(() => borrarGuardado(roto)).not.toThrow();
  });

  it('ignora texto que no es JSON o de otra versión', () => {
    const almacen = memoria();
    almacen.setItem(CLAVE_GUARDADO, '{no es json');
    expect(cargar(almacen, PUZZLES)).toBeNull();
    // La versión 1 no tenía inventario: un guardado viejo no se reanuda a medias.
    expect(conCambio((g) => (g['v'] = 1))).toBeNull();
    expect(conCambio((g) => (g['v'] = 3))).toBeNull();
    expect(leerGuardado(null, PUZZLES)).toBeNull();
    expect(leerGuardado([], PUZZLES)).toBeNull();
  });

  it('rechaza campos de más (incluido __proto__)', () => {
    expect(conCambio((g) => (g['extra'] = 1))).toBeNull();
    const texto = JSON.stringify(enCurso()).replace('"v":2', '"__proto__":{"x":1},"v":2');
    expect(leerGuardado(JSON.parse(texto), PUZZLES)).toBeNull();
  });

  it('rechaza una partida imposible', () => {
    // Etapas fuera de rango.
    expect(
      conCambio(
        (g) => ((g['partida'] as { etapas: Record<string, number> }).etapas['s1-cooperativa'] = 4),
      ),
    ).toBeNull();
    // Avance en una sala que aún no se abre.
    expect(
      conCambio(
        (g) => ((g['partida'] as { etapas: Record<string, number> }).etapas['s4-biblioteca'] = 1),
      ),
    ).toBeNull();
    // Estar dentro de una sala cerrada.
    expect(
      conCambio((g) => ((g['partida'] as { lugar: string }).lugar = 's5-rectoria')),
    ).toBeNull();
    // Una grabación de una sala cerrada, repetida o inventada.
    expect(
      conCambio(
        (g) => ((g['partida'] as { grabaciones: string[] }).grabaciones = ['grab-1', 'grab-3']),
      ),
    ).toBeNull();
    expect(
      conCambio(
        (g) => ((g['partida'] as { grabaciones: string[] }).grabaciones = ['grab-1', 'grab-1']),
      ),
    ).toBeNull();
    expect(
      conCambio((g) => ((g['partida'] as { grabaciones: string[] }).grabaciones = ['grab-7'])),
    ).toBeNull();
    // Una partida terminada no se reanuda.
    expect(conCambio((g) => ((g['partida'] as { fase: string }).fase = 'final'))).toBeNull();
  });

  it('rechaza un reloj imposible', () => {
    expect(conCambio((g) => (g['restanteMs'] = -1))).toBeNull();
    expect(conCambio((g) => (g['restanteMs'] = 41 * 60 * 1000))).toBeNull();
    expect(conCambio((g) => (g['restanteMs'] = '30'))).toBeNull();
  });

  it('rechaza pistas imposibles o de salas que no existen', () => {
    expect(
      conCambio(
        (g) => ((g['pistas'] as Record<string, unknown>)['sotano'] = { ...PISTAS_INICIALES }),
      ),
    ).toBeNull();
    expect(
      conCambio(
        (g) =>
          ((g['pistas'] as Record<string, unknown>)['s1-cooperativa'] = {
            ...PISTAS_INICIALES,
            vistas: 2,
          }),
      ),
    ).toBeNull();
  });

  it('descarta solo los ajustes de un mecanismo que ya no son válidos', () => {
    const g = conCambio((x) => {
      const m = x['mecanismos'] as Record<string, { a: { caudal: number } }>;
      const s2 = m['s2-laboratorio'];
      if (s2) s2.a.caudal = 99;
      m['s1-cooperativa'] = { a: { caudal: 1 } };
    });
    expect(g?.mecanismos).toEqual({});
    expect(g?.partida.lugar).toBe('s2-laboratorio');
  });

  it('rechaza notas o datos con forma rara', () => {
    expect(conCambio((g) => (g['notas'] = [{ id: 'n1', texto: 'x'.repeat(281) }]))).toBeNull();
    expect(conCambio((g) => (g['notas'] = [{ id: '<img>', texto: 'hola' }]))).toBeNull();
    expect(conCambio((g) => (g['datos'] = ['s2-hoja-ayer', 's2-hoja-ayer']))).toBeNull();
    expect(conCambio((g) => (g['datos'] = ['javascript:alert(1)']))).toBeNull();
  });

  it('guarda el inventario y rechaza uno con forma rara (T31c)', () => {
    expect(conCambio(() => undefined)?.inventario).toEqual([
      'porteria-linterna',
      'porteria-cuaderno',
    ]);
    expect(conCambio((g) => delete g['inventario'])).toBeNull();
    expect(conCambio((g) => (g['inventario'] = 'porteria-linterna'))).toBeNull();
    expect(conCambio((g) => (g['inventario'] = ['<img src=x>']))).toBeNull();
    expect(conCambio((g) => (g['inventario'] = ['a', 'a']))).toBeNull();
    expect(
      conCambio((g) => (g['inventario'] = Array.from({ length: 41 }, (_, i) => `objeto-${i}`))),
    ).toBeNull();
  });
});
