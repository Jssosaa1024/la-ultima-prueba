import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Puzzle } from '../../src/content/esquema';
import { GRABACIONES_ESCONDIDAS } from '../../src/content/grabaciones';
import { PUZZLES } from '../../src/content/puzzles';
import { nombreDeObjeto, SALAS_3D } from '../../src/content/salas';
import {
  cargar,
  CLAVE_GUARDADO,
  guardar,
  VERSION_GUARDADO,
  type Almacen,
  type Guardado,
} from '../../src/game/guardado';
import { aplicar, crearPartida, type Accion } from '../../src/game/partida';
import {
  iniciarControlador,
  OBJETO_CUADERNO,
  OBJETO_INTERCOMUNICADOR,
  OBJETO_SALIDA,
  type DocumentoVisible,
} from '../../src/signals/controlador';
import {
  cuadernoActivo,
  datosEncontrados,
  MAX_NOTAS,
  notas,
  reiniciarCuaderno,
} from '../../src/signals/cuaderno';
import { fichas } from '../../src/signals/contenido';
import {
  aviso,
  enfocado,
  inspeccionando,
  panel,
  reiniciarInterfaz,
  type AccionObjeto,
} from '../../src/signals/interfaz';
import {
  condiciones,
  etapa,
  maquinaResuelta,
  mecanismo,
  pistas,
  reiniciarMecanismo,
  resultado,
} from '../../src/signals/mecanismo';
import {
  avance,
  DURACION_MS,
  fase,
  final,
  grabaciones,
  guardada,
  inventario,
  modo,
  opcionesFinal,
  reiniciarPartida,
  reloj,
  restanteEn,
  sala,
  sellos,
} from '../../src/signals/partida';
import { girarTelefono } from '../../src/signals/pantalla';
import { enviar, escuchar } from '../../src/signals/puente';

/** Documento falso: deja ocultar y mostrar la pestaña desde la prueba. */
function documentoFalso(): DocumentoVisible & { ocultar(oculta: boolean): void } {
  const oyentes = new Set<() => void>();
  let hidden = false;
  return {
    get hidden() {
      return hidden;
    },
    addEventListener: (_tipo, oyente) => void oyentes.add(oyente),
    removeEventListener: (_tipo, oyente) => void oyentes.delete(oyente),
    ocultar(oculta) {
      hidden = oculta;
      for (const oyente of oyentes) oyente();
    },
  };
}

let detener: () => void;
let documento: ReturnType<typeof documentoFalso>;
let ahora = 0;

/** Pasa el tiempo: mueve el reloj del juego y dispara los temporizadores que venzan. */
function avanzar(ms: number): void {
  ahora += ms;
  vi.advanceTimersByTime(ms);
}

/** El motor enfoca un objeto de la escena y el jugador toca el botón del HUD. */
function accionar(objeto: string, accion: AccionObjeto): void {
  enfocado.value = { id: objeto, nombre: nombreDeObjeto(objeto) ?? objeto, accion };
  enviar({ t: 'accion', objeto, accion });
}

const usar = (objeto: string): void => accionar(objeto, 'usar');

/** Entra a la sala 1, la resuelve con las soluciones del JSON y vuelve a la portería. */
function ganarElPrimerSello(): void {
  const s1 = PUZZLES[0];
  if (!s1) throw new Error('falta el puzzle de la sala 1');
  usar('porteria-puerta-1');
  for (const e of s1.etapas) {
    enviar({ t: 'ajustar', estado: e.solucion });
    if (e.intento.tipo === 'accionar') enviar({ t: 'accionar', objeto: e.intento.objeto });
  }
  usar('s1-puerta');
}
const jugar = (): void => enviar({ t: 'iniciar', modo: 'individual' });

beforeEach(() => {
  vi.useFakeTimers();
  ahora = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => ahora);
  documento = documentoFalso();
  detener = iniciarControlador({ documento, almacen: null });
});

afterEach(() => {
  detener();
  vi.useRealTimers();
  vi.restoreAllMocks();
  reiniciarPartida();
  reiniciarInterfaz();
  reiniciarCuaderno();
  reiniciarMecanismo();
  fichas.value = {};
  girarTelefono.value = false;
});

describe('controlador: empezar, pausar y salir', () => {
  it('«iniciar» en individual pone a correr los 40 minutos en la portería', () => {
    panel.value = 'cuaderno';
    jugar();
    expect(fase.value).toBe('jugando');
    expect(modo.value).toBe('individual');
    expect(sala.value).toBe('porteria');
    expect(panel.value).toBeNull();
    avanzar(60_000);
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 60_000);
  });

  it('ignora el cooperativo, que aún no existe', () => {
    enviar({ t: 'iniciar', modo: 'cooperativo' });
    expect(fase.value).toBe('inicio');
  });

  it('pausar congela el reloj y reanudar sigue desde ahí', () => {
    jugar();
    avanzar(10_000);
    enviar({ t: 'pausar' });
    avanzar(500_000);
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 10_000);
    enviar({ t: 'reanudar' });
    avanzar(5_000);
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 15_000);
  });

  it('«salir» vuelve al menú de inicio y ya no pasa nada con el tiempo', () => {
    jugar();
    enviar({ t: 'salir' });
    expect(fase.value).toBe('inicio');
    expect(modo.value).toBeNull();
    avanzar(DURACION_MS * 2);
    expect(fase.value).toBe('inicio');
    expect(final.value).toBeNull();
  });

  it('a los 40 minutos termina en «Tiempo cumplido» con el reloj detenido', () => {
    jugar();
    avanzar(DURACION_MS - 1);
    expect(fase.value).toBe('jugando');
    avanzar(1);
    expect(fase.value).toBe('final');
    expect(final.value).toBe('tiempo_cumplido');
    expect(reloj.value.pausado).toBe(true);
  });

  it('se suscribe al puente antes que quien llegue después (el motor)', () => {
    const vista: string[] = [];
    const dejar = escuchar((c) => {
      if (c.t === 'accion') vista.push(sala.value);
    });
    jugar();
    usar('porteria-puerta-1');
    dejar();
    // El oyente que se suscribió después ya ve la sala cambiada.
    expect(vista).toEqual(['s1-cooperativa']);
  });
});

describe('controlador: pestaña oculta', () => {
  it('ocultar la pestaña pausa el reloj y volver lo reanuda', () => {
    jugar();
    avanzar(10_000);
    documento.ocultar(true);
    expect(reloj.value.pausado).toBe(true);
    avanzar(60_000);
    documento.ocultar(false);
    expect(reloj.value.pausado).toBe(false);
    avanzar(5_000);
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 15_000);
  });

  it('con el cuaderno abierto y la pestaña oculta, el reloj espera a los dos', () => {
    jugar();
    enviar({ t: 'pausar' });
    documento.ocultar(true);
    documento.ocultar(false);
    expect(reloj.value.pausado).toBe(true);
    documento.ocultar(true);
    enviar({ t: 'reanudar' });
    expect(reloj.value.pausado).toBe(true);
    documento.ocultar(false);
    expect(reloj.value.pausado).toBe(false);
  });

  it('una partida que empieza con la pestaña oculta arranca en pausa', () => {
    documento.ocultar(true);
    jugar();
    expect(reloj.value.pausado).toBe(true);
    documento.ocultar(false);
    expect(reloj.value.pausado).toBe(false);
  });

  it('el tiempo no se acaba con la pestaña oculta', () => {
    jugar();
    documento.ocultar(true);
    avanzar(DURACION_MS * 2);
    expect(fase.value).toBe('jugando');
  });

  it('al detener el controlador deja de escuchar al documento', () => {
    jugar();
    detener();
    documento.ocultar(true);
    expect(reloj.value.pausado).toBe(false);
  });
});

describe('controlador: celular en vertical (T41b)', () => {
  it('con el aviso de girar el teléfono el reloj se pausa, y al girarlo sigue', () => {
    jugar();
    avanzar(10_000);
    girarTelefono.value = true;
    expect(reloj.value.pausado).toBe(true);
    avanzar(60_000);
    girarTelefono.value = false;
    expect(reloj.value.pausado).toBe(false);
    avanzar(5_000);
    expect(restanteEn(reloj.value, ahora)).toBe(DURACION_MS - 15_000);
  });

  it('con el cuaderno abierto, girar a horizontal no reanuda el reloj', () => {
    jugar();
    enviar({ t: 'pausar' });
    girarTelefono.value = true;
    girarTelefono.value = false;
    expect(reloj.value.pausado).toBe(true);
    girarTelefono.value = true;
    enviar({ t: 'reanudar' });
    expect(reloj.value.pausado).toBe(true);
    girarTelefono.value = false;
    expect(reloj.value.pausado).toBe(false);
  });

  it('una partida que empieza en vertical arranca en pausa', () => {
    girarTelefono.value = true;
    jugar();
    expect(reloj.value.pausado).toBe(true);
    girarTelefono.value = false;
    expect(reloj.value.pausado).toBe(false);
  });

  it('en el menú, girar el teléfono no hace nada', () => {
    girarTelefono.value = true;
    girarTelefono.value = false;
    expect(fase.value).toBe('inicio');
  });
});

describe('controlador: objetos de la portería', () => {
  it('los objetos con papel fijo existen en la portería', () => {
    const porteria = SALAS_3D.find((s) => s.id === 'porteria');
    const ids = porteria?.objetos.map((o) => o.id) ?? [];
    expect(ids).toEqual(
      expect.arrayContaining([OBJETO_SALIDA, OBJETO_INTERCOMUNICADOR, OBJETO_CUADERNO]),
    );
  });

  it('el inventario empieza vacío y la linterna entra una sola vez', () => {
    jugar();
    expect(inventario.value).toEqual([]);
    accionar('porteria-linterna', 'recoger');
    accionar('porteria-linterna', 'recoger');
    expect(inventario.value).toEqual([{ id: 'porteria-linterna', nombre: 'Linterna' }]);
  });

  it('recoger el cuaderno activa su botón en vez de sumarlo a la lista', () => {
    jugar();
    expect(cuadernoActivo.value).toBe(false);
    accionar(OBJETO_CUADERNO, 'recoger');
    expect(cuadernoActivo.value).toBe(true);
    // Sigue en `inventario` para que el motor lo quite de la silla, pero marcado.
    expect(inventario.value).toEqual([{ id: OBJETO_CUADERNO, nombre: 'Cuaderno', conBoton: true }]);
  });

  it('una partida nueva vuelve a empezar sin cuaderno', () => {
    jugar();
    accionar(OBJETO_CUADERNO, 'recoger');
    jugar();
    expect(cuadernoActivo.value).toBe(false);
    expect(inventario.value).toEqual([]);
  });

  it('examinar abre la inspección y deja el objeto enfocado, para volver a su botón al cerrar', () => {
    jugar();
    accionar('porteria-mural', 'examinar');
    expect(panel.value).toBe('inspeccion');
    expect(inspeccionando.value).toBe('porteria-mural');
    expect(enfocado.value?.id).toBe('porteria-mural');
  });

  it('recoger y usar sí sueltan el objeto', () => {
    jugar();
    accionar('porteria-linterna', 'recoger');
    expect(enfocado.value).toBeNull();
    usar('porteria-puerta-2');
    expect(enfocado.value).toBeNull();
  });

  it('ignora la acción si el objeto no es el enfocado o la acción no es la suya', () => {
    jugar();
    enviar({ t: 'accion', objeto: 'porteria-mural', accion: 'examinar' });
    expect(panel.value).toBeNull();
    enfocado.value = { id: 'porteria-puerta-1', nombre: 'Puerta 1', accion: 'usar' };
    enviar({ t: 'accion', objeto: 'porteria-puerta-1', accion: 'recoger' });
    expect(inventario.value).toEqual([]);
    expect(sala.value).toBe('porteria');
  });
});

describe('controlador: puertas en orden', () => {
  it('la puerta 1 está abierta desde el principio y su puerta devuelve a la portería', () => {
    jugar();
    usar('porteria-puerta-1');
    expect(sala.value).toBe('s1-cooperativa');
    expect(aviso.value).toBeNull();
    usar('s1-puerta');
    expect(sala.value).toBe('porteria');
  });

  it('las puertas 2 a 5 siguen cerradas y lo dicen con un aviso', () => {
    jugar();
    for (const n of [2, 3, 4, 5]) {
      usar(`porteria-puerta-${n}`);
      expect(sala.value).toBe('porteria');
      expect(aviso.value).toEqual({ t: 'puerta_cerrada', sala: n });
    }
  });

  it('con la sala 1 resuelta se abre la puerta 2, pero no la 3', () => {
    jugar();
    ganarElPrimerSello();
    expect(sellos.value).toEqual(['s1-cooperativa']);
    usar('porteria-puerta-3');
    expect(sala.value).toBe('porteria');
    usar('porteria-puerta-2');
    expect(sala.value).toBe('s2-laboratorio');
    usar('s2-puerta');
    expect(sala.value).toBe('porteria');
  });

  it('no se pasa de una sala a otra sin volver a la portería', () => {
    jugar();
    ganarElPrimerSello();
    usar('porteria-puerta-1');
    usar('porteria-puerta-2');
    expect(sala.value).toBe('s1-cooperativa');
  });
});

describe('controlador: puerta de salida e intercomunicador', () => {
  it('la puerta de salida abre la elección de final con lo que falta', () => {
    jugar();
    usar(OBJETO_SALIDA);
    expect(panel.value).toBe('salida');
    expect(opcionesFinal.value).toEqual({
      salir: false,
      restaurar: false,
      faltanGrabaciones: 3,
      salasConGrabacion: ['s2-laboratorio', 's3-gimnasio', 's4-biblioteca'],
    });
  });

  it('sin los cinco sellos no se puede elegir final', () => {
    jugar();
    enviar({ t: 'elegir_final', opcion: 'salir' });
    enviar({ t: 'elegir_final', opcion: 'restaurar' });
    expect(fase.value).toBe('jugando');
    expect(final.value).toBeNull();
  });

  it('el intercomunicador pide confirmación antes de terminar', () => {
    jugar();
    avanzar(30_000);
    usar(OBJETO_INTERCOMUNICADOR);
    expect(panel.value).toBe('ayuda');
    expect(fase.value).toBe('jugando');
    enviar({ t: 'pedir_ayuda' });
    expect(fase.value).toBe('final');
    expect(final.value).toBe('pedir_ayuda');
    expect(panel.value).toBeNull();
    expect(reloj.value).toEqual({ restanteMs: DURACION_MS - 30_000, pausado: true, desde: ahora });
  });

  it('después del final no se atienden más acciones', () => {
    jugar();
    enviar({ t: 'pedir_ayuda' });
    usar('porteria-puerta-1');
    expect(sala.value).toBe('porteria');
    avanzar(DURACION_MS);
    expect(final.value).toBe('pedir_ayuda');
  });
});

describe('controlador: signals del mecanismo y pistas', () => {
  const s1 = PUZZLES[0];
  if (!s1) throw new Error('falta el puzzle de la sala 1');

  it('al entrar a una sala publica su etapa, el estado inicial y las condiciones', () => {
    jugar();
    expect(etapa.value).toBeNull();
    usar('porteria-puerta-1');
    expect(etapa.value).toEqual({ sala: 's1-cooperativa', puzzle: 's1-etiquetadora', etapa: 0 });
    expect(mecanismo.value).toEqual(s1.etapas[0]?.estado_inicial);
    expect(condiciones.value).toEqual({ precio: false });
    usar('s1-puerta');
    expect(etapa.value).toBeNull();
    expect(mecanismo.value).toBeNull();
    expect(condiciones.value).toEqual({});
  });

  it('una sala con sello ya no tiene etapa pendiente', () => {
    jugar();
    ganarElPrimerSello();
    usar('porteria-puerta-1');
    expect(etapa.value).toBeNull();
  });

  it('ofrece la primera pista tras el tiempo activo en la etapa, sin que nadie toque nada', () => {
    const tras = (s1.pistas[0]?.tras_segundos ?? 0) * 1000;
    jugar();
    usar('porteria-puerta-1');
    avanzar(tras - 1);
    expect(pistas.value).toEqual({ ofrecidas: 0, vistas: 0 });
    avanzar(1);
    expect(pistas.value).toEqual({ ofrecidas: 1, vistas: 0 });
  });

  it('el tiempo en la portería, en pausa o con la pestaña oculta no cuenta para las pistas', () => {
    const tras = (s1.pistas[0]?.tras_segundos ?? 0) * 1000;
    jugar();
    avanzar(tras);
    usar('porteria-puerta-1');
    avanzar(tras - 2_000);
    enviar({ t: 'pausar' });
    avanzar(tras);
    enviar({ t: 'reanudar' });
    documento.ocultar(true);
    avanzar(tras);
    documento.ocultar(false);
    usar('s1-puerta');
    avanzar(tras);
    usar('porteria-puerta-1');
    avanzar(1_999);
    expect(pistas.value.ofrecidas).toBe(0);
    avanzar(1);
    expect(pistas.value.ofrecidas).toBe(1);
  });

  it('«ver pista» abre solo las pistas ya ofrecidas', () => {
    const tras = (s1.pistas[0]?.tras_segundos ?? 0) * 1000;
    jugar();
    usar('porteria-puerta-1');
    enviar({ t: 'ver_pista' });
    expect(pistas.value).toEqual({ ofrecidas: 0, vistas: 0 });
    avanzar(tras);
    enviar({ t: 'ver_pista' });
    enviar({ t: 'ver_pista' });
    expect(pistas.value).toEqual({ ofrecidas: 1, vistas: 1 });
    // En la portería no hay pistas que mostrar; al volver a la sala siguen ahí.
    usar('s1-puerta');
    expect(pistas.value).toEqual({ ofrecidas: 0, vistas: 0 });
    usar('porteria-puerta-1');
    expect(pistas.value).toEqual({ ofrecidas: 1, vistas: 1 });
  });
});

describe('controlador: fichas de inspección (T35c)', () => {
  it('al empezar publica las fichas de todas las salas, con el nombre del objeto de título', () => {
    expect(fichas.value).toEqual({});
    jugar();
    expect(fichas.value['porteria-mural']?.titulo).toBe(nombreDeObjeto('porteria-mural'));
    expect(fichas.value['s1-pizarra']?.bloques[0]).toMatchObject({ tipo: 'tabla' });
    // Los objetos que se usan (la máquina) no tienen ficha.
    expect(fichas.value['s1-etiquetadora']).toBeUndefined();
  });

  it('examinar un objeto real abre su ficha y lo anota en el cuaderno', () => {
    jugar();
    accionar('porteria-mural', 'examinar');
    expect(panel.value).toBe('inspeccion');
    expect(inspeccionando.value).toBe('porteria-mural');
    expect(fichas.value[inspeccionando.value ?? '']).toBeDefined();
    expect(datosEncontrados.value).toEqual(['porteria-mural']);
  });

  it('las fichas que dependen del avance cambian al resolver una etapa', () => {
    const s1 = PUZZLES[0];
    if (!s1) throw new Error('falta el puzzle de la sala 1');
    jugar();
    usar('porteria-puerta-1');
    const antes = fichas.value['s1-productos'];
    const pizarra = fichas.value['s1-pizarra'];
    enviar({ t: 'ajustar', estado: s1.etapas[0]?.solucion });
    enviar({ t: 'accionar', objeto: 's1-palanca' });
    expect(etapa.value?.etapa).toBe(1);
    expect(fichas.value['s1-productos']).not.toEqual(antes);
    // Las que no dependen del avance siguen siendo el mismo objeto: no se redibujan.
    expect(fichas.value['s1-pizarra']).toEqual(pizarra);
  });

  it('un papel que se recoge queda en los datos encontrados, para leerlo en el cuaderno', () => {
    jugar();
    ganarElPrimerSello();
    usar('porteria-puerta-2');
    accionar('s2-hoja-ayer', 'recoger');
    expect(inventario.value.map((o) => o.id)).toEqual(['s2-hoja-ayer']);
    expect(datosEncontrados.value).toEqual(['s2-hoja-ayer']);
    // La linterna no tiene nada escrito: no es un dato.
    usar('s2-puerta');
    accionar('porteria-linterna', 'recoger');
    expect(datosEncontrados.value).toEqual(['s2-hoja-ayer']);
  });

  it('al salir al menú no quedan fichas', () => {
    jugar();
    enviar({ t: 'salir' });
    expect(fichas.value).toEqual({});
  });
});

describe('controlador: guardar y continuar (T31c)', () => {
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

  /** Un almacén que falla como Safari en una pestaña privada o con la cuota llena. */
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

  /** Vuelve a arrancar el controlador, como al recargar la página, con ese almacén. */
  function recargar(almacen: Almacen | null): void {
    detener();
    reiniciarPartida();
    reiniciarInterfaz();
    reiniciarCuaderno();
    reiniciarMecanismo();
    detener = iniciarControlador({ documento, almacen });
  }

  const leer = (almacen: Almacen): Guardado | null => cargar(almacen, PUZZLES);

  /** Sala 1 resuelta y la sala 2 a mitad, con el jugador adentro. */
  const enCurso = (): Guardado => ({
    v: VERSION_GUARDADO,
    partida: (
      [
        { t: 'entrar', sala: 's1-cooperativa' },
        { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 },
        { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 1 },
        { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 2 },
        { t: 'volver_porteria' },
        { t: 'entrar', sala: 's2-laboratorio' },
        { t: 'resolver_etapa', sala: 's2-laboratorio', etapa: 0 },
        { t: 'recoger_grabacion', grabacion: 'grab-1' },
      ] satisfies Accion[]
    ).reduce(aplicar, crearPartida()),
    restanteMs: 31 * 60 * 1000,
    pistas: {
      's1-cooperativa': { msEnEtapa: 0, intentosEnEtapa: 0, ofrecidas: 1, vistas: 1 },
      's2-laboratorio': { msEnEtapa: 45_000, intentosEnEtapa: 2, ofrecidas: 1, vistas: 0 },
    },
    mecanismos: {
      's2-laboratorio': {
        a: { nivel: 10, caudal: 4, visible: true },
        b: { nivel: 50, caudal: -2, visible: true },
      },
    },
    notas: [
      { id: 'n2', texto: 'B baja 2 cm cada segundo' },
      { id: 'n7', texto: '−20 % y +25 % se anulan' },
    ],
    datos: ['s2-graficador'],
    inventario: ['porteria-linterna', OBJETO_CUADERNO, 'objeto-que-ya-no-existe'],
  });

  it('guarda después de cada orden: puertas, objetos y notas', () => {
    const almacen = memoria();
    recargar(almacen);
    expect(leer(almacen)).toBeNull();
    jugar();
    expect(leer(almacen)?.partida.lugar).toBe('porteria');
    accionar('porteria-linterna', 'recoger');
    accionar(OBJETO_CUADERNO, 'recoger');
    accionar('porteria-mural', 'examinar');
    enviar({ t: 'nota', op: 'agregar', texto: 'faltan cinco sellos' });
    usar('porteria-puerta-1');
    expect(leer(almacen)).toMatchObject({
      partida: { lugar: 's1-cooperativa' },
      inventario: ['porteria-linterna', OBJETO_CUADERNO],
      datos: ['porteria-mural'],
      notas: [{ id: 'n1', texto: 'faltan cinco sellos' }],
    });
  });

  it('guarda al pausar y al ocultar la pestaña, con el tiempo que quedaba', () => {
    const almacen = memoria();
    recargar(almacen);
    jugar();
    avanzar(10_000);
    enviar({ t: 'pausar' });
    expect(leer(almacen)?.restanteMs).toBe(DURACION_MS - 10_000);
    enviar({ t: 'reanudar' });
    avanzar(5_000);
    documento.ocultar(true);
    expect(leer(almacen)?.restanteMs).toBe(DURACION_MS - 15_000);
  });

  it('guarda las pistas con el tiempo jugado en la etapa', () => {
    const almacen = memoria();
    recargar(almacen);
    jugar();
    usar('porteria-puerta-1');
    avanzar(125_000);
    enviar({ t: 'ver_pista' });
    expect(leer(almacen)?.pistas).toEqual({
      's1-cooperativa': { msEnEtapa: 125_000, intentosEnEtapa: 0, ofrecidas: 1, vistas: 1 },
    });
  });

  it('al arrancar le dice al menú si hay una partida guardada', () => {
    const almacen = memoria();
    recargar(almacen);
    expect(guardada.value).toBeNull();
    guardar(almacen, enCurso());
    recargar(almacen);
    expect(guardada.value).toEqual({ restanteMs: 31 * 60 * 1000, sellos: 1 });
    expect(fase.value).toBe('inicio');
  });

  it('«continuar» deja la partida donde iba, con el reloj corriendo desde lo que quedaba', () => {
    const almacen = memoria();
    guardar(almacen, enCurso());
    recargar(almacen);
    avanzar(3_600_000); // Una hora con la pestaña cerrada: no cuenta.
    enviar({ t: 'continuar' });

    expect(fase.value).toBe('jugando');
    expect(modo.value).toBe('individual');
    expect(sala.value).toBe('s2-laboratorio');
    expect(sellos.value).toEqual(['s1-cooperativa']);
    expect(grabaciones.value).toEqual(['grab-1']);
    expect(reloj.value).toEqual({ restanteMs: 31 * 60 * 1000, pausado: false, desde: ahora });
    expect(etapa.value).toEqual({ sala: 's2-laboratorio', puzzle: 's2-tanques', etapa: 1 });
    expect(mecanismo.value).toEqual(enCurso().mecanismos['s2-laboratorio']);
    expect(pistas.value).toEqual({ ofrecidas: 1, vistas: 0 });
    expect(notas.value.map((n) => n.texto)).toEqual([
      'B baja 2 cm cada segundo',
      '−20 % y +25 % se anulan',
    ]);
    expect(datosEncontrados.value).toEqual(['s2-graficador']);
    // El objeto que ya no existe en el contenido no vuelve.
    expect(inventario.value).toEqual([
      { id: 'porteria-linterna', nombre: 'Linterna' },
      { id: OBJETO_CUADERNO, nombre: 'Cuaderno', conBoton: true },
    ]);
    expect(cuadernoActivo.value).toBe(true);

    // Y se sigue jugando: la puerta devuelve a la portería y el tiempo corre.
    usar('s2-puerta');
    expect(sala.value).toBe('porteria');
    avanzar(31 * 60 * 1000);
    expect(final.value).toBe('tiempo_cumplido');
  });

  it('las notas nuevas siguen la numeración guardada', () => {
    const almacen = memoria();
    guardar(almacen, enCurso());
    recargar(almacen);
    enviar({ t: 'continuar' });
    enviar({ t: 'nota', op: 'agregar', texto: 'otra' });
    expect(notas.value.map((n) => n.id)).toEqual(['n2', 'n7', 'n8']);
    expect(leer(almacen)?.notas.map((n) => n.id)).toEqual(['n2', 'n7', 'n8']);
  });

  it('«continuar» no hace nada sin guardado, con uno dañado o con la partida ya en marcha', () => {
    const almacen = memoria();
    recargar(almacen);
    enviar({ t: 'continuar' });
    expect(fase.value).toBe('inicio');

    almacen.setItem(CLAVE_GUARDADO, JSON.stringify({ ...enCurso(), restanteMs: -1 }));
    recargar(almacen);
    expect(guardada.value).toBeNull();
    enviar({ t: 'continuar' });
    expect(fase.value).toBe('inicio');

    guardar(almacen, enCurso());
    recargar(almacen);
    jugar();
    enviar({ t: 'continuar' });
    expect(sala.value).toBe('porteria');
    expect(sellos.value).toEqual([]);
  });

  it('salir y los finales borran lo guardado', () => {
    const almacen = memoria();
    recargar(almacen);
    jugar();
    enviar({ t: 'salir' });
    expect(almacen.datos.size).toBe(0);
    expect(guardada.value).toBeNull();

    guardar(almacen, enCurso());
    recargar(almacen);
    enviar({ t: 'continuar' });
    enviar({ t: 'pedir_ayuda' });
    expect(almacen.datos.size).toBe(0);
    expect(guardada.value).toBeNull();

    enviar({ t: 'salir' });
    jugar();
    avanzar(DURACION_MS);
    expect(final.value).toBe('tiempo_cumplido');
    expect(almacen.datos.size).toBe(0);
  });

  it('con el almacenamiento bloqueado (pestaña privada) se juega igual, sin guardar', () => {
    recargar(roto);
    expect(guardada.value).toBeNull();
    jugar();
    accionar('porteria-linterna', 'recoger');
    enviar({ t: 'nota', op: 'agregar', texto: 'sin guardar' });
    usar('porteria-puerta-1');
    documento.ocultar(true);
    documento.ocultar(false);
    expect(sala.value).toBe('s1-cooperativa');
    enviar({ t: 'continuar' });
    enviar({ t: 'salir' });
    expect(fase.value).toBe('inicio');
  });

  it('no acepta más notas de las que caben en el guardado', () => {
    const almacen = memoria();
    recargar(almacen);
    jugar();
    for (let i = 0; i < MAX_NOTAS + 5; i++) {
      enviar({ t: 'nota', op: 'agregar', texto: 'nota ' + String(i) });
    }
    expect(notas.value).toHaveLength(MAX_NOTAS);
    expect(leer(almacen)?.notas).toHaveLength(MAX_NOTAS);
  });
});

describe('controlador: órdenes de los mecanismos (T31d)', () => {
  const puzzle = (n: number): Puzzle => {
    const p = PUZZLES[n - 1];
    if (!p) throw new Error('falta el puzzle ' + String(n));
    return p;
  };
  const ajustar = (estado: unknown): void => enviar({ t: 'ajustar', estado });
  const accionarMaquina = (objeto: string): void => enviar({ t: 'accionar', objeto });

  /** Resuelve la etapa actual de la sala con la solución de ejemplo del JSON. */
  function resolverEtapa(p: Puzzle, n: number): void {
    const e = p.etapas[n];
    if (!e) throw new Error('falta la etapa');
    ajustar(e.solucion);
    if (e.intento.tipo === 'accionar') accionarMaquina(e.intento.objeto);
    else avanzar(e.intento.segundos * 1000);
  }

  it('accionar con ajustes que no resuelven muestra lo que pasó y cuenta un intento', () => {
    jugar();
    usar('porteria-puerta-1');
    ajustar({ producto: 'jugo', precio: 2000, rodillos: [20] });
    expect(mecanismo.value).toEqual({ producto: 'jugo', precio: 2000, rodillos: [20] });
    accionarMaquina('s1-palanca');
    expect(resultado.value).toMatchObject({
      sala: 's1-cooperativa',
      puzzle: 's1-etiquetadora',
      etapa: 0,
      estado: { producto: 'jugo', precio: 2000, rodillos: [20] },
      condiciones: { precio: false },
      resuelta: false,
      sello: false,
    });
    // Sigue en la misma etapa, con los rodillos donde los dejó el jugador.
    expect(etapa.value?.etapa).toBe(0);
    expect(mecanismo.value).toEqual({ producto: 'jugo', precio: 2000, rodillos: [20] });
    // Cada vez que se acciona cuenta, aunque los ajustes sean los mismos: a la tercera, pista.
    const antes = resultado.value?.n ?? 0;
    accionarMaquina('s1-palanca');
    expect(pistas.value.ofrecidas).toBe(0);
    accionarMaquina('s1-palanca');
    expect(pistas.value.ofrecidas).toBe(1);
    expect(resultado.value?.n).toBe(antes + 2);
  });

  it('accionar con la solución pasa a la etapa siguiente, con su estado inicial', () => {
    const s1 = puzzle(1);
    jugar();
    usar('porteria-puerta-1');
    resolverEtapa(s1, 0);
    expect(resultado.value).toMatchObject({ etapa: 0, resuelta: true, sello: false });
    expect(resultado.value?.estado).toEqual(s1.etapas[0]?.solucion);
    expect(etapa.value).toEqual({ sala: 's1-cooperativa', puzzle: 's1-etiquetadora', etapa: 1 });
    expect(mecanismo.value).toEqual(s1.etapas[1]?.estado_inicial);
    expect(sellos.value).toEqual([]);
  });

  it('los intentos vuelven a cero al cambiar de etapa; las pistas ofrecidas quedan', () => {
    const s1 = puzzle(1);
    jugar();
    usar('porteria-puerta-1');
    for (let i = 0; i < 3; i++) accionarMaquina('s1-palanca');
    expect(pistas.value.ofrecidas).toBe(1);
    resolverEtapa(s1, 0);
    accionarMaquina('s1-palanca');
    accionarMaquina('s1-palanca');
    expect(pistas.value.ofrecidas).toBe(1);
  });

  it('resolver las tres etapas da el sello y abre la puerta siguiente', () => {
    const s1 = puzzle(1);
    jugar();
    usar('porteria-puerta-1');
    for (const n of [0, 1, 2]) resolverEtapa(s1, n);
    expect(resultado.value).toMatchObject({ etapa: 2, resuelta: true, sello: true });
    expect(sellos.value).toEqual(['s1-cooperativa']);
    expect(etapa.value).toBeNull();
    expect(mecanismo.value).toBeNull();
    usar('s1-puerta');
    usar('porteria-puerta-2');
    expect(sala.value).toBe('s2-laboratorio');
  });

  it('ignora ajustes que la etapa no permite y objetos que no confirman la etapa', () => {
    const s1 = puzzle(1);
    jugar();
    usar('porteria-puerta-1');
    const inicial = s1.etapas[0]?.estado_inicial;
    ajustar({ producto: 'jugo', precio: 1, rodillos: [-20] }); // cambia el precio
    ajustar({ producto: 'jugo', precio: 2000, rodillos: [-99] }); // rodillo que no existe
    ajustar('<script>');
    ajustar(null);
    expect(mecanismo.value).toEqual(inicial);
    ajustar(s1.etapas[0]?.solucion);
    accionarMaquina('s1-registradora');
    accionarMaquina('s2-palanca');
    expect(resultado.value).toBeNull();
    expect(etapa.value?.etapa).toBe(0);
  });

  it('fuera de una sala con etapa pendiente, las órdenes no hacen nada', () => {
    const s1 = puzzle(1);
    ajustar(s1.etapas[0]?.solucion);
    accionarMaquina('s1-palanca');
    jugar();
    ajustar(s1.etapas[0]?.solucion);
    accionarMaquina('s1-palanca');
    expect(resultado.value).toBeNull();
    expect(mecanismo.value).toBeNull();
  });

  it('los ajustes se conservan al salir de la sala y volver', () => {
    jugar();
    usar('porteria-puerta-1');
    ajustar({ producto: 'jugo', precio: 2000, rodillos: [25, -50] });
    usar('s1-puerta');
    usar('porteria-puerta-1');
    expect(mecanismo.value).toEqual({ producto: 'jugo', precio: 2000, rodillos: [25, -50] });
  });

  describe('máquinas que responden en vivo (sala 4)', () => {
    const s4 = puzzle(4);
    const reposo = 5_000;

    /** Deja la partida dentro de la biblioteca, con las tres primeras salas resueltas. */
    function entrarALaBiblioteca(): void {
      jugar();
      for (const n of [1, 2, 3]) {
        usar('porteria-puerta-' + String(n));
        for (const e of [0, 1, 2]) resolverEtapa(puzzle(n), e);
        usar('s' + String(n) + '-puerta');
      }
      usar('porteria-puerta-4');
      expect(etapa.value).toEqual({ sala: 's4-biblioteca', puzzle: 's4-carritos', etapa: 0 });
    }

    it('las condiciones cambian en vivo, pero la etapa se resuelve al quedar quieta', () => {
      entrarALaBiblioteca();
      ajustar({ carritos: [4, 4, 4, 4, 4] });
      expect(condiciones.value).toEqual({ media: true });
      expect(etapa.value?.etapa).toBe(0);
      avanzar(reposo - 1);
      expect(etapa.value?.etapa).toBe(0);
      avanzar(1);
      expect(etapa.value?.etapa).toBe(1);
      expect(resultado.value).toMatchObject({ etapa: 0, resuelta: true, sello: false });
      expect(mecanismo.value).toEqual(s4.etapas[1]?.estado_inicial);
    });

    it('pasar por la solución sin detenerse no resuelve la etapa', () => {
      entrarALaBiblioteca();
      ajustar({ carritos: [4, 4, 4, 4, 4] });
      avanzar(reposo - 1_000);
      ajustar({ carritos: [4, 4, 4, 4, 3] });
      avanzar(reposo * 3);
      expect(etapa.value?.etapa).toBe(0);
      expect(resultado.value?.sala).not.toBe('s4-biblioteca');
    });

    it('un reparto completo que no resuelve cuenta un intento al quedar quieto, una sola vez', () => {
      entrarALaBiblioteca();
      resolverEtapa(s4, 0);
      // Etapa «torcer»: media 4 y mediana 3. Con 4, 4, 4, 4, 4 la mediana es 4.
      for (const reparto of [
        [5, 4, 4, 4, 3],
        [6, 4, 4, 4, 2],
        [7, 4, 4, 4, 1],
      ]) {
        ajustar({ carritos: reparto });
        expect(pistas.value.ofrecidas).toBe(0);
        avanzar(reposo * 2); // El doble de tiempo no cuenta dos veces.
      }
      expect(pistas.value.ofrecidas).toBe(1);
      expect(etapa.value?.etapa).toBe(1);
    });

    it('con libros sin repartir no cuenta intento, y en pausa el reposo no avanza', () => {
      entrarALaBiblioteca();
      resolverEtapa(s4, 0);
      for (const n of [3, 2, 1]) {
        ajustar({ carritos: [n, 0, 0, 0, 0] });
        avanzar(reposo);
      }
      expect(pistas.value.ofrecidas).toBe(0);

      ajustar({ carritos: [1, 2, 3, 3, 11] });
      enviar({ t: 'pausar' });
      avanzar(reposo * 2);
      expect(etapa.value?.etapa).toBe(1);
      enviar({ t: 'reanudar' });
      avanzar(reposo);
      expect(etapa.value?.etapa).toBe(2);
    });
  });

  it('una partida completa: cinco sellos y la puerta de salida deja salir', () => {
    jugar();
    for (const n of [1, 2, 3, 4, 5]) {
      usar('porteria-puerta-' + String(n));
      for (const e of [0, 1, 2]) resolverEtapa(puzzle(n), e);
      expect(resultado.value).toMatchObject({ etapa: 2, resuelta: true, sello: true });
      usar('s' + String(n) + '-puerta');
    }
    expect(sellos.value).toHaveLength(5);
    usar(OBJETO_SALIDA);
    expect(opcionesFinal.value).toMatchObject({ salir: true, restaurar: false });
    enviar({ t: 'elegir_final', opcion: 'restaurar' });
    expect(fase.value).toBe('jugando');
    enviar({ t: 'elegir_final', opcion: 'salir' });
    expect(fase.value).toBe('final');
    expect(final.value).toBe('justo_a_tiempo');
  });

  it('los ajustes y los intentos se guardan y vuelven al continuar', () => {
    const datos = new Map<string, string>();
    const almacen: Almacen = {
      getItem: (k) => datos.get(k) ?? null,
      setItem: (k, v) => void datos.set(k, v),
      removeItem: (k) => void datos.delete(k),
    };
    detener();
    detener = iniciarControlador({ documento, almacen });
    jugar();
    usar('porteria-puerta-1');
    resolverEtapa(puzzle(1), 0);
    ajustar({ producto: 'empanada', precio: 1600, rodillos: [20] });
    accionarMaquina('s1-palanca');

    detener();
    reiniciarPartida();
    reiniciarMecanismo();
    detener = iniciarControlador({ documento, almacen });
    enviar({ t: 'continuar' });
    expect(etapa.value).toEqual({ sala: 's1-cooperativa', puzzle: 's1-etiquetadora', etapa: 1 });
    expect(mecanismo.value).toEqual({ producto: 'empanada', precio: 1600, rodillos: [20] });
    accionarMaquina('s1-palanca');
    accionarMaquina('s1-palanca');
    expect(pistas.value.ofrecidas).toBe(1);
  });
});

describe('controlador: abrir el panel de la máquina (T37)', () => {
  it('usar un objeto de la máquina abre su panel y lo deja enfocado', () => {
    jugar();
    usar('porteria-puerta-1');
    usar('s1-etiquetadora');
    expect(panel.value).toBe('mecanismo');
    expect(enfocado.value?.id).toBe('s1-etiquetadora');
  });

  it('en la portería, usar un objeto que no es puerta ni tiene papel fijo no abre nada', () => {
    jugar();
    accionar('porteria-casillero', 'usar');
    expect(panel.value).toBeNull();
    expect(enfocado.value).toBeNull();
  });

  it('las puertas de las salas siguen llevando a la portería, sin abrir el panel', () => {
    jugar();
    usar('porteria-puerta-1');
    usar('s1-puerta');
    expect(panel.value).toBeNull();
    expect(sala.value).toBe('porteria');
  });
});

describe('controlador: volver a una sala ya resuelta (T76)', () => {
  const puzzle = (n: number): Puzzle => {
    const p = PUZZLES[n - 1];
    if (!p) throw new Error('falta el puzzle ' + String(n));
    return p;
  };

  /** Resuelve la etapa actual de la sala con la solución de ejemplo del JSON. */
  function resolverEtapa(p: Puzzle, n: number, estado: unknown = p.etapas[n]?.solucion): void {
    const e = p.etapas[n];
    if (!e) throw new Error('falta la etapa');
    enviar({ t: 'ajustar', estado });
    if (e.intento.tipo === 'accionar') enviar({ t: 'accionar', objeto: e.intento.objeto });
    else avanzar(e.intento.segundos * 1000);
  }

  it('conserva el sello, el avance y cómo quedó la máquina', () => {
    const s1 = puzzle(1);
    jugar();
    ganarElPrimerSello();
    expect(maquinaResuelta.value).toBeNull(); // en la portería no hay máquina

    usar('porteria-puerta-1');
    expect(sala.value).toBe('s1-cooperativa');
    expect(sellos.value).toEqual(['s1-cooperativa']);
    expect(avance.value['s1-cooperativa']).toBe(3);
    // No queda etapa pendiente, pero la máquina se ve como se dejó.
    expect(etapa.value).toBeNull();
    expect(mecanismo.value).toBeNull();
    expect(maquinaResuelta.value).toEqual(s1.etapas[2]?.solucion);

    usar('s1-puerta');
    expect(maquinaResuelta.value).toBeNull();
    expect(sellos.value).toEqual(['s1-cooperativa']);
  });

  it('recuerda los ajustes con los que se resolvió, no solo la solución de ejemplo', () => {
    const s1 = puzzle(1);
    jugar();
    usar('porteria-puerta-1');
    resolverEtapa(s1, 0);
    resolverEtapa(s1, 1);
    // La última etapa también se resuelve con los rodillos en el otro orden.
    const otroOrden = { producto: 'combo', precio: 4000, rodillos: [50, -50] };
    resolverEtapa(s1, 2, otroOrden);
    expect(sellos.value).toEqual(['s1-cooperativa']);
    expect(maquinaResuelta.value).toEqual(otroOrden);
    usar('s1-puerta');
    usar('porteria-puerta-1');
    expect(maquinaResuelta.value).toEqual(otroOrden);
  });

  it('la máquina resuelta ya no responde: ni ajustes ni palanca cambian nada', () => {
    const s1 = puzzle(1);
    jugar();
    ganarElPrimerSello();
    usar('porteria-puerta-1');
    const antes = { resultado: resultado.value, maquina: maquinaResuelta.value };
    enviar({ t: 'ajustar', estado: s1.etapas[0]?.estado_inicial });
    enviar({ t: 'accionar', objeto: 's1-palanca' });
    avanzar(60_000);
    expect(resultado.value).toBe(antes.resultado);
    expect(maquinaResuelta.value).toEqual(antes.maquina);
    expect(avance.value['s1-cooperativa']).toBe(3);
    expect(sellos.value).toEqual(['s1-cooperativa']);
  });

  it('usar la máquina de una sala resuelta abre su panel', () => {
    jugar();
    ganarElPrimerSello();
    usar('porteria-puerta-1');
    usar('s1-etiquetadora');
    expect(panel.value).toBe('mecanismo');
  });

  it('las pistas abiertas se pueden releer; no se ofrecen más ni corre su tiempo', () => {
    const s1 = puzzle(1);
    jugar();
    usar('porteria-puerta-1');
    // Tres intentos: primera pista. Se abre. Otros tres: segunda pista, que queda sin abrir.
    for (let i = 0; i < 3; i++) enviar({ t: 'accionar', objeto: 's1-palanca' });
    enviar({ t: 'ver_pista' });
    for (let i = 0; i < 3; i++) enviar({ t: 'accionar', objeto: 's1-palanca' });
    expect(pistas.value).toEqual({ ofrecidas: 2, vistas: 1 });
    for (const n of [0, 1, 2]) resolverEtapa(s1, n);
    usar('s1-puerta');

    usar('porteria-puerta-1');
    // Con el sello ya no hay pista «nueva»: solo la que se abrió.
    expect(pistas.value).toEqual({ ofrecidas: 1, vistas: 1 });
    avanzar(10 * 60 * 1000);
    enviar({ t: 'ver_pista' });
    expect(pistas.value).toEqual({ ofrecidas: 1, vistas: 1 });
  });

  it('al continuar una partida guardada dentro de una sala resuelta, la máquina queda con la solución', () => {
    const datos = new Map<string, string>();
    const almacen: Almacen = {
      getItem: (k) => datos.get(k) ?? null,
      setItem: (k, v) => void datos.set(k, v),
      removeItem: (k) => void datos.delete(k),
    };
    const s1 = puzzle(1);
    detener();
    detener = iniciarControlador({ documento, almacen });
    jugar();
    usar('porteria-puerta-1');
    resolverEtapa(s1, 0);
    resolverEtapa(s1, 1);
    resolverEtapa(s1, 2, { producto: 'combo', precio: 4000, rodillos: [50, -50] });

    // Recargar: se pierde con qué ajustes exactos se resolvió, no el sello ni el lugar.
    detener();
    reiniciarPartida();
    reiniciarMecanismo();
    detener = iniciarControlador({ documento, almacen });
    enviar({ t: 'continuar' });
    expect(sala.value).toBe('s1-cooperativa');
    expect(sellos.value).toEqual(['s1-cooperativa']);
    expect(etapa.value).toBeNull();
    expect(maquinaResuelta.value).toEqual(s1.etapas[2]?.solucion);
  });

  it('se puede volver por las grabaciones después de los sellos y llegar a «El legado»', () => {
    jugar();
    for (const n of [1, 2, 3, 4, 5]) {
      usar('porteria-puerta-' + String(n));
      for (const e of [0, 1, 2]) resolverEtapa(puzzle(n), e);
      usar('s' + String(n) + '-puerta');
    }
    expect(sellos.value).toHaveLength(5);
    expect(opcionesFinal.value).toMatchObject({ salir: true, restaurar: false });

    // Las tres salas con grabación ya tienen sello: se vuelve a cada una a buscarla.
    for (const g of GRABACIONES_ESCONDIDAS) {
      const n = g.sala.slice(1, 2);
      usar('porteria-puerta-' + n);
      expect(sala.value).toBe(g.sala);
      usar(g.objeto);
      expect(grabaciones.value).toContain(g.id);
      enviar({ t: 'accion', objeto: 's' + n + '-puerta', accion: 'usar' });
      usar('s' + n + '-puerta');
      expect(sala.value).toBe('porteria');
    }
    expect(grabaciones.value).toHaveLength(3);
    expect(sellos.value).toHaveLength(5);
    expect(opcionesFinal.value).toMatchObject({ salir: true, restaurar: true });
    enviar({ t: 'elegir_final', opcion: 'restaurar' });
    expect(final.value).toBe('el_legado');
  });
});
