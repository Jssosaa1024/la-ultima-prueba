import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esquemaPuzzle, problemasDelPuzzle, type Puzzle } from '../../src/content/esquema';

/** Elemento que debe existir (evita aserciones no nulas). */
const n = <T>(x: T | undefined): T => {
  if (x === undefined) throw new Error('Falta un elemento en el fixture');
  return x;
};

/** El ejemplo de la sala 4 de la especificación (sección 2). */
const s4 = (): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL('./fixtures/puzzle-s4.json', import.meta.url), 'utf8'));

const mensajes = (datos: unknown): string[] => {
  const r = esquemaPuzzle.safeParse(datos);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

/** Un puzzle válido de cada mecanismo, mínimo, para probar las reglas cruzadas. */
const comunes = (sala: number, id: string) => ({
  id,
  version: 1,
  sala,
  titulo: 'Prueba',
  tema: 'porcentajes',
  proceso: 'razonar',
  grado: 10,
  dificultad: 1,
  concepto: 'Algo',
  intuicion: 'Algo',
  pistas: [
    { nivel: 1, tras_segundos: 120, texto: 'Uno' },
    { nivel: 2, tras_segundos: 240, texto: 'Dos' },
    { nivel: 3, tras_segundos: 360, texto: 'Tres' },
  ],
  cuaderno: { concepto: 'Algo', texto: 'Algo' },
  pista_por_jugador: {
    A: { objeto: `s${sala}-a`, texto: 'a' },
    B: { objeto: `s${sala}-b`, texto: 'b' },
    C: { objeto: `s${sala}-c`, texto: 'c' },
    D: { objeto: `s${sala}-d`, texto: 'd' },
  },
});

const tresEtapas = <T extends object>(etapa: T) =>
  (['presentar', 'torcer', 'dominar'] as const).map((id) => ({
    id,
    situacion: 'Situación',
    aja: 'Ajá',
    ...structuredClone(etapa),
  }));

const tanques = () => ({
  ...comunes(2, 's2-tanques'),
  tema: 'funciones_lineales',
  mecanismo: 'tanques',
  etapas: tresEtapas({
    estado_inicial: {
      a: { nivel: 10, caudal: 0, visible: true },
      b: { nivel: 50, caudal: -2, visible: true },
    },
    controles: { perillas: ['a'], caudal_min: 0, caudal_max: 6, altura_cm: 60 },
    exito: { campana_s: 8, objetivo: { tipo: 'cruce' } },
    solucion: {
      a: { nivel: 10, caudal: 3, visible: true },
      b: { nivel: 50, caudal: -2, visible: true },
    },
  }),
});

const reflector = () => ({
  ...comunes(3, 's3-reflector'),
  tema: 'semejanza_tangente',
  mecanismo: 'reflector',
  etapas: tresEtapas({
    estado_inicial: {
      muesca: 45,
      postes: [
        { id: 'poste-1', altura: 1, distancia: 2 },
        { id: 'poste-3', altura: 3, distancia: 2 },
      ],
      polea: null,
    },
    controles: {
      muescas: [27, 37, 45, 53, 63],
      girar: true,
      postes_moviles: ['poste-3'],
      distancia_min: 1,
      distancia_max: 10,
      polea: null,
    },
    exito: { sensores: ['poste-1', 'poste-3'], marcador: null },
    solucion: {
      muesca: 27,
      postes: [
        { id: 'poste-1', altura: 1, distancia: 2 },
        { id: 'poste-3', altura: 3, distancia: 6 },
      ],
      polea: null,
    },
  }),
});

describe('esquema de puzzle', () => {
  it('acepta el ejemplo de la sala 4 de la especificación', () => {
    expect(mensajes(s4())).toEqual([]);
  });

  it('acepta un puzzle mínimo de tanques y otro de reflector', () => {
    expect(mensajes(tanques())).toEqual([]);
    expect(mensajes(reflector())).toEqual([]);
  });

  it('no acepta opciones, distractores ni campos desconocidos', () => {
    const p = { ...s4(), opciones: [{ id: 'o1', texto: '3', valor: 3 }] };
    expect(mensajes(p).join()).toMatch(/opciones/);
    const q = { ...s4(), competencia: 'argumentacion' };
    expect(mensajes(q).join()).toMatch(/competencia/);
  });

  it('exige proceso del MEN y grado entre 9 y 11', () => {
    expect(mensajes({ ...s4(), proceso: 'interpretacion_representacion' })).not.toEqual([]);
    expect(mensajes({ ...s4(), grado: 8 })).not.toEqual([]);
    expect(mensajes({ ...s4(), grado: 11 })).toEqual([]);
  });

  it('exige exactamente tres etapas y tres pistas', () => {
    const p = s4();
    expect(mensajes({ ...p, etapas: (p['etapas'] as unknown[]).slice(0, 2) })).not.toEqual([]);
    expect(mensajes({ ...p, pistas: (p['pistas'] as unknown[]).slice(0, 2) })).not.toEqual([]);
  });

  it('rechaza un estado con la forma de otro mecanismo', () => {
    const p = s4() as { etapas: { solucion: unknown }[] };
    n(p.etapas[0]).solucion = { azules: 2, amarillas: 2 };
    expect(mensajes(p).join()).toMatch(/etapas\.0\.solucion/);
  });
});

describe('validaciones cruzadas', () => {
  const problemas = (p: unknown) =>
    problemasDelPuzzle(p as Puzzle).map((x) => `${x.ruta.join('.')}: ${x.mensaje}`);

  it('el id y el mecanismo corresponden a la sala', () => {
    expect(problemas({ ...s4(), id: 's3-carritos' }).join()).toMatch(/^id:/);
    expect(problemas({ ...s4(), sala: 5, id: 's5-carritos' }).join()).toMatch(/mecanismo/);
  });

  it('las etapas van en orden presentar, torcer, dominar', () => {
    const p = s4() as { etapas: { id: string }[] };
    n(p.etapas[0]).id = 'torcer';
    n(p.etapas[1]).id = 'presentar';
    expect(problemas(p)).toHaveLength(2);
  });

  it('las pistas suben de nivel con más tiempo y más intentos', () => {
    const p = s4() as { pistas: { tras_segundos: number; tras_intentos?: number }[] };
    n(p.pistas[2]).tras_segundos = 200;
    expect(problemas(p).join()).toMatch(/pistas\.2\.tras_segundos/);
    const q = s4() as { pistas: { tras_intentos?: number }[] };
    delete n(q.pistas[1]).tras_intentos;
    expect(problemas(q).join()).toMatch(/tras_intentos/);
  });

  it('las pistas por rol usan objetos de la sala', () => {
    const p = s4() as { pista_por_jugador: { B: { objeto: string } } };
    p.pista_por_jugador.B.objeto = 's1-pizarra';
    expect(problemas(p).join()).toMatch(/pista_por_jugador\.B\.objeto/);
  });

  it('carritos: cantidad de carritos y libros disponibles', () => {
    const p = s4() as { etapas: { solucion: { carritos: number[] } }[] };
    n(p.etapas[0]).solucion.carritos = [4, 4, 4, 4];
    n(p.etapas[1]).solucion.carritos = [5, 5, 5, 5, 5];
    const lista = problemas(p).join('\n');
    expect(lista).toMatch(/etapas\.0\.solucion\.carritos: Debe haber 5/);
    expect(lista).toMatch(/etapas\.1\.solucion\.carritos: Solo hay 20/);
  });

  it('tanques: la solución solo gira las perillas permitidas y dentro del rango', () => {
    const p = tanques();
    n(p.etapas[0]).solucion.b.caudal = -1;
    n(p.etapas[1]).solucion.a.caudal = 9;
    n(p.etapas[2]).solucion.a.nivel = 0;
    const lista = problemas(p).join('\n');
    expect(lista).toMatch(/etapas\.0\.solucion\.b: La solución solo puede girar/);
    expect(lista).toMatch(/etapas\.1\.solucion\.a\.caudal/);
    expect(lista).toMatch(/etapas\.2\.solucion\.a: La solución solo puede girar/);
  });

  it('tanques: un cruce necesita los dos tanques', () => {
    const p = tanques() as { etapas: { estado_inicial: { b: unknown } }[] };
    n(p.etapas[0]).estado_inicial.b = null;
    expect(problemas(p).join()).toMatch(/Para un cruce/);
  });

  it('reflector: muescas existentes, postes fijos y sensores con distancia', () => {
    const p = reflector();
    n(p.etapas[0]).solucion.muesca = 30;
    n(n(p.etapas[1]).solucion.postes[0]).distancia = 5;
    n(p.etapas[2]).exito.sensores = ['poste-9'];
    const lista = problemas(p).join('\n');
    expect(lista).toMatch(/etapas\.0\.solucion\.muesca/);
    expect(lista).toMatch(/etapas\.1\.solucion: La solución solo puede cambiar/);
    expect(lista).toMatch(/etapas\.2\.exito\.sensores/);
  });

  it('reflector: si no se puede girar, la muesca no cambia', () => {
    const p = reflector();
    n(p.etapas[0]).controles.girar = false;
    expect(problemas(p).join()).toMatch(/etapas\.0\.solucion: La solución solo puede cambiar/);
  });

  it('la colección de Astro usa el esquema con las reglas cruzadas', () => {
    expect(mensajes({ ...s4(), id: 's3-carritos' }).join()).toMatch(/^id:/);
  });
});

describe('validaciones con las reglas de los puzzles (T26)', () => {
  const problemas = (p: unknown) =>
    problemasDelPuzzle(p as Puzzle).map((x) => `${x.ruta.join('.')}: ${x.mensaje}`);

  it('la solución debe resolver la etapa', () => {
    const p = s4() as { etapas: { solucion: { carritos: number[] } }[] };
    n(p.etapas[2]).solucion.carritos = [1, 2, 3, 3, 11];
    expect(problemas(p).join()).toMatch(/etapas\.2\.solucion: La solución no cumple/);
  });

  it('el estado inicial no puede resolver la etapa', () => {
    const p = s4() as { etapas: { estado_inicial: { carritos: number[] } }[] };
    n(p.etapas[1]).estado_inicial.carritos = [1, 2, 3, 3, 11];
    expect(problemas(p).join()).toMatch(/etapas\.1\.estado_inicial: El estado inicial ya resuelve/);
  });

  it('el reflector solo tiene las cinco muescas con razón conocida', () => {
    const p = reflector();
    n(p.etapas[0]).controles.muescas = [27, 30, 45];
    expect(problemas(p).join()).toMatch(
      /etapas\.0\.controles\.muescas: El reflector no tiene muesca de 30°/,
    );
  });

  it('las marcas de la hoja de ayer coinciden con el tanque', () => {
    const p = tanques() as unknown as {
      etapas: { estado_inicial: { b: { registro?: { t: number; nivel: number }[] } } }[];
    };
    n(p.etapas[0]).estado_inicial.b.registro = [{ t: 2, nivel: 40 }];
    expect(problemas(p).join()).toMatch(/etapas\.0\.estado_inicial\.b\.registro\.0/);
  });
});
