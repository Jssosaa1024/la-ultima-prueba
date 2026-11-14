import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUZZLES } from '../../src/content/puzzles';
import { nombreDeObjeto, SALAS_3D } from '../../src/content/salas';
import {
  iniciarControlador,
  OBJETO_CUADERNO,
  OBJETO_INTERCOMUNICADOR,
  OBJETO_SALIDA,
  type DocumentoVisible,
} from '../../src/signals/controlador';
import { cuadernoActivo, reiniciarCuaderno } from '../../src/signals/cuaderno';
import { quitarEjemplo } from '../../src/signals/ejemplo';
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
  mecanismo,
  pistas,
  reiniciarMecanismo,
} from '../../src/signals/mecanismo';
import {
  DURACION_MS,
  fase,
  final,
  grabaciones,
  inventario,
  modo,
  opcionesFinal,
  reiniciarPartida,
  reloj,
  restanteEn,
  sala,
  sellos,
} from '../../src/signals/partida';
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
const jugar = (): void => enviar({ t: 'iniciar', modo: 'individual' });

beforeEach(() => {
  vi.useFakeTimers();
  ahora = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => ahora);
  documento = documentoFalso();
  detener = iniciarControlador({ documento });
});

afterEach(() => {
  detener();
  vi.useRealTimers();
  vi.restoreAllMocks();
  quitarEjemplo();
  reiniciarPartida();
  reiniciarInterfaz();
  reiniciarCuaderno();
  reiniciarMecanismo();
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

  it('examinar abre la inspección y suelta el objeto', () => {
    jugar();
    accionar('porteria-mural', 'examinar');
    expect(panel.value).toBe('inspeccion');
    expect(inspeccionando.value).toBe('porteria-mural');
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
    enviar({ t: 'ejemplo', final: null });
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
    enviar({ t: 'ejemplo', final: null });
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

  it.each([
    ['justo_a_tiempo', 5, 3],
    ['el_legado', 5, 3],
    ['pedir_ayuda', 5, 3],
    ['tiempo_cumplido', 5, 3],
  ] as const)('con ?ejemplo=1&final=%s se llega a ese final', (id, nSellos, nGrabaciones) => {
    jugar();
    enviar({ t: 'ejemplo', final: id });
    expect(fase.value).toBe('final');
    expect(final.value).toBe(id);
    expect(sellos.value).toHaveLength(nSellos);
    expect(grabaciones.value).toHaveLength(nGrabaciones);
    expect(reloj.value.pausado).toBe(true);
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
    enviar({ t: 'ejemplo', final: null });
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

describe('controlador: datos de ejemplo (?ejemplo=1)', () => {
  it('examinar abre la inspección y recoger guarda el objeto', () => {
    jugar();
    enviar({ t: 'ejemplo', final: null });
    expect(cuadernoActivo.value).toBe(true);
    expect(enfocado.value?.id).toBe('s1-factura');
    enviar({ t: 'accion', objeto: 's1-factura', accion: 'examinar' });
    expect(panel.value).toBe('inspeccion');
    expect(inspeccionando.value).toBe('s1-factura');
    expect(enfocado.value?.id).toBe('s1-menu');
    enviar({ t: 'accion', objeto: 's1-menu', accion: 'examinar' });
    enviar({ t: 'accion', objeto: 's1-tarjeta', accion: 'recoger' });
    expect(inventario.value.map((o) => o.id)).toEqual(['s1-tarjeta']);
  });

  it('sin partida en marcha, la orden de ejemplo no hace nada', () => {
    enviar({ t: 'ejemplo', final: 'el_legado' });
    expect(fase.value).toBe('inicio');
    expect(sellos.value).toEqual([]);
  });
});
