import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, BoxGeometry, IcosahedronGeometry, Scene } from 'three';
import { crearCalor, escalonDeCalor } from '../../src/debug/estres/calor';
import { geometriaMasPesada } from '../../src/debug/estres/cargas';
import {
  CALENTAR_MS,
  MEDIR_MS,
  crearCiclo,
  debeParar,
  ultimoEstable,
} from '../../src/debug/estres/ciclo';
import type { EstadoCiclo, OpcionesCiclo } from '../../src/debug/estres/ciclo';
import {
  describirCarga,
  maxEscalones,
  nivelPixeles,
  pasosPixelRatio,
} from '../../src/debug/estres/ejes';
import { ESTRES_INACTIVO, informeEstres } from '../../src/debug/estres/estado';
import {
  CLAVE_MARCA,
  guardarMarca,
  leerMarca,
  revisarRecarga,
  validarMarca,
} from '../../src/debug/estres/marca';
import type { Almacen, Marca } from '../../src/debug/estres/marca';

function almacenFalso(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
}

const almacenRoto: Almacen = {
  getItem: () => {
    throw new Error('privado');
  },
  setItem: () => {
    throw new Error('lleno');
  },
  removeItem: () => {
    throw new Error('privado');
  },
};

describe('marca en localStorage (T11o)', () => {
  const marca: Marca = {
    eje: 'texturas',
    escalon: 2,
    estado: 'en-curso',
    escalones: [{ escalon: 1, carga: '+4 texturas', p95_ms: 31.8, estado: 'estable' }],
  };

  it('se guarda y se lee igual', () => {
    const a = almacenFalso();
    expect(guardarMarca(a, marca)).toBe(true);
    expect(leerMarca(a)).toEqual(marca);
  });

  it('sin almacenamiento (pestaña privada) no falla', () => {
    expect(guardarMarca(almacenRoto, marca)).toBe(false);
    expect(leerMarca(almacenRoto)).toBeNull();
    expect(guardarMarca(null, marca)).toBe(false);
  });

  it('descarta marcas con campos de más, ejes desconocidos o texto raro', () => {
    expect(validarMarca('{')).toBeNull();
    expect(validarMarca(JSON.stringify({ ...marca, extra: 1 }))).toBeNull();
    expect(validarMarca(JSON.stringify({ ...marca, eje: 'sombras' }))).toBeNull();
    expect(validarMarca(JSON.stringify({ ...marca, escalon: 0 }))).toBeNull();
    expect(
      validarMarca(
        JSON.stringify({
          ...marca,
          escalones: [{ escalon: 1, carga: '<img src=x onerror=alert(1)>', estado: 'estable' }],
        }),
      ),
    ).toBeNull();
    expect(
      validarMarca(
        JSON.stringify({
          ...marca,
          escalones: [{ escalon: 1, carga: '+4 texturas', estado: 'estable', p95_ms: '9' }],
        }),
      ),
    ).toBeNull();
  });

  it('al abrir la página, una marca en curso queda como recarga por memoria', () => {
    const a = almacenFalso();
    guardarMarca(a, marca);
    const r = revisarRecarga(a, (eje, n) => describirCarga(eje, n, 2));
    expect(r?.estado).toBe('recarga-por-memoria');
    expect(r?.escalones.at(-1)).toEqual({
      escalon: 2,
      carga: '+8 texturas',
      estado: 'recarga-por-memoria',
    });
    // Queda guardada así: otra recarga no la anota dos veces.
    const otra = revisarRecarga(a, (eje, n) => describirCarga(eje, n, 2));
    expect(otra?.escalones).toHaveLength(2);
  });

  it('una marca dañada se borra', () => {
    const a = almacenFalso();
    a.setItem(CLAVE_MARCA, '{"eje":"x"}');
    expect(revisarRecarga(a, () => '')).toBeNull();
    expect(a.datos.has(CLAVE_MARCA)).toBe(false);
  });
});

/** Corre el ciclo con cuadros de `ms` fijos (o según el escalón) hasta que termine. */
function correr(o: Partial<OpcionesCiclo> & { msPorEscalon: (escalon: number) => number }): {
  final: EstadoCiclo;
  marcas: Marca[];
  aplicados: number[];
  borrada: boolean;
} {
  const marcas: Marca[] = [];
  const aplicados: number[] = [];
  let final: EstadoCiclo | null = null;
  let borrada = false;
  let escalonActual = 0;
  const ciclo = crearCiclo({
    eje: 'triangulos',
    maxEscalones: 30,
    aplicar: (n) => {
      aplicados.push(n);
      escalonActual = n;
    },
    describir: (n) => describirCarga('triangulos', n, 1),
    medir: () => ({ triangulos: escalonActual * 10_000, draw_calls: 20, mb_texturas: 3 }),
    guardarMarca: (m) => marcas.push(structuredClone(m)),
    borrarMarca: () => {
      borrada = true;
    },
    alTerminar: (e) => {
      final = e;
    },
    ...o,
  });
  let t = 0;
  ciclo.iniciar(t);
  for (let i = 0; i < 100_000 && !final; i++) {
    t += o.msPorEscalon(escalonActual);
    ciclo.cuadro(t);
  }
  if (!final) throw new Error('no terminó');
  return { final, marcas, aplicados, borrada };
}

describe('ciclo de la prueba de estrés (T11o)', () => {
  it('para cuando el p95 pasa de 33 ms dos escalones seguidos', () => {
    // Hasta el escalón 3 va a 60 fps; desde el 4, a 25 fps.
    const r = correr({ msPorEscalon: (n) => (n >= 4 ? 40 : 16) });
    expect(r.final.motivo).toBe('limite');
    expect(r.final.escalones.map((e) => e.estado)).toEqual([
      'estable',
      'estable',
      'estable',
      'lento',
      'lento',
    ]);
    expect(ultimoEstable(r.final.escalones)).toBe(3);
    expect(r.aplicados).toEqual([1, 2, 3, 4, 5]);
    expect(r.borrada).toBe(true);
  });

  it('guarda la marca antes de subir cada escalón, con lo ya medido', () => {
    const r = correr({ msPorEscalon: (n) => (n >= 2 ? 40 : 16) });
    expect(r.marcas.map((m) => [m.escalon, m.estado, m.escalones.length])).toEqual([
      [1, 'en-curso', 0],
      [2, 'en-curso', 1],
      [3, 'en-curso', 2],
    ]);
  });

  it('un escalón lento suelto no detiene la prueba', () => {
    const r = correr({ msPorEscalon: (n) => (n === 2 ? 40 : 16), maxEscalones: 4 });
    expect(r.final.motivo).toBe('sin-escalones');
    expect(r.final.escalones.map((e) => e.estado)).toEqual([
      'estable',
      'lento',
      'estable',
      'estable',
    ]);
  });

  it('cada escalón calienta 1 s y mide 5 s, con triángulos, draw calls y MB de texturas', () => {
    const r = correr({ msPorEscalon: () => 20, maxEscalones: 1 });
    const e = r.final.escalones[0];
    expect(e).toMatchObject({
      escalon: 1,
      carga: '+10.000 triángulos',
      mediana_ms: 20,
      p95_ms: 20,
      triangulos: 10_000,
      draw_calls: 20,
      mb_texturas: 3,
      estado: 'estable',
    });
    expect(CALENTAR_MS + MEDIR_MS).toBe(6000);
  });

  it('webglcontextlost detiene la prueba y lo anota', () => {
    let final: EstadoCiclo | null = null;
    const ciclo = crearCiclo({
      eje: 'texturas',
      maxEscalones: 16,
      aplicar: () => undefined,
      describir: (n) => describirCarga('texturas', n, 1),
      medir: () => ({ triangulos: 0, draw_calls: 0, mb_texturas: 0 }),
      guardarMarca: () => undefined,
      borrarMarca: () => undefined,
      alTerminar: (e) => {
        final = e;
      },
    });
    ciclo.iniciar(0);
    ciclo.cuadro(16);
    ciclo.contextoPerdido();
    expect(final).toMatchObject({
      motivo: 'contexto-perdido',
      escalones: [{ escalon: 1, carga: '+4 texturas', estado: 'contexto-perdido' }],
    });
  });

  it('espera a que la carga esté lista antes de calentar', async () => {
    let soltar: () => void = () => undefined;
    const fases: string[] = [];
    const ciclo = crearCiclo({
      eje: 'texturas',
      maxEscalones: 2,
      aplicar: () =>
        new Promise<void>((r) => {
          soltar = r;
        }),
      describir: () => '+4 texturas',
      medir: () => ({ triangulos: 0, draw_calls: 0, mb_texturas: 0 }),
      guardarMarca: () => undefined,
      borrarMarca: () => undefined,
      alCambiar: (e) => fases.push(e.fase),
      alTerminar: () => undefined,
    });
    ciclo.iniciar(0);
    ciclo.cuadro(5000);
    expect(ciclo.estado.fase).toBe('preparando');
    soltar();
    await Promise.resolve();
    expect(ciclo.estado.fase).toBe('calentando');
    ciclo.detener();
    expect(ciclo.estado.motivo).toBe('detenida');
  });

  it('debeParar mira solo los dos últimos', () => {
    expect(debeParar([])).toBe(false);
    expect(
      debeParar([
        { escalon: 1, carga: 'a', estado: 'lento' },
        { escalon: 2, carga: 'b', estado: 'estable' },
      ]),
    ).toBe(false);
  });
});

describe('ejes (T11p y T11q)', () => {
  it('describe la carga de cada escalón', () => {
    expect(describirCarga('triangulos', 3, 2)).toBe('+30.000 triángulos');
    expect(describirCarga('draw-calls', 2, 2)).toBe('+20 draw calls');
    expect(describirCarga('texturas', 5, 2)).toBe('+20 texturas');
    expect(describirCarga('pixeles', 1, 2)).toBe('pixel ratio 0,5');
    expect(describirCarga('pixeles', 8, 2)).toBe('pixel ratio 2 + 1 plano');
    expect(describirCarga('pixeles', 10, 2)).toBe('pixel ratio 2 + 3 planos');
  });

  it('el pixel ratio va de 0,5 al del equipo en pasos de 0,25', () => {
    expect(pasosPixelRatio(2)).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    expect(pasosPixelRatio(1)).toEqual([0.5, 0.75, 1]);
    expect(pasosPixelRatio(2.625)).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.63]);
    expect(nivelPixeles(3, 1)).toEqual({ pixelRatio: 1, planos: 0 });
    expect(nivelPixeles(5, 1)).toEqual({ pixelRatio: 1, planos: 2 });
    expect(maxEscalones('pixeles', 1)).toBe(13);
    expect(maxEscalones('texturas', 1)).toBe(16);
  });

  it('el eje de triángulos usa la malla más pesada de la sala', () => {
    const sala = new Scene();
    const material = new MeshBasicMaterial();
    const caja = new BoxGeometry();
    const esfera = new IcosahedronGeometry(1, 3);
    sala.add(new Mesh(caja, material), new Mesh(esfera, material));
    expect(geometriaMasPesada(sala)).toBe(esfera);
    expect(geometriaMasPesada(null)).toBeNull();
  });
});

describe('prueba de calor', () => {
  it('3 minutos al 70 % del último estable, p95 del primer minuto frente al último', () => {
    expect(escalonDeCalor(10)).toBe(7);
    expect(escalonDeCalor(1)).toBe(1);
    const calor = crearCalor();
    let r = null;
    let t = 0;
    while (!r) {
      t += t < 60_000 ? 20 : 30;
      r = calor.cuadro(t);
    }
    expect(r).toEqual({ p95PrimerMinutoMs: 20, p95UltimoMinutoMs: 30 });
    expect(calor.restanteS).toBe(0);
  });
});

describe('informe de la prueba (T11r)', () => {
  it('lleva escalones, último estable y la memoria', () => {
    const i = informeEstres({
      ...ESTRES_INACTIVO,
      fase: 'terminada',
      eje: 'draw-calls',
      escalones: [
        { escalon: 1, carga: '+10 draw calls', estado: 'estable' },
        { escalon: 2, carga: '+20 draw calls', estado: 'recarga-por-memoria' },
      ],
      memoria: {
        antes: { geometrias: 40, texturas: 2 },
        despues: { geometrias: 40, texturas: 2 },
        liberada: true,
      },
    });
    expect(i).toEqual({
      eje: 'draw-calls',
      escalones: [
        { escalon: 1, carga: '+10 draw calls', estado: 'estable' },
        { escalon: 2, carga: '+20 draw calls', estado: 'recarga-por-memoria' },
      ],
      ultimo_estable: 1,
      memoria: {
        antes: { geometrias: 40, texturas: 2 },
        despues: { geometrias: 40, texturas: 2 },
        liberada: true,
      },
    });
    expect(informeEstres(ESTRES_INACTIVO)).toBeNull();
  });
});
