import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  archivoDeEfecto,
  EFECTOS_GRABADOS,
  esEfectoGrabado,
  urlDeEfecto,
} from '../../src/content/audio-efectos';
import { IDIOMA_AUDIO } from '../../src/content/audio-guion';
import {
  crearEfectosGrabados,
  NIVEL_GRABADO_DB,
  NIVEL_MAXIMO_DB,
  type ContextoGrabados,
} from '../../src/engine/audio/grabados';
import { EFECTOS } from '../../src/engine/audio/sintesis';
import {
  cumpleEfecto,
  esArchivoDeEfecto,
  gananciaDeEfecto,
  PICO_EFECTOS_DBTP,
} from '../../scripts/audio/sonoridad.ts';
import {
  ARCHIVO_CONFIG,
  cuerpoPedido,
  efectoDeOriginal,
  leerConfig,
  pendientes,
  rutaOriginal,
  type ConfigEfectos,
} from '../../scripts/efectos/plan.ts';

// T42c: efectos de sonido grabados con ElevenLabs (script, archivos publicados y reproducción).

describe('la lista de efectos grabados', () => {
  it('cada uno reemplaza a un efecto hecho con código y tiene su nivel', () => {
    for (const n of EFECTOS_GRABADOS) {
      expect(EFECTOS, n).toHaveProperty(n);
      expect(NIVEL_GRABADO_DB[n], n).toBeLessThanOrEqual(NIVEL_MAXIMO_DB);
    }
    // El clic, el bip y el sello son señales del juego: siguen hechos con código.
    for (const n of ['clic', 'bip', 'sello']) expect(esEfectoGrabado(n)).toBe(false);
  });

  it('se publica en compartido/ con el idioma del audio, y cada archivo existe con su crédito', () => {
    expect(urlDeEfecto('puerta')).toBe(
      `/assets/audio/${IDIOMA_AUDIO}/compartido/efecto-puerta.m4a`,
    );
    const creditos = JSON.parse(readFileSync('art/credits.json', 'utf8')) as {
      archivo: string;
      fuente: string;
      plan?: string;
    }[];
    for (const n of EFECTOS_GRABADOS) {
      const archivo = path.posix.join('public/assets/audio', IDIOMA_AUDIO, archivoDeEfecto(n));
      expect(existsSync(archivo), archivo).toBe(true);
      const c = creditos.find((x) => x.archivo === archivo);
      expect(c?.fuente, archivo).toBe('elevenlabs');
      expect(c?.plan, archivo).toBe('pago');
    }
  });
});

describe('npm run efectos', () => {
  it('la configuración del repositorio es válida y describe todos los efectos', () => {
    const config = leerConfig(JSON.parse(readFileSync(ARCHIVO_CONFIG, 'utf8')));
    expect(config).not.toBeInstanceOf(Array);
    const c = config as ConfigEfectos;
    expect(Object.keys(c.efectos).sort()).toEqual([...EFECTOS_GRABADOS].sort());
    expect(cuerpoPedido(c.efectos.puerta, c)).toEqual({
      text: c.efectos.puerta.texto,
      duration_seconds: c.efectos.puerta.duracion,
      prompt_influence: c.influencia,
      model_id: c.modelo,
    });
  });

  it('rechaza una configuración incompleta o con efectos que no existen', () => {
    const problemas = leerConfig({
      modelo: 'eleven_text_to_sound_v2',
      formato: 'mp3_44100_128',
      influencia: 2,
      efectos: { puerta: { texto: 'corto', duracion: 0.1 }, trueno: { texto: 'x', duracion: 1 } },
    });
    expect(problemas).toBeInstanceOf(Array);
    const texto = (problemas as string[]).join('\n');
    expect(texto).toContain('influencia');
    expect(texto).toContain('«trueno» no está');
    expect(texto).toContain('falta la descripción de «clac»');
    expect(texto).toContain('«puerta»: la duración');
  });

  it('genera solo lo que falta, o lo pedido; y reconoce los originales', () => {
    const hay = new Set(['puerta']);
    const p = pendientes((n) => hay.has(n), { forzar: false, solo: [] });
    expect(p.generar).not.toContain('puerta');
    expect(p.saltados).toEqual(['puerta']);
    const solo = pendientes(() => true, { forzar: true, solo: ['clac', 'trueno'] });
    expect(solo.generar).toEqual(['clac']);
    expect(solo.desconocidos).toEqual(['trueno']);
    expect(rutaOriginal('clac')).toBe(
      path.join('art', 'audio', 'efectos', 'originales', 'clac.mp3'),
    );
    expect(efectoDeOriginal('puerta-cerrada.mp3')).toBe('puerta-cerrada');
    expect(efectoDeOriginal('trueno.mp3')).toBeNull();
    expect(efectoDeOriginal('puerta.wav')).toBeNull();
  });
});

describe('el volumen de los efectos (por pico)', () => {
  it('sube o baja hasta el pico, sin pasar de −16 LUFS', () => {
    expect(gananciaDeEfecto({ lufs: -30, picoDbtp: -8 })).toBe(PICO_EFECTOS_DBTP + 8);
    // Un zumbido largo llegaría a −10 LUFS con el pico a −2: se baja hasta −16.
    expect(gananciaDeEfecto({ lufs: -11, picoDbtp: -6 })).toBe(-5);
  });

  it('check-audio acepta un efecto con su pico y rechaza uno que satura, suena fuerte o quedó bajito', () => {
    expect(cumpleEfecto({ lufs: -24, picoDbtp: -2 })).toBe(true);
    expect(cumpleEfecto({ lufs: -16, picoDbtp: -5.6 })).toBe(true);
    expect(cumpleEfecto({ lufs: -20, picoDbtp: -1 })).toBe(false);
    expect(cumpleEfecto({ lufs: -13, picoDbtp: -2 })).toBe(false);
    expect(cumpleEfecto({ lufs: -30, picoDbtp: -6 })).toBe(false);
    expect(esArchivoDeEfecto('public/assets/audio/es-CO/compartido/efecto-puerta.m4a')).toBe(true);
    expect(esArchivoDeEfecto('public/assets/audio/es-CO/compartido/voz-espera.m4a')).toBe(false);
  });
});

/** Un contexto falso que guarda las fuentes que se tocan. */
function contextoFalso() {
  const fuentes: { buffer: unknown; start: ReturnType<typeof vi.fn>; ganancia: number }[] = [];
  let ultimaGanancia = 1;
  const contexto = {
    createGain: () => {
      const g = {
        gain: {
          set value(v: number) {
            ultimaGanancia = v;
          },
        },
        connect: (d: unknown) => d,
        disconnect: vi.fn(),
      };
      return g;
    },
    createBufferSource: () => {
      const f = {
        buffer: null as unknown,
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as null | (() => void),
        connect: (d: unknown) => d,
      };
      fuentes.push({
        get buffer() {
          return f.buffer;
        },
        start: f.start,
        get ganancia() {
          return ultimaGanancia;
        },
      });
      return f;
    },
    decodeAudioData: (datos: ArrayBuffer) =>
      Promise.resolve({ duration: datos.byteLength } as unknown as AudioBuffer),
  };
  return { contexto: contexto as unknown as ContextoGrabados, fuentes };
}

describe('crearEfectosGrabados', () => {
  it('baja todos los efectos y toca el grabado cuando ya llegó, a su nivel', async () => {
    const { contexto, fuentes } = contextoFalso();
    const pedidos: string[] = [];
    const g = crearEfectosGrabados({
      contexto,
      destino: {} as AudioNode,
      bajar: (url) => (pedidos.push(url), Promise.resolve(new ArrayBuffer(8))),
    });
    expect(pedidos).toEqual(EFECTOS_GRABADOS.map((n) => urlDeEfecto(n)));
    // Antes de decodificar, suena el de código.
    expect(g.tocar('puerta', 0)).toBe(false);
    await vi.waitFor(() => expect(g.listos).toBe(EFECTOS_GRABADOS.length));
    expect(g.tocar('puerta', 1.5)).toBe(true);
    expect(fuentes).toHaveLength(1);
    expect(fuentes[0]?.start).toHaveBeenCalledWith(1.5);
    expect(fuentes[0]?.ganancia).toBeCloseTo(10 ** (NIVEL_GRABADO_DB.puerta / 20));
    // Lo que no es grabado sigue con el de código.
    expect(g.tocar('sello', 0)).toBe(false);
    g.detener();
    expect(g.tocar('puerta', 0)).toBe(false);
  });

  it('si un archivo no carga, ese efecto sigue con el de código', async () => {
    const { contexto } = contextoFalso();
    const g = crearEfectosGrabados({
      contexto,
      destino: {} as AudioNode,
      bajar: (url) =>
        url.endsWith('efecto-puerta.m4a')
          ? Promise.reject(new Error('HTTP 404'))
          : Promise.resolve(new ArrayBuffer(8)),
    });
    await vi.waitFor(() => expect(g.listos).toBe(EFECTOS_GRABADOS.length - 1));
    expect(g.tocar('puerta', 0)).toBe(false);
    expect(g.tocar('clac', 0)).toBe(true);
  });
});
