import { describe, expect, it } from 'vitest';
import datos from '../../src/content/fichas.json';
import {
  esquemaFichaValidada,
  problemasDeFicha,
  type BloqueFicha,
  type FichaDeObjeto,
} from '../../src/content/esquema-fichas';
import { LUGARES } from '../../src/content/esquema-salas';
import {
  FICHAS,
  fichaDeObjeto,
  fichasDeLugar,
  objetosExaminables,
  type FichaLista,
} from '../../src/content/fichas';
import { PUZZLES } from '../../src/content/puzzles';
import { SALAS_3D } from '../../src/content/salas';
import type { Ficha } from '../../src/signals/contenido';

/**
 * T35c · Fichas de inspección: el texto legible de cada objeto que se examina.
 */

/** Los cuatro momentos de una sala: tres etapas pendientes y la sala resuelta. */
const MOMENTOS: readonly (number | null)[] = [0, 1, 2, null];

/** Todo el texto que el jugador lee en una ficha, en una sola cadena. */
function textoDe(ficha: FichaLista | null): string {
  if (!ficha) return '';
  const deBloque = (b: BloqueFicha): string[] => {
    switch (b.tipo) {
      case 'texto':
      case 'nota':
        return [b.texto];
      case 'lista':
        return [...b.items];
      case 'tabla':
        return [b.titulo, ...b.columnas, ...b.filas.flat()];
    }
  };
  return [ficha.titulo, ficha.descripcion, ...ficha.bloques.flatMap(deBloque)].join(' · ');
}

/** `1600` → `$1.600`, como se escribe en Colombia. */
const pesos = (n: number): string => `$${n.toLocaleString('es-CO')}`;

/** Filas de la primera tabla de una ficha. */
function filasDe(ficha: FichaLista | null): readonly string[][] {
  const tabla = ficha?.bloques.find((b) => b.tipo === 'tabla');
  return tabla?.tipo === 'tabla' ? tabla.filas : [];
}

const puzzle = <M extends string>(mecanismo: M) => {
  const p = PUZZLES.find((x) => x.mecanismo === mecanismo);
  if (!p) throw new Error(`falta el puzzle ${mecanismo}`);
  return p as Extract<(typeof PUZZLES)[number], { mecanismo: M }>;
};

describe('fichas de inspección: forma y cobertura (T35c)', () => {
  it('cada ficha cumple el esquema y sus reglas', () => {
    for (const ficha of datos) {
      const r = esquemaFichaValidada.safeParse(ficha);
      expect(r.success ? [] : r.error.issues.map((i) => `${ficha.id}: ${i.message}`)).toEqual([]);
    }
    expect(new Set(FICHAS.map((f) => f.id)).size).toBe(FICHAS.length);
  });

  it('todo objeto examinable de cada lugar tiene ficha, en cualquier momento de la sala', () => {
    const sinFicha: string[] = [];
    for (const lugar of LUGARES) {
      const examinables = objetosExaminables(lugar);
      expect(examinables.length, lugar).toBeGreaterThan(0);
      for (const id of examinables) {
        for (const momento of MOMENTOS) {
          const ficha = fichaDeObjeto(id, momento);
          if (!ficha || ficha.bloques.length === 0) sinFicha.push(`${id} (etapa ${momento})`);
        }
      }
    }
    expect(sinFicha).toEqual([]);
  });

  it('los examinables son exactamente los objetos con acción «examinar» de salas.json', () => {
    const esperados = SALAS_3D.flatMap((s) => s.objetos)
      .filter((o) => o.accion === 'examinar')
      .map((o) => o.id);
    expect(LUGARES.flatMap((l) => objetosExaminables(l))).toEqual(esperados);
    expect(esperados).toHaveLength(21);
  });

  it('los papeles que se recogen también se pueden leer', () => {
    expect(fichaDeObjeto('s2-hoja-ayer')?.titulo).toBe('Hoja del graficador de ayer');
    expect(fichaDeObjeto('s4-ficha-rota')?.titulo).toBe('Ficha rota');
  });

  it('un objeto sin nada escrito, o que no existe, no tiene ficha', () => {
    expect(fichaDeObjeto('porteria-linterna')).toBeNull();
    expect(fichaDeObjeto('s1-palanca')).toBeNull();
    expect(fichaDeObjeto('no-existe')).toBeNull();
    expect(fichaDeObjeto('')).toBeNull();
  });

  it('el título es el nombre del objeto en salas.json', () => {
    expect(fichaDeObjeto('s1-pizarra')?.titulo).toBe('Pizarra de precios');
    expect(fichaDeObjeto('s5-carta')?.titulo).toBe('Carta de jubilación');
  });

  it('una etapa que no existe se lee como la primera', () => {
    const primera = fichaDeObjeto('s2-campana', 0);
    expect(fichaDeObjeto('s2-campana')).toEqual(primera);
    expect(fichaDeObjeto('s2-campana', 7)).toEqual(primera);
    expect(fichaDeObjeto('s2-campana', -1)).toEqual(primera);
    expect(fichaDeObjeto('s2-campana', 1.5)).toEqual(primera);
    expect(fichaDeObjeto('s2-campana', null)).not.toEqual(primera);
  });

  it('fichasDeLugar trae las fichas de ese lugar y de ningún otro', () => {
    const s1 = fichasDeLugar('s1-cooperativa', 1);
    expect(Object.keys(s1).sort()).toEqual([
      's1-caja-rodillos',
      's1-corcho',
      's1-pizarra',
      's1-productos',
    ]);
    expect(s1['s1-productos']).toEqual(fichaDeObjeto('s1-productos', 1));
    expect(Object.keys(fichasDeLugar('porteria'))).toEqual([
      'porteria-reloj',
      'porteria-mural',
      'porteria-casillero',
    ]);
    // Lo que devuelve sirve tal cual para el signal `fichas` de la vista de inspección.
    const paraElSignal: Readonly<Record<string, Ficha>> = s1;
    expect(paraElSignal).toBe(s1);
  });

  it('las reglas detectan un objeto que no existe, uno sin ficha posible y una tabla descuadrada', () => {
    const base: FichaDeObjeto = {
      id: 's1-pizarra',
      descripcion: 'x',
      bloques: [{ tipo: 'texto', texto: 'x' }],
    };
    expect(problemasDeFicha(base)).toEqual([]);
    expect(problemasDeFicha({ ...base, id: 's1-factura' })).toEqual([
      '«s1-factura» no existe en salas.json',
    ]);
    expect(problemasDeFicha({ ...base, id: 's1-palanca' })).toEqual([
      '«s1-palanca» no se examina ni se recoge: no necesita ficha',
    ]);
    expect(problemasDeFicha({ ...base, bloques: [], por_etapa: [[], [], [], []] })).toHaveLength(4);
    expect(
      problemasDeFicha({ ...base, id: 'porteria-reloj', por_etapa: [[], [], [], []] }),
    ).toContain('la portería no tiene etapas: sobra «por_etapa»');
    expect(
      problemasDeFicha({
        ...base,
        bloques: [{ tipo: 'tabla', titulo: 't', columnas: ['a', 'b'], filas: [['1', '2', '3']] }],
      }),
    ).toEqual(['tabla «t»: cada fila debe tener 2 celdas']);
  });
});

describe('fichas de inspección: lo que no deben decir (T35c)', () => {
  /**
   * El concepto se nombra en el cuaderno DESPUÉS de resolver. Estas palabras son las de los
   * textos `cuaderno` de los puzzles, más los signos de una cuenta hecha.
   */
  const PROHIBIDO =
    /multiplic|porcentaje|funci[oó]n|lineal|pendiente|ecuaci|sistema de|semejan|proporci|tangente|raz[oó]n\b|dispersi|desviaci|tendencia central|probabilidad|reemplazo|parejas|[×÷=]/i;

  it('ninguna ficha nombra el concepto ni trae una cuenta hecha', () => {
    const fallas: string[] = [];
    for (const f of FICHAS) {
      for (const momento of MOMENTOS) {
        const m = PROHIBIDO.exec(textoDe(fichaDeObjeto(f.id, momento)));
        if (m) fallas.push(`${f.id} (etapa ${momento}): «${m[0]}»`);
      }
    }
    expect(fallas).toEqual([]);
  });

  it('ninguna ficha menciona el ICFES ni el Saber 11', () => {
    expect(JSON.stringify(FICHAS)).not.toMatch(/icfes|saber\s*11/i);
  });

  it('los números usan formato de Colombia', () => {
    const textos = JSON.stringify(FICHAS);
    expect(textos).not.toMatch(/\$\d{4,}/); // $1.600, no $1600
    expect(textos).not.toMatch(/\d\.\d{1,2}(?!\d)/); // coma decimal, no punto
    expect(textos).not.toMatch(/"[^"]*'[^"]*"/); // «comillas angulares», no rectas
  });

  it('sala 2: nada dice dónde empezó el tanque B tapado ni a qué ritmo baja en esa etapa', () => {
    const dominar =
      textoDe(fichaDeObjeto('s2-tanque-b', 2)) + textoDe(fichaDeObjeto('s2-perilla-morada', 2));
    expect(dominar).not.toMatch(/48|2 cm/);
    expect(textoDe(fichaDeObjeto('s2-hoja-ayer', 2))).not.toMatch(/48|por segundo/);
  });

  it('sala 3: nada dice la altura del marcador', () => {
    for (const id of objetosExaminables('s3-gimnasio')) {
      for (const momento of [0, 1, 2]) {
        expect(textoDe(fichaDeObjeto(id, momento)), id).not.toMatch(/\b8 m\b/);
      }
    }
  });

  it('sala 4: antes de resolver, ninguna ficha trae un reparto de libros', () => {
    const solucion = puzzle('carritos').etapas[2]?.solucion.carritos.join(', ') ?? '';
    for (const id of [...objetosExaminables('s4-biblioteca'), 's4-ficha-rota']) {
      for (const momento of MOMENTOS) {
        expect(textoDe(fichaDeObjeto(id, momento)), id).not.toContain(solucion);
      }
    }
  });
});

describe('fichas de inspección: coinciden con los puzzles (T35c)', () => {
  it('sala 1: la pizarra tiene el precio buscado de cada etapa', () => {
    const etapas = puzzle('etiquetadora').etapas;
    expect(filasDe(fichaDeObjeto('s1-pizarra'))).toEqual([
      ['Jugo', pesos(etapas[0]?.exito.precio ?? 0)],
      ['Empanada', pesos(etapas[1]?.exito.precio ?? 0)],
      ['Combo', pesos(etapas[2]?.exito.precio ?? 0)],
    ]);
  });

  it('sala 1: las etiquetas de los productos siguen el avance de la sala', () => {
    const etapas = puzzle('etiquetadora').etapas;
    const nombres = ['Jugo', 'Empanada', 'Combo'];
    MOMENTOS.forEach((momento, n) => {
      const esperadas = etapas.map((e, i) => [
        nombres[i],
        // Las etapas ya resueltas muestran el precio de la pizarra; las demás, el de partida.
        pesos(i < n ? e.exito.precio : e.estado_inicial.precio),
      ]);
      expect(filasDe(fichaDeObjeto('s1-productos', momento)), `etapa ${momento}`).toEqual(
        esperadas,
      );
    });
  });

  it('sala 1: la caja trae los rodillos de los controles', () => {
    const rodillos = puzzle('etiquetadora').etapas[0]?.controles.rodillos ?? [];
    const lista = fichaDeObjeto('s1-caja-rodillos')?.bloques.find((b) => b.tipo === 'lista');
    expect(lista?.tipo === 'lista' ? lista.items : []).toEqual(
      rodillos.map((r) => `Rodillo ${r < 0 ? '−' : '+'}${Math.abs(r)} %`),
    );
  });

  it('sala 2: la campana, los tanques y la hoja de ayer traen los números de cada etapa', () => {
    const etapas = puzzle('tanques').etapas;
    etapas.forEach((e, n) => {
      expect(textoDe(fichaDeObjeto('s2-campana', n))).toContain(`${e.exito.campana_s} segundos`);
      expect(textoDe(fichaDeObjeto('s2-tanque-a', n))).toContain(`${e.estado_inicial.a.nivel} cm`);
      expect(textoDe(fichaDeObjeto('s2-tanque-a', n))).toContain(`${e.controles.altura_cm} cm`);
      const b = e.estado_inicial.b;
      if (b?.visible) {
        expect(textoDe(fichaDeObjeto('s2-tanque-b', n))).toContain(`${b.nivel} cm`);
        expect(textoDe(fichaDeObjeto('s2-perilla-morada', n))).toContain(
          `${Math.abs(b.caudal)} cm por segundo`,
        );
      }
      if (e.exito.objetivo.tipo === 'linea') {
        expect(textoDe(fichaDeObjeto('s2-tanque-a', n))).toContain(`${e.exito.objetivo.nivel} cm`);
      }
    });
    const registro = etapas[2]?.estado_inicial.b?.registro ?? [];
    expect(registro).toHaveLength(2);
    expect(filasDe(fichaDeObjeto('s2-hoja-ayer'))).toEqual(
      registro.map((r) => [`${r.t} s`, `${r.nivel} cm`]),
    );
  });

  it('sala 3: los sensores están donde dice cada etapa', () => {
    const etapas = puzzle('reflector').etapas;
    [0, 1].forEach((n) => {
      const e = etapas[n];
      const fijos = e?.estado_inicial.postes.filter(
        (p) => !e.controles.postes_moviles.includes(p.id),
      );
      expect(fijos?.length).toBeGreaterThan(0);
      for (const p of fijos ?? []) {
        expect(textoDe(fichaDeObjeto('s3-sensores', n))).toContain(
          `a ${p.distancia} m de la base del poste de ${p.altura} m`,
        );
      }
    });
  });

  it('sala 4: el resumen semanal destapa las lámparas de cada etapa', () => {
    const etapas = puzzle('carritos').etapas;
    const todas = etapas[2]?.exito.lamparas ?? {};
    etapas.forEach((e, n) => {
      const esperadas = Object.entries(todas).map(([rotulo, numero]) => [
        rotulo.toUpperCase(),
        String(numero),
        rotulo in e.exito.lamparas ? 'Destapada' : 'Tapada',
      ]);
      expect(filasDe(fichaDeObjeto('s4-lamparas', n)), `etapa ${n}`).toEqual(esperadas);
    });
    expect(textoDe(fichaDeObjeto('s4-mostrador'))).toContain(
      `${etapas[0]?.controles.libros} libros`,
    );
  });

  it('las señales del misterio están donde dice el diseño', () => {
    expect(textoDe(fichaDeObjeto('s1-corcho'))).toContain('Profe Marta, incapacidad desde octubre');
    expect(textoDe(fichaDeObjeto('s2-taza'))).toContain('«T. R.»');
    expect(textoDe(fichaDeObjeto('s3-planilla'))).toContain('no sé ni prender el parlante');
    expect(textoDe(fichaDeObjeto('s4-caja-devoluciones'))).toContain(
      '«Devolver a T. R.: cuaderno de grabaciones, estante M»',
    );
    expect(textoDe(fichaDeObjeto('s4-ficha-rota'))).toContain('«moda»');
    expect(textoDe(fichaDeObjeto('s5-carta'))).toContain('Tobías Rincón');
  });
});
