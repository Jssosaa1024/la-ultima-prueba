import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearAmbiente, FONDOS } from '../../src/engine/audio/ambiente';
import { efectosDeResultado, iniciarAudio, lineasDeLugar } from '../../src/engine/audio/audio';
import { desbloquearAlPrimerToque, GESTOS } from '../../src/engine/audio/desbloqueo';
import { sonar } from '../../src/engine/audio/eventos';
import {
  AMBIENTE_BAJO_LA_VOZ,
  crearMezcla,
  niveles,
  TECHO_AMBIENTE,
  TECHO_EFECTOS,
  volumenesDeAjustes,
} from '../../src/engine/audio/mezcla';
import { AJUSTES_INICIALES, ajustes } from '../../src/signals/ajustes';
import { EFECTOS, reforzado, type Efecto } from '../../src/engine/audio/sintesis';
import { audioDesbloqueado } from '../../src/signals/audio';

const VOLUMENES_INICIALES = volumenesDeAjustes(AJUSTES_INICIALES);
import { reiniciarInterfaz } from '../../src/signals/interfaz';
import {
  reiniciarMecanismo,
  resultado,
  type ResultadoMecanismo,
} from '../../src/signals/mecanismo';
import { fase, reiniciarPartida, sala } from '../../src/signals/partida';
import { lineaEnPantalla, reiniciarVoz, sonidoVoz } from '../../src/signals/voz';

// T43: módulo de audio del motor (desbloqueo en iOS, mezcla, ambiente y efectos por código).

/** Un `AudioParam` falso: guarda el último valor pedido. */
function parametro(inicial = 1) {
  const p = {
    value: inicial,
    setValueAtTime: (v: number) => ((p.value = v), p),
    exponentialRampToValueAtTime: (v: number) => ((p.value = v), p),
    linearRampToValueAtTime: (v: number) => ((p.value = v), p),
    setTargetAtTime: (v: number) => ((p.value = v), p),
    cancelScheduledValues: () => p,
  };
  return p;
}

/** Un nodo falso que acepta todo lo que los efectos le hacen. */
function nodo() {
  return {
    connect: <T>(destino: T) => destino,
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as null | (() => void),
    type: '',
    loop: false,
    buffer: null as unknown,
    frequency: parametro(440),
    gain: parametro(1),
    Q: parametro(1),
  };
}

/** Un `AudioContext` falso. Cuenta los nodos que se crean. */
function contextoFalso(estado = 'suspended') {
  const c = {
    state: estado,
    currentTime: 0,
    sampleRate: 8000,
    destination: nodo(),
    creados: 0,
    resume: vi.fn(() => {
      c.state = 'running';
      return Promise.resolve();
    }),
    suspend: vi.fn(() => {
      c.state = 'suspended';
      return Promise.resolve();
    }),
    close: vi.fn(() => Promise.resolve()),
    createBuffer: (_canales: number, largo: number) => {
      const datos = new Float32Array(largo);
      return { getChannelData: () => datos };
    },
    createOscillator: () => (c.creados++, nodo()),
    createGain: () => (c.creados++, nodo()),
    createBiquadFilter: () => (c.creados++, nodo()),
    createBufferSource: () => (c.creados++, nodo()),
    decodeAudioData: vi.fn((datos: ArrayBuffer) =>
      Promise.resolve({ duration: datos.byteLength / 1000 } as AudioBuffer),
    ),
  };
  return c;
}

/** Un documento falso: se pueden disparar gestos y ocultar la pestaña. */
function documentoFalso() {
  const oyentes = new Map<string, Set<() => void>>();
  return {
    hidden: false,
    addEventListener(tipo: string, fn: () => void) {
      if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
      oyentes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: () => void) {
      oyentes.get(tipo)?.delete(fn);
    },
    disparar(tipo: string) {
      oyentes.get(tipo)?.forEach((fn) => fn());
    },
    cuantos(tipo: string) {
      return oyentes.get(tipo)?.size ?? 0;
    },
  };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));
const comoContexto = (c: ReturnType<typeof contextoFalso>) => c as unknown as AudioContext;

afterEach(() => {
  reiniciarPartida();
  reiniciarInterfaz();
  reiniciarMecanismo();
  ajustes.value = { ...AJUSTES_INICIALES };
  reiniciarVoz();
});

describe('desbloqueo del audio', () => {
  it('no crea nada hasta el primer toque; con él, reanuda y avisa una vez', async () => {
    const documento = documentoFalso();
    const contexto = contextoFalso();
    const crear = vi.fn(() => contexto);
    const alDesbloquear = vi.fn();
    const d = desbloquearAlPrimerToque({ crear, alDesbloquear, documento });
    expect(crear).not.toHaveBeenCalled();
    for (const g of GESTOS) expect(documento.cuantos(g)).toBe(1);

    documento.disparar('touchend');
    await esperar();
    expect(crear).toHaveBeenCalledTimes(1);
    expect(contexto.resume).toHaveBeenCalled();
    expect(alDesbloquear).toHaveBeenCalledTimes(1);
    expect(d.desbloqueado).toBe(true);

    documento.disparar('click');
    await esperar();
    expect(crear).toHaveBeenCalledTimes(1);
    expect(alDesbloquear).toHaveBeenCalledTimes(1);
    d.detener();
    for (const g of GESTOS) expect(documento.cuantos(g)).toBe(0);
  });

  it('al ocultar la pestaña se suspende y al volver se reanuda', async () => {
    const documento = documentoFalso();
    const contexto = contextoFalso();
    const d = desbloquearAlPrimerToque({
      crear: () => contexto,
      alDesbloquear: vi.fn(),
      documento,
    });
    documento.disparar('touchend');
    await esperar();
    documento.hidden = true;
    documento.disparar('visibilitychange');
    expect(contexto.suspend).toHaveBeenCalled();
    documento.hidden = false;
    documento.disparar('visibilitychange');
    expect(contexto.state).toBe('running');
    d.detener();
  });

  it('sin Web Audio, el juego sigue en silencio y deja de escuchar los gestos', () => {
    const documento = documentoFalso();
    const d = desbloquearAlPrimerToque({
      crear: () => {
        throw new Error('sin AudioContext');
      },
      alDesbloquear: vi.fn(),
      documento,
    });
    expect(() => documento.disparar('touchend')).not.toThrow();
    expect(documento.cuantos('touchend')).toBe(0);
    d.detener();
  });
});

describe('mezcla', () => {
  it('los volúmenes de voz, ambiente y efectos salen de los ajustes del jugador (T39, T42c)', () => {
    expect(
      volumenesDeAjustes({ volumenVoz: 100, volumenAmbiente: 70, volumenEfectos: 100 }),
    ).toMatchObject({
      voz: 1,
      ambiente: 0.7 * TECHO_AMBIENTE,
      efectos: TECHO_EFECTOS,
    });
    expect(
      volumenesDeAjustes({ volumenVoz: 0, volumenAmbiente: 0, volumenEfectos: 50 }),
    ).toMatchObject({
      voz: 0,
      ambiente: 0,
      efectos: 0.5 * TECHO_EFECTOS,
    });
  });

  it('cada canal va por el volumen general, y el ambiente baja mientras habla La Voz', () => {
    const v = { general: 0.5, voz: 1, ambiente: 0.4, efectos: 0.8 };
    expect(niveles(v, false)).toEqual({ voz: 0.5, ambiente: 0.2, efectos: 0.4 });
    expect(niveles(v, true).ambiente).toBeCloseTo(0.2 * AMBIENTE_BAJO_LA_VOZ);
  });

  it('los volúmenes raros se limitan a 0–1', () => {
    expect(niveles({ general: 2, voz: -1, ambiente: Number.NaN, efectos: 1 }, false)).toEqual({
      voz: 0,
      ambiente: 0,
      efectos: 1,
    });
  });

  it('aplicar y hablar mueven las ganancias de los nodos', () => {
    const c = contextoFalso('running');
    const m = crearMezcla(comoContexto(c), VOLUMENES_INICIALES);
    expect(m.ambiente.gain.value).toBeCloseTo(VOLUMENES_INICIALES.ambiente);
    m.hablando(true);
    expect(m.ambiente.gain.value).toBeCloseTo(VOLUMENES_INICIALES.ambiente * AMBIENTE_BAJO_LA_VOZ);
    m.aplicar({ ...VOLUMENES_INICIALES, efectos: 0 });
    expect(m.efectos.gain.value).toBe(0);
  });
});

describe('sonidos por código', () => {
  it('cada efecto arma sus nodos y dice cuánto dura', () => {
    for (const [nombre, efecto] of Object.entries(EFECTOS)) {
      const c = contextoFalso('running');
      const dura = efecto(comoContexto(c), nodo() as unknown as AudioNode, 0);
      expect(dura, nombre).toBeGreaterThan(0);
      expect(c.creados, nombre).toBeGreaterThan(0);
    }
  });

  it('un efecto reforzado suena más fuerte por su propio nodo y lo suelta al terminar', () => {
    vi.useFakeTimers();
    try {
      const c = contextoFalso('running');
      const destino = nodo() as unknown as AudioNode;
      let recibido: unknown = null;
      const base: Efecto = (_c, d) => ((recibido = d), 0.5);
      const dura = reforzado(base, 2)(comoContexto(c), destino, 0);
      expect(dura).toBe(0.5);
      const g = recibido as ReturnType<typeof nodo>;
      expect(g).not.toBe(destino);
      expect(g.gain.value).toBe(2);
      expect(g.disconnect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1100);
      expect(g.disconnect).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('el ambiente cambia de fondo por sala y calla con null', () => {
    const c = contextoFalso('running');
    const a = crearAmbiente(comoContexto(c), nodo() as unknown as AudioNode);
    a.cambiar('porteria');
    expect(a.lugar).toBe('porteria');
    const antes = c.creados;
    a.cambiar('porteria');
    expect(c.creados).toBe(antes);
    a.cambiar('s3-gimnasio');
    expect(c.creados).toBeGreaterThan(antes);
    a.cambiar(null);
    expect(a.lugar).toBeNull();
    expect(Object.keys(FONDOS)).toHaveLength(6);
  });
});

describe('voz de cada lugar (T42b)', () => {
  it('se bajan las líneas del lugar y las de cualquier sala, sin las de los finales', () => {
    expect(lineasDeLugar('s1-cooperativa')).toEqual([
      'voz-s1-entrar',
      'voz-s1-sello',
      'voz-espera',
      'voz-fallo',
    ]);
    expect(lineasDeLugar('s2-laboratorio')).toContain('grab-1');
    const porteria = lineasDeLugar('porteria');
    expect(porteria).toContain('voz-intro-1');
    expect(porteria.some((id) => id.startsWith('voz-fin-'))).toBe(false);
  });
});

describe('qué suena cuando responde una máquina', () => {
  const r = (puzzle: string, etapa = 0, sello = false): ResultadoMecanismo => ({
    n: 1,
    sala: 's1-cooperativa',
    puzzle,
    etapa,
    estado: {},
    condiciones: {},
    resuelta: sello,
    sello,
  });

  it('palanca, polea, manija y clic según la máquina; el sello al final', () => {
    expect(efectosDeResultado(r('s1-etiquetadora'))).toEqual(['palanca', 'imprenta']);
    expect(efectosDeResultado(r('s3-reflector', 0))).toEqual(['clic']);
    expect(efectosDeResultado(r('s3-reflector', 2, true))).toEqual(['polea', 'sello']);
    expect(efectosDeResultado(r('s4-carritos'))).toEqual(['clic']);
    // T42c: con el sello de la biblioteca se abre la pared de casilleros.
    expect(efectosDeResultado(r('s4-carritos', 2, true))).toEqual(['clic', 'casilleros', 'sello']);
    expect(efectosDeResultado(r('s5-urna', 2, true))).toEqual(['manija', 'fichas', 'sello']);
  });

  it('en los tanques el sello espera a la campana: no suena con la palanca', () => {
    expect(efectosDeResultado(r('s2-tanques', 2, true))).toEqual(['palanca']);
  });
});

describe('iniciarAudio', () => {
  it('después del primer toque suenan las máquinas, la voz y lo que pide el motor', async () => {
    const documento = documentoFalso();
    const contexto = contextoFalso();
    const sonidos: string[] = [];
    const bajadas: string[] = [];
    const detener = iniciarAudio({
      documento,
      crear: () => comoContexto(contexto),
      alSonar: (n) => sonidos.push(n),
      bajarVoz: (url) => (bajadas.push(url), Promise.resolve(new ArrayBuffer(4000))),
    });
    // Antes del toque nada suena.
    sonar('mano');
    expect(sonidos).toEqual([]);
    expect(audioDesbloqueado.value).toBe(false);

    documento.disparar('touchend');
    await esperar();
    expect(audioDesbloqueado.value).toBe(true);

    fase.value = 'jugando';
    sala.value = 's1-cooperativa';
    resultado.value = {
      n: 1,
      sala: 's1-cooperativa',
      puzzle: 's1-etiquetadora',
      etapa: 2,
      estado: {},
      condiciones: {},
      resuelta: true,
      sello: true,
    };
    // Entrar a la sala jugando abre su puerta (T42c).
    expect(sonidos).toEqual(['puerta', 'palanca', 'imprenta', 'sello']);

    sonar('mano');
    expect(sonidos.at(-1)).toBe('mano');

    // La línea que muestra la interfaz (T42b) suena con su audio.
    const antes = sonidos.length;
    lineaEnPantalla.value = 'voz-s1-sello';
    expect(sonidoVoz.value).toEqual({ id: 'voz-s1-sello', estado: 'cargando' });
    await esperar();
    await esperar();
    expect(sonidos.slice(antes)).toEqual(['voz']);
    expect(sonidoVoz.value).toMatchObject({ id: 'voz-s1-sello', estado: 'sonando' });
    // Se baja de public/assets/audio/es-CO/<sala>/<id>.m4a.
    expect(bajadas).toContain('/assets/audio/es-CO/s1-cooperativa/voz-s1-sello.m4a');
    // Al entrar a la sala se bajaron de antemano sus líneas.
    expect(bajadas).toContain('/assets/audio/es-CO/compartido/voz-espera.m4a');

    detener();
    expect(contexto.close).toHaveBeenCalled();
    expect(audioDesbloqueado.value).toBe(false);
    // Apagado, ya nada suena.
    sonar('clic');
    lineaEnPantalla.value = 'voz-espera';
    await esperar();
    expect(sonidos.length).toBe(antes + 1);
  });
});
