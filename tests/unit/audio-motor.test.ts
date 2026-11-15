import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearAmbiente, FONDOS } from '../../src/engine/audio/ambiente';
import {
  DURACION_MURMULLO_S,
  duracionDe,
  efectosDeResultado,
  iniciarAudio,
} from '../../src/engine/audio/audio';
import { desbloquearAlPrimerToque, GESTOS } from '../../src/engine/audio/desbloqueo';
import { sonar } from '../../src/engine/audio/eventos';
import {
  AMBIENTE_BAJO_LA_VOZ,
  crearMezcla,
  niveles,
  TECHO_AMBIENTE,
  volumenesDeAjustes,
} from '../../src/engine/audio/mezcla';
import { AJUSTES_INICIALES, ajustes } from '../../src/signals/ajustes';
import { EFECTOS, murmullo } from '../../src/engine/audio/sintesis';
import { audioDesbloqueado } from '../../src/signals/audio';

const VOLUMENES_INICIALES = volumenesDeAjustes(AJUSTES_INICIALES);
import { panel, reiniciarInterfaz } from '../../src/signals/interfaz';
import {
  reiniciarMecanismo,
  resultado,
  type ResultadoMecanismo,
} from '../../src/signals/mecanismo';
import { fase, reiniciarPartida, sala } from '../../src/signals/partida';
import { colaVoz, reiniciarVoz } from '../../src/signals/voz';

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
  it('los volúmenes de voz y ambiente salen de los ajustes del jugador (T39)', () => {
    expect(volumenesDeAjustes({ volumenVoz: 100, volumenAmbiente: 70 })).toMatchObject({
      voz: 1,
      ambiente: 0.7 * TECHO_AMBIENTE,
    });
    expect(volumenesDeAjustes({ volumenVoz: 0, volumenAmbiente: 0 })).toMatchObject({
      voz: 0,
      ambiente: 0,
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

  it('el murmullo de la voz provisional dura al menos lo pedido', () => {
    const c = contextoFalso('running');
    expect(murmullo(comoContexto(c), nodo() as unknown as AudioNode, 0, 2)).toBeGreaterThanOrEqual(
      2,
    );
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

describe('voz provisional', () => {
  it('dura lo que dice el guion, o 4 s si la línea no está', () => {
    expect(duracionDe('grab-1')).toBeGreaterThan(0);
    expect(duracionDe('no-existe')).toBe(DURACION_MURMULLO_S);
    expect(duracionDe(undefined)).toBe(DURACION_MURMULLO_S);
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
    expect(efectosDeResultado(r('s1-etiquetadora'))).toEqual(['palanca']);
    expect(efectosDeResultado(r('s3-reflector', 0))).toEqual(['clic']);
    expect(efectosDeResultado(r('s3-reflector', 2, true))).toEqual(['polea', 'sello']);
    expect(efectosDeResultado(r('s4-carritos'))).toEqual(['clic']);
    expect(efectosDeResultado(r('s5-urna', 2, true))).toEqual(['manija', 'fichas', 'sello']);
  });

  it('en los tanques el sello espera a la campana: no suena con la palanca', () => {
    expect(efectosDeResultado(r('s2-tanques', 2, true))).toEqual(['palanca']);
  });
});

describe('iniciarAudio', () => {
  it('después del primer toque suenan las máquinas, la voz provisional y lo que pide el motor', async () => {
    const documento = documentoFalso();
    const contexto = contextoFalso();
    const sonidos: string[] = [];
    const detener = iniciarAudio({
      documento,
      crear: () => comoContexto(contexto),
      alSonar: (n) => sonidos.push(n),
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
    expect(sonidos).toEqual(['palanca', 'sello']);

    panel.value = 'grabacion';
    expect(sonidos.at(-1)).toBe('voz');
    expect(DURACION_MURMULLO_S).toBeGreaterThan(0);

    sonar('mano');
    expect(sonidos.at(-1)).toBe('mano');

    // Cada subtítulo nuevo de La Voz (T34) suena con la voz provisional.
    const antes = sonidos.length;
    colaVoz.value = ['voz-s1-sello'];
    expect(sonidos.slice(antes)).toEqual(['voz']);
    colaVoz.value = ['voz-s1-sello', 'voz-final'];
    expect(sonidos.length).toBe(antes + 1);
    colaVoz.value = ['voz-final'];
    expect(sonidos.length).toBe(antes + 2);

    detener();
    expect(contexto.close).toHaveBeenCalled();
    expect(audioDesbloqueado.value).toBe(false);
    // Apagado, ya nada suena.
    sonar('clic');
    colaVoz.value = ['voz-espera'];
    expect(sonidos.length).toBe(antes + 2);
  });
});
