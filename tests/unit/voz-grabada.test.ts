import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archivoDeAudio, carpetaDeAudio, urlDeAudio } from '../../src/content/audio-guion';
import { GUION } from '../../src/content/guion';
import { crearVoz, type ContextoVoz } from '../../src/engine/audio/voz';
import {
  COLA_SUBTITULO_MS,
  ESPERA_CARGA_MS,
  lineaEnPantalla,
  mostrarLinea,
  msDeSubtitulo,
  ocultarLinea,
  reiniciarVoz,
  sonidoVoz,
} from '../../src/signals/voz';
import { mensajeDeError } from '../../scripts/voz/elevenlabs.ts';
import {
  caracteres,
  cuerpoPedido,
  idsDesconocidos,
  leerConfig,
  lineasQueNoCuadran,
  nombreMuestra,
  palabras,
  pedidoDeLinea,
  pendientes,
  planDeTier,
  rutaOriginal,
  type ConfigVoz,
} from '../../scripts/voz/plan.ts';

// T42b: la voz de La Voz (script `npm run voz`, archivos publicados y reproducción).

const raiz = path.join(import.meta.dirname, '..', '..');
const esperar = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => reiniciarVoz());

const CONFIG = JSON.parse(
  readFileSync(path.join(raiz, 'art', 'audio', 'voz', 'voz.json'), 'utf8'),
) as unknown;

describe('npm run voz: qué genera y cuánto gasta', () => {
  const guion = [
    { id: 'voz-a', texto: 'Hola.' },
    { id: 'voz-b', texto: 'Cinco salas.' },
    { id: 'grab-1', texto: 'Año ñ' },
  ];

  it('salta las líneas que ya existen, salvo con --forzar', () => {
    const existe = (id: string) => id === 'voz-a';
    const p = pendientes(guion, existe);
    expect(p.generar.map((l) => l.id)).toEqual(['voz-b', 'grab-1']);
    expect(p.saltadas).toEqual(['voz-a']);
    expect(p.total).toBe(12 + 5);
    expect(pendientes(guion, existe, { forzar: true }).generar).toHaveLength(3);
  });

  it('con --solo genera solo esas, y avisa de los ids que no existen', () => {
    const p = pendientes(guion, () => false, { solo: ['grab-1'] });
    expect(p.generar.map((l) => l.id)).toEqual(['grab-1']);
    expect(idsDesconocidos(guion, ['grab-1', 'voz-zzz'])).toEqual(['voz-zzz']);
  });

  it('cuenta caracteres, no bytes (las tildes y la ñ cuentan uno)', () => {
    expect(caracteres('Año ñ')).toBe(5);
    const total = GUION.reduce((s, l) => s + caracteres(l.texto), 0);
    expect(total).toBeGreaterThan(1000);
  });

  it('el id solo sirve de nombre de archivo si es seguro', () => {
    expect(rutaOriginal('voz-intro-1', 'o')).toBe(path.join('o', 'voz-intro-1.mp3'));
    expect(rutaOriginal('../clave', 'o')).toBeNull();
    expect(rutaOriginal('Voz', 'o')).toBeNull();
  });

  it('nombra las muestras con el orden y el nombre corto de la voz', () => {
    expect(nombreMuestra('voz-intro-1', 2, 'Salvatore - Conversations & Storyteller')).toBe(
      'voz-intro-1--2-salvatore-conversations-storyteller.mp3',
    );
    expect(nombreMuestra('voz-intro-1', 1, 'El Faraón 2 - Abuelo')).toBe(
      'voz-intro-1--1-el-faraon-2.mp3',
    );
  });

  it('la configuración del repo es válida y ya tiene voz elegida', () => {
    const c = leerConfig(CONFIG);
    expect(Array.isArray(c), JSON.stringify(c)).toBe(false);
    const config = c as ConfigVoz;
    expect(config.modelo).toBe('eleven_multilingual_v2');
    expect(config.candidatas.map((v) => v.voice_id)).toContain(config.elegida);
    expect(JSON.stringify(CONFIG)).not.toMatch(/sk_|xi-api-key|api_key/i);
  });

  it('rechaza configuraciones mal hechas', () => {
    expect(leerConfig(null)).toEqual(['voz.json no es un objeto']);
    const mala = leerConfig({ ...(CONFIG as object), elegida: '../x', modelo: 'gpt' });
    expect(Array.isArray(mala) && mala.length).toBe(2);
  });

  it('el pedido lleva el texto, el modelo, los ajustes y la semilla, nada más', () => {
    const config = leerConfig(CONFIG) as ConfigVoz;
    expect(Object.keys(cuerpoPedido('Hola', config)).sort()).toEqual(
      ['model_id', 'seed', 'text', 'voice_settings'].sort(),
    );
  });

  it('una línea puede llevar su propio modelo, ajustes y texto con marcas', () => {
    const config = leerConfig(CONFIG) as ConfigVoz;
    const linea = { id: 'voz-x', texto: 'Llegas tarde, como siempre.' };
    const propia: ConfigVoz = {
      ...config,
      lineas: {
        'voz-x': {
          modelo: 'eleven_v3',
          texto_voz: '[dryly] Llegas tarde... como siempre.',
          ajustes: { style: 0 },
        },
      },
    };
    const p = pedidoDeLinea(linea, propia);
    expect(p.texto).toBe('[dryly] Llegas tarde... como siempre.');
    expect(p.cuerpo).toMatchObject({
      model_id: 'eleven_v3',
      seed: config.semilla,
      voice_settings: { ...config.ajustes, style: 0 },
    });
    // Sin ajustes propios, la línea va con los de todas.
    expect(pedidoDeLinea(linea, config).cuerpo).toEqual(cuerpoPedido(linea.texto, config));
  });

  it('el texto de voz dice las mismas palabras que el subtítulo', () => {
    expect(palabras('[dryly] Buenas noches. Llegas tarde... [sarcastic] como siempre')).toEqual([
      'buenas',
      'noches',
      'llegas',
      'tarde',
      'como',
      'siempre',
    ]);
    const config = leerConfig(CONFIG) as ConfigVoz;
    expect(lineasQueNoCuadran(config, GUION)).toEqual([]);
    const otra: ConfigVoz = {
      ...config,
      lineas: { 'voz-intro-1': { texto_voz: 'Buenas tardes.' }, 'voz-no-existe': {} },
    };
    expect(lineasQueNoCuadran(otra, GUION)).toEqual(['voz-intro-1', 'voz-no-existe']);
  });

  it('la bienvenida va con el modelo v3 (decisión de Alex)', () => {
    const config = leerConfig(CONFIG) as ConfigVoz;
    expect(config.lineas?.['voz-intro-1']?.modelo).toBe('eleven_v3');
  });

  it('rechaza ajustes de línea mal hechos', () => {
    const base = CONFIG as object;
    const mala = leerConfig({
      ...base,
      lineas: {
        '../x': {},
        'voz-a': { modelo: 'gpt', ajustes: { speed: 3 }, texto_voz: '', otra: 1 },
      },
    });
    expect(Array.isArray(mala) && mala.length).toBe(5);
  });

  it('solo el plan «free» es gratis', () => {
    expect(planDeTier('free')).toBe('gratis');
    expect(planDeTier('creator')).toBe('pago');
    expect(planDeTier('starter')).toBe('pago');
  });

  it('de los errores de la API muestra el código y el mensaje, nada más', () => {
    const cuerpo = JSON.stringify({ detail: { status: 'x', message: 'Falta permiso' } });
    expect(mensajeDeError(401, cuerpo)).toBe('HTTP 401: Falta permiso');
    expect(mensajeDeError(500, '<html>')).toBe('HTTP 500');
  });
});

describe('dónde se publica la voz', () => {
  it('cada línea va a la carpeta de su sala; las de cualquier sala, a compartido', () => {
    expect(carpetaDeAudio('cualquiera')).toBe('compartido');
    expect(archivoDeAudio({ id: 'voz-intro-1', sala: 'porteria' })).toBe(
      'porteria/voz-intro-1.m4a',
    );
    expect(urlDeAudio({ id: 'voz-espera', sala: 'cualquiera' })).toBe(
      '/assets/audio/es-CO/compartido/voz-espera.m4a',
    );
    expect(urlDeAudio({ id: '../x', sala: 'porteria' })).toBeNull();
  });

  it('cada línea del guion tiene su .m4a publicado y su original', () => {
    for (const l of GUION) {
      const archivo = archivoDeAudio(l);
      expect(archivo, l.id).not.toBeNull();
      const publicado = path.join(raiz, 'public', 'assets', 'audio', 'es-CO', archivo ?? '');
      expect(existsSync(publicado), publicado).toBe(true);
      expect(existsSync(path.join(raiz, rutaOriginal(l.id) ?? '')), l.id).toBe(true);
    }
  });
});

describe('la línea en pantalla', () => {
  it('mostrar anota la línea; ocultar solo la quita si sigue siendo esa', () => {
    mostrarLinea('voz-intro-1');
    expect(lineaEnPantalla.value).toBe('voz-intro-1');
    ocultarLinea('voz-intro-2');
    expect(lineaEnPantalla.value).toBe('voz-intro-1');
    ocultarLinea('voz-intro-1');
    expect(lineaEnPantalla.value).toBeNull();
    mostrarLinea('no-existe');
    expect(lineaEnPantalla.value).toBeNull();
  });

  it('el subtítulo sigue al audio; sin audio, su duración estimada', () => {
    const sonando = { id: 'a', estado: 'sonando' as const, terminaEn: 5000 };
    expect(msDeSubtitulo('a', 4, sonando, true, 1000)).toBe(4000 + COLA_SUBTITULO_MS);
    expect(msDeSubtitulo('a', 4, { id: 'a', estado: 'sin-audio' }, true, 0)).toBe(4000);
    expect(msDeSubtitulo('a', 4, { id: 'a', estado: 'cargando' }, true, 0)).toBe(
      4000 + ESPERA_CARGA_MS,
    );
    // Sin el primer toque no hay audio que esperar.
    expect(msDeSubtitulo('a', 4, null, false, 0)).toBe(4000);
    // El estado de otra línea no cuenta.
    expect(msDeSubtitulo('a', 4, { ...sonando, id: 'b' }, false, 0)).toBe(4000);
  });
});

/** Un contexto falso: cada fuente queda guardada para poder terminarla. */
function contextoFalso(decodifica = true) {
  const fuentes: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: null | (() => void);
    buffer: unknown;
  }[] = [];
  const c: ContextoVoz = {
    createBufferSource: () => {
      const f = {
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null as null | (() => void),
        buffer: null as unknown,
      };
      fuentes.push(f);
      return f as unknown as AudioBufferSourceNode;
    },
    decodeAudioData: (datos) =>
      decodifica
        ? Promise.resolve({ duration: datos.byteLength / 1000 } as AudioBuffer)
        : Promise.reject(new Error('códec')),
  };
  return { c, fuentes };
}

describe('crearVoz', () => {
  const destino = {} as AudioNode;

  it('baja, decodifica y hace sonar la línea, y cuenta cuándo termina', async () => {
    const { c, fuentes } = contextoFalso();
    const alEmpezar = vi.fn();
    const alTerminar = vi.fn();
    const bajar = vi.fn(() => Promise.resolve(new ArrayBuffer(3000)));
    const voz = crearVoz({ contexto: c, destino, bajar, ahora: () => 100, alEmpezar, alTerminar });
    voz.decir('voz-intro-1');
    expect(sonidoVoz.value).toEqual({ id: 'voz-intro-1', estado: 'cargando' });
    await esperar();
    await esperar();
    expect(bajar).toHaveBeenCalledWith('/assets/audio/es-CO/porteria/voz-intro-1.m4a');
    expect(fuentes[0]?.start).toHaveBeenCalled();
    expect(sonidoVoz.value).toEqual({ id: 'voz-intro-1', estado: 'sonando', terminaEn: 3100 });
    expect(alEmpezar).toHaveBeenCalledWith('voz-intro-1');
    fuentes[0]?.onended?.();
    expect(alTerminar).toHaveBeenCalledTimes(1);

    // La segunda vez no se vuelve a bajar.
    voz.decir('voz-intro-1');
    await esperar();
    await esperar();
    expect(bajar).toHaveBeenCalledTimes(1);
    expect(fuentes).toHaveLength(2);
  });

  it('si el audio no carga o no se decodifica, avisa «sin-audio»', async () => {
    const sinRed = crearVoz({
      contexto: contextoFalso().c,
      destino,
      bajar: () => Promise.reject(new Error('sin red')),
    });
    sinRed.decir('voz-fallo');
    await esperar();
    await esperar();
    expect(sonidoVoz.value).toEqual({ id: 'voz-fallo', estado: 'sin-audio' });

    const { c, fuentes } = contextoFalso(false);
    const sinCodec = crearVoz({
      contexto: c,
      destino,
      bajar: () => Promise.resolve(new ArrayBuffer(10)),
    });
    sinCodec.decir('voz-espera');
    await esperar();
    await esperar();
    expect(sonidoVoz.value).toEqual({ id: 'voz-espera', estado: 'sin-audio' });
    expect(fuentes).toHaveLength(0);
  });

  it('una línea nueva calla la anterior, y lo que llega tarde se descarta', async () => {
    const { c, fuentes } = contextoFalso();
    let soltar: (b: ArrayBuffer) => void = () => undefined;
    const lenta = new Promise<ArrayBuffer>((r) => (soltar = r));
    const voz = crearVoz({
      contexto: c,
      destino,
      bajar: (url) => (url.includes('intro-1') ? lenta : Promise.resolve(new ArrayBuffer(2000))),
    });
    voz.decir('voz-intro-1');
    voz.decir('voz-intro-2');
    await esperar();
    await esperar();
    expect(sonidoVoz.value).toMatchObject({ id: 'voz-intro-2', estado: 'sonando' });
    soltar(new ArrayBuffer(1000));
    await esperar();
    await esperar();
    // La primera llegó tarde: no suena encima de la segunda.
    expect(fuentes).toHaveLength(1);
    expect(sonidoVoz.value).toMatchObject({ id: 'voz-intro-2' });

    voz.callar();
    expect(fuentes[0]?.stop).toHaveBeenCalled();
    voz.detener();
    voz.decir('voz-intro-3');
    await esperar();
    expect(fuentes).toHaveLength(1);
  });

  it('precarga baja sin decodificar ni sonar', async () => {
    const { c, fuentes } = contextoFalso();
    const bajar = vi.fn(() => Promise.resolve(new ArrayBuffer(10)));
    const voz = crearVoz({ contexto: c, destino, bajar });
    voz.precargar(['voz-s1-entrar', 'voz-s1-sello']);
    await esperar();
    expect(bajar).toHaveBeenCalledTimes(2);
    expect(fuentes).toHaveLength(0);
  });
});
