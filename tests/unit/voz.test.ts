import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUION } from '../../src/content/guion';
import { PUZZLES } from '../../src/content/puzzles';
import { nombreDeObjeto } from '../../src/content/salas';
import { guardar, VERSION_GUARDADO, type Almacen } from '../../src/game/guardado';
import { aplicar, crearPartida, type Accion } from '../../src/game/partida';
import { ESPERA_VOZ_MS, iniciarControlador, OBJETO_RELOJ } from '../../src/signals/controlador';
import { reiniciarCuaderno } from '../../src/signals/cuaderno';
import { fichas } from '../../src/signals/contenido';
import { enfocado, reiniciarInterfaz, type AccionObjeto } from '../../src/signals/interfaz';
import { reiniciarMecanismo } from '../../src/signals/mecanismo';
import { reiniciarPartida } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';
import { colaVoz, decir, MAX_COLA, reiniciarVoz, terminarLinea } from '../../src/signals/voz';

// T34: lo que La Voz dice y cuándo. La interfaz muestra el subtítulo de la primera línea.

describe('cola de La Voz', () => {
  afterEach(reiniciarVoz);

  it('solo acepta ids del guion, sin repetir los que esperan', () => {
    decir('voz-intro-1');
    decir('voz-intro-1');
    decir('<img src=x>');
    decir('voz-que-no-existe');
    expect(colaVoz.value).toEqual(['voz-intro-1']);
  });

  it(`guarda como mucho ${MAX_COLA} líneas y pasa a la siguiente al terminar la primera`, () => {
    for (const id of ['voz-intro-1', 'voz-intro-2', 'voz-intro-3', 'voz-espera']) decir(id);
    expect(colaVoz.value).toEqual(['voz-intro-1', 'voz-intro-2', 'voz-intro-3']);
    terminarLinea('voz-intro-2');
    expect(colaVoz.value).toHaveLength(3);
    terminarLinea('voz-intro-1');
    expect(colaVoz.value).toEqual(['voz-intro-2', 'voz-intro-3']);
  });

  it('cada línea del guion se puede decir', () => {
    for (const l of GUION) {
      reiniciarVoz();
      decir(l.id);
      expect(colaVoz.value).toEqual([l.id]);
    }
  });
});

describe('controlador: cuándo habla La Voz', () => {
  let detener: () => void;
  let ahora = 0;
  const s1 = PUZZLES[0];
  if (!s1) throw new Error('falta el puzzle de la sala 1');

  const avanzar = (ms: number): void => {
    ahora += ms;
    vi.advanceTimersByTime(ms);
  };
  const accionar = (objeto: string, accion: AccionObjeto): void => {
    enfocado.value = { id: objeto, nombre: nombreDeObjeto(objeto) ?? objeto, accion };
    enviar({ t: 'accion', objeto, accion });
  };
  const usar = (objeto: string): void => accionar(objeto, 'usar');
  /** Lo que La Voz dijo desde la última vez que se miró (y vacía la cola). */
  const oido = (): readonly string[] => {
    const cola = colaVoz.value;
    reiniciarVoz();
    return cola;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    ahora = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => ahora);
  });

  const arrancar = (almacen: Almacen | null = null): void => {
    detener = iniciarControlador({ documento: null, almacen });
  };

  afterEach(() => {
    detener();
    vi.useRealTimers();
    vi.restoreAllMocks();
    reiniciarPartida();
    reiniciarInterfaz();
    reiniciarCuaderno();
    reiniciarMecanismo();
    reiniciarVoz();
    fichas.value = {};
  });

  it('una partida nueva empieza con la presentación; el reloj de la portería, una sola vez', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(oido()).toEqual(['voz-intro-1', 'voz-intro-2']);
    accionar(OBJETO_RELOJ, 'examinar');
    expect(oido()).toEqual(['voz-intro-3']);
    accionar(OBJETO_RELOJ, 'examinar');
    expect(oido()).toEqual([]);
  });

  it('al entrar a una sala por primera vez y al ganar su sello', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    oido();
    usar('porteria-puerta-1');
    expect(oido()).toEqual(['voz-s1-entrar']);
    for (const e of s1.etapas) {
      enviar({ t: 'ajustar', estado: e.solucion });
      if (e.intento.tipo === 'accionar') enviar({ t: 'accionar', objeto: e.intento.objeto });
    }
    expect(oido()).toEqual(['voz-s1-sello']);
    usar('s1-puerta');
    usar('porteria-puerta-1');
    expect(oido()).toEqual([]);
  });

  it('una puerta cerrada no hace hablar a La Voz', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    oido();
    usar('porteria-puerta-3');
    expect(oido()).toEqual([]);
  });

  it('al tercer intento fallido de una etapa', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    usar('porteria-puerta-1');
    oido();
    const regla = s1.etapas[0]?.intento;
    if (regla?.tipo !== 'accionar') throw new Error('la etapa 1 de la sala 1 se acciona');
    enviar({ t: 'accionar', objeto: regla.objeto });
    enviar({ t: 'accionar', objeto: regla.objeto });
    expect(oido()).toEqual([]);
    enviar({ t: 'accionar', objeto: regla.objeto });
    expect(oido()).toEqual(['voz-fallo']);
    enviar({ t: 'accionar', objeto: regla.objeto });
    expect(oido()).toEqual([]);
  });

  it('tras 90 s de reloj activo sin tocar nada en la sala, una vez por etapa', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    usar('porteria-puerta-1');
    oido();
    avanzar(ESPERA_VOZ_MS - 1_000);
    // Tocar algo vuelve a empezar la espera.
    enviar({ t: 'ajustar', estado: s1.etapas[0]?.estado_inicial });
    avanzar(ESPERA_VOZ_MS - 1_000);
    expect(oido()).toEqual([]);
    avanzar(1_000);
    expect(oido()).toEqual(['voz-espera']);
    avanzar(ESPERA_VOZ_MS * 2);
    expect(oido()).toEqual([]);
  });

  it('en la portería no cuenta la espera', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    oido();
    avanzar(ESPERA_VOZ_MS * 2);
    expect(oido()).toEqual([]);
  });

  it('al continuar una partida no repite la presentación ni lo de las salas con avance', () => {
    const datos = new Map<string, string>();
    const almacen: Almacen = {
      getItem: (k) => datos.get(k) ?? null,
      setItem: (k, v) => void datos.set(k, v),
      removeItem: (k) => void datos.delete(k),
    };
    const partida = (
      [
        { t: 'entrar', sala: 's1-cooperativa' },
        { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 },
        { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 1 },
        { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 2 },
        { t: 'volver_porteria' },
      ] satisfies Accion[]
    ).reduce(aplicar, crearPartida());
    guardar(almacen, {
      v: VERSION_GUARDADO,
      partida,
      restanteMs: 30 * 60 * 1000,
      pistas: {},
      mecanismos: {},
      resueltas: {},
      notas: [],
      datos: [],
      inventario: [],
    });
    arrancar(almacen);
    enviar({ t: 'continuar' });
    expect(oido()).toEqual([]);
    usar('porteria-puerta-1');
    usar('s1-puerta');
    expect(oido()).toEqual([]);
    usar('porteria-puerta-2');
    expect(oido()).toEqual(['voz-s2-entrar']);
  });

  it('al salir al menú la cola queda vacía', () => {
    arrancar();
    enviar({ t: 'iniciar', modo: 'individual' });
    enviar({ t: 'salir' });
    expect(colaVoz.value).toEqual([]);
  });
});
