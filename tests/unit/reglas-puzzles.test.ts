import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/content/esquema';
import { PUZZLES, puzzleDeSala } from '../../src/content/puzzles';
import {
  estadisticas,
  esEstadoValido,
  evaluar,
  nivelEn,
  parejas,
  precioImpreso,
  probabilidadMismoColor,
  sombra,
} from '../../src/game/puzzles';

const puzzle = (sala: number): Puzzle => {
  const p = puzzleDeSala(sala);
  if (!p) throw new Error(`Falta el puzzle de la sala ${sala}`);
  return p;
};

/** Estados (de una lista de candidatos) que resuelven la etapa. */
const queResuelven = (p: Puzzle, etapa: number, candidatos: unknown[]): unknown[] =>
  candidatos.filter((c) => evaluar(p, etapa, c)?.resuelta === true);

const rango = (desde: number, hasta: number): number[] =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

describe('todos los puzzles', () => {
  it.each(PUZZLES.map((p) => [p.id, p] as const))(
    '%s: cada solución resuelve su etapa y el estado inicial no',
    (_, p) => {
      p.etapas.forEach((e, i) => {
        expect(evaluar(p, i, e.solucion)?.resuelta).toBe(true);
        expect(evaluar(p, i, e.estado_inicial)?.resuelta).toBe(false);
      });
    },
  );

  it('un estado de otra forma o de otra etapa no es válido', () => {
    expect(evaluar(puzzle(1), 0, null)).toBeNull();
    expect(evaluar(puzzle(1), 0, 'jugo')).toBeNull();
    expect(evaluar(puzzle(5), 0, { azules: 1 })).toBeNull();
    expect(evaluar(puzzle(5), 7, { azules: 1, amarillas: 1 })).toBeNull();
  });
});

describe('sala 1 · etiquetadora', () => {
  const p = puzzle(1);
  const base = (etapa: number) => p.etapas[etapa]?.estado_inicial as object;
  const caja = [-20, 20, 25, -50, 50];
  const combinaciones = [
    [],
    ...caja.map((a) => [a]),
    ...caja.flatMap((a) => caja.filter((b) => b !== a).map((b) => [a, b])),
  ];

  it('cada rodillo multiplica el precio', () => {
    expect(precioImpreso(2000, [-20])).toBe(1600);
    expect(precioImpreso(1600, [20])).toBe(1920);
    expect(precioImpreso(1600, [25])).toBe(2000);
    expect(precioImpreso(4000, [-50, 50])).toBe(3000);
    expect(precioImpreso(4000, [50, -50])).toBe(3000);
  });

  it('cada etapa tiene la única salida del diseño (en cualquier orden)', () => {
    const soluciones = (i: number) =>
      queResuelven(
        p,
        i,
        combinaciones.map((rodillos) => ({ ...base(i), rodillos })),
      ).map((e) => (e as { rodillos: number[] }).rodillos);
    expect(soluciones(0)).toEqual([[-20]]);
    expect(soluciones(1)).toEqual([[25]]);
    expect(soluciones(2)).toEqual([
      [-50, 50],
      [50, -50],
    ]);
  });

  it('el +20 % de la intuición no deshace el −20 %', () => {
    expect(evaluar(p, 1, { ...base(1), rodillos: [20] })?.condiciones).toEqual({ precio: false });
  });

  it('rechaza rodillos fuera de la caja, repetidos o de más, y cambiar el producto', () => {
    expect(esEstadoValido(p, 0, { ...base(0), rodillos: [-25] })).toBe(false);
    expect(esEstadoValido(p, 0, { ...base(0), rodillos: [20, 20] })).toBe(false);
    expect(esEstadoValido(p, 0, { ...base(0), rodillos: [20, 25, -50] })).toBe(false);
    expect(esEstadoValido(p, 0, { ...base(0), precio: 1600, rodillos: [] })).toBe(false);
    expect(esEstadoValido(p, 0, { ...base(0), rodillos: [], extra: 1 })).toBe(false);
  });
});

describe('sala 2 · tanques', () => {
  const p = puzzle(2);
  const conCaudal = (etapa: number, caudal: number) => {
    const e = structuredClone(p.etapas[etapa]?.estado_inicial) as { a: { caudal: number } };
    e.a.caudal = caudal;
    return e;
  };

  it('la altura crece a ritmo constante sin salirse del tanque', () => {
    expect(nivelEn({ nivel: 10, caudal: 3 }, 8, 60)).toBe(34);
    expect(nivelEn({ nivel: 50, caudal: -2 }, 8, 60)).toBe(34);
    expect(nivelEn({ nivel: 50, caudal: 6 }, 10, 60)).toBe(60);
    expect(nivelEn({ nivel: 4, caudal: -2 }, 10, 60)).toBe(0);
  });

  it('cada etapa tiene un solo caudal correcto', () => {
    const caudales = (i: number) =>
      queResuelven(
        p,
        i,
        rango(0, 6).map((c) => conCaudal(i, c)),
      ).map((e) => (e as { a: { caudal: number } }).a.caudal);
    expect(caudales(0)).toEqual([3]);
    expect(caudales(1)).toEqual([3]);
    expect(caudales(2)).toEqual([2]);
  });

  it('la hoja de ayer coincide con el tanque B tapado', () => {
    const b = p.etapas[2]?.estado_inicial as {
      b: { nivel: number; caudal: number; registro: { t: number; nivel: number }[] };
    };
    for (const marca of b.b.registro) expect(nivelEn(b.b, marca.t, 60)).toBe(marca.nivel);
  });

  it('rechaza girar la perilla bloqueada de B o pasarse del rango', () => {
    const e = conCaudal(1, 3) as unknown as { b: { caudal: number } };
    e.b.caudal = -1;
    expect(esEstadoValido(p, 1, e)).toBe(false);
    expect(esEstadoValido(p, 1, conCaudal(1, 7))).toBe(false);
    expect(esEstadoValido(p, 1, conCaudal(1, 2.5))).toBe(false);
  });

  it('acepta el estado aunque las claves vengan en otro orden', () => {
    const e = p.etapas[1]?.solucion as { a: object; b: object };
    expect(esEstadoValido(p, 1, { b: { visible: true, caudal: -2, nivel: 50 }, a: e.a })).toBe(
      true,
    );
  });
});

describe('sala 3 · reflector', () => {
  const p = puzzle(3);
  const muescas = [27, 37, 45, 53, 63];
  type Estado = { muesca: number; postes: { distancia: number | null }[]; polea: number | null };
  const variar = (etapa: number, cambio: (e: Estado) => void): Estado => {
    const e = structuredClone(p.etapas[etapa]?.estado_inicial) as Estado;
    cambio(e);
    return e;
  };

  it('la sombra guarda la misma razón con la altura en cada muesca', () => {
    expect(sombra(2, 45)).toBe(2);
    expect(sombra(1, 27)).toBe(2);
    expect(sombra(3, 27)).toBe(6);
    expect(sombra(2, 53)).toBe(1.5);
    expect(sombra(8, 53)).toBe(6);
    expect(sombra(2, 30)).toBeNull();
  });

  it('presentar: solo 45° pone la sombra del poste de 2 m en su sensor', () => {
    const ok = queResuelven(
      p,
      0,
      muescas.map((m) => variar(0, (e) => (e.muesca = m))),
    );
    expect(ok.map((e) => (e as Estado).muesca)).toEqual([45]);
  });

  it('torcer: solo 27° y el poste de 3 m a 6 m del sensor', () => {
    const candidatos = muescas.flatMap((m) =>
      rango(1, 10).map((d) =>
        variar(1, (e) => {
          e.muesca = m;
          const poste3 = e.postes[1];
          if (poste3) poste3.distancia = d;
        }),
      ),
    );
    const ok = queResuelven(p, 1, candidatos) as Estado[];
    expect(ok.map((e) => [e.muesca, e.postes[1]?.distancia])).toEqual([[27, 6]]);
  });

  it('torcer: cada sensor se enciende por su cuenta', () => {
    const e = variar(1, (x) => (x.muesca = 27));
    expect(evaluar(p, 1, e)?.condiciones).toEqual({ 'poste-1': true, 'poste-3': false });
  });

  it('dominar: la polea en 8 m baja el sello, con cualquier inclinación', () => {
    const candidatos = muescas.flatMap((m) =>
      rango(1, 9).map((l) =>
        variar(2, (e) => {
          e.muesca = m;
          e.polea = l;
        }),
      ),
    );
    const ok = queResuelven(p, 2, candidatos) as Estado[];
    expect(new Set(ok.map((e) => e.polea))).toEqual(new Set([8]));
    expect(ok).toHaveLength(5);
  });

  it('rechaza muescas que no existen, mover un poste fijo y la polea fuera de rango', () => {
    expect(
      esEstadoValido(
        p,
        0,
        variar(0, (e) => (e.muesca = 30)),
      ),
    ).toBe(false);
    expect(
      esEstadoValido(
        p,
        1,
        variar(1, (e) => {
          const x = e.postes[0];
          if (x) x.distancia = 4;
        }),
      ),
    ).toBe(false);
    expect(
      esEstadoValido(
        p,
        1,
        variar(1, (e) => {
          const x = e.postes[1];
          if (x) x.distancia = 11;
        }),
      ),
    ).toBe(false);
    expect(
      esEstadoValido(
        p,
        2,
        variar(2, (e) => (e.polea = 10)),
      ),
    ).toBe(false);
    expect(
      esEstadoValido(
        p,
        0,
        variar(0, (e) => (e.polea = 3)),
      ),
    ).toBe(false);
  });
});

describe('sala 4 · carritos', () => {
  const p = puzzle(4);

  /** Todos los repartos posibles de hasta 20 libros en 5 carritos. */
  const repartos: number[][] = [];
  const llenar = (prefijo: number[], quedan: number) => {
    if (prefijo.length === 5) return void repartos.push(prefijo);
    for (let x = 0; x <= quedan; x++) llenar([...prefijo, x], quedan - x);
  };
  llenar([], 20);

  it('calcula media, mediana, moda y rango', () => {
    expect(estadisticas([9, 2, 3, 2, 4])).toEqual({ media: 4, mediana: 3, moda: 2, rango: 7 });
    expect(estadisticas([1, 2, 3, 3, 11])).toEqual({ media: 4, mediana: 3, moda: 3, rango: 10 });
    // Sin repetidos, o con empate, no hay moda.
    expect(estadisticas([1, 2, 3, 4, 10]).moda).toBeNull();
    expect(estadisticas([2, 2, 5, 5, 6]).moda).toBeNull();
  });

  it('presentar: cualquier reparto de los 20 libros enciende la media', () => {
    const ok = queResuelven(
      p,
      0,
      repartos.map((carritos) => ({ carritos })),
    );
    expect(ok.length).toBe(repartos.filter((r) => r.reduce((s, x) => s + x, 0) === 20).length);
  });

  it('torcer: se pueden amontonar 11 libros en un día sin mover la mediana', () => {
    expect(evaluar(p, 1, { carritos: [1, 2, 3, 3, 11] })?.resuelta).toBe(true);
    expect(evaluar(p, 1, { carritos: [4, 4, 4, 4, 4] })?.condiciones).toEqual({
      media: true,
      mediana: false,
    });
  });

  it('dominar: solo hay una semana posible, salvo el orden de los días', () => {
    const ok = queResuelven(
      p,
      2,
      repartos.map((carritos) => ({ carritos })),
    ) as { carritos: number[] }[];
    // 5! / 2! = 60 órdenes de 2, 2, 3, 4 y 9.
    expect(ok).toHaveLength(60);
    for (const e of ok) expect([...e.carritos].sort((a, b) => a - b)).toEqual([2, 2, 3, 4, 9]);
  });

  it('cada lámpara se enciende y se apaga por su cuenta', () => {
    expect(evaluar(p, 2, { carritos: [1, 2, 3, 3, 11] })?.condiciones).toEqual({
      media: true,
      mediana: true,
      moda: false,
      rango: false,
    });
  });

  it('rechaza más libros que la pila, carritos de más y números raros', () => {
    expect(esEstadoValido(p, 0, { carritos: [5, 5, 5, 5, 5] })).toBe(false);
    expect(esEstadoValido(p, 0, { carritos: [4, 4, 4, 4, 4, 0] })).toBe(false);
    expect(esEstadoValido(p, 0, { carritos: [4, 4, 4, 4, -1] })).toBe(false);
    expect(esEstadoValido(p, 0, { carritos: [4, 4, 4, 4, 3.5] })).toBe(false);
  });
});

describe('sala 5 · urna', () => {
  const p = puzzle(5);
  const urnas = rango(0, 10).flatMap((azules) =>
    rango(0, 10).map((amarillas) => ({ azules, amarillas })),
  );

  it('cuenta parejas iguales y distintas', () => {
    expect(parejas(2, 2)).toEqual({ iguales: 2, distintas: 4 });
    expect(parejas(3, 1)).toEqual({ iguales: 3, distintas: 3 });
    expect(parejas(6, 3)).toEqual({ iguales: 18, distintas: 18 });
    expect(probabilidadMismoColor(2, 2)).toBeCloseTo(1 / 3);
    expect(probabilidadMismoColor(3, 1)).toBe(0.5);
    expect(probabilidadMismoColor(1, 0)).toBeNull();
  });

  it('cada placa tiene las soluciones del diseño', () => {
    expect(queResuelven(p, 0, urnas)).toEqual([
      { azules: 0, amarillas: 3 },
      { azules: 3, amarillas: 0 },
    ]);
    expect(queResuelven(p, 1, urnas)).toEqual([
      { azules: 1, amarillas: 3 },
      { azules: 3, amarillas: 1 },
    ]);
    expect(queResuelven(p, 2, urnas)).toEqual([
      { azules: 3, amarillas: 6 },
      { azules: 6, amarillas: 3 },
    ]);
  });

  it('con 2 y 2 hay 4 fichas pero el juego no es justo', () => {
    expect(evaluar(p, 1, { azules: 2, amarillas: 2 })?.condiciones).toEqual({
      fichas: true,
      juego: false,
    });
  });

  it('rechaza más fichas de las que dan los dispensadores', () => {
    expect(esEstadoValido(p, 2, { azules: 11, amarillas: 0 })).toBe(false);
    expect(esEstadoValido(p, 2, { azules: -1, amarillas: 0 })).toBe(false);
  });
});
