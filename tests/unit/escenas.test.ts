import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAVE_ESCENAS_VISTAS,
  duracionDe,
  escenaPorId,
  ESCENAS,
  escribirVistas,
  leerVistas,
  orientacionHacia,
  planoEn,
  subtituloEn,
  suavizar,
  TARJETAS,
  TARJETAS_COMPLETAS,
  tiempoParaHablar,
  tomaEn,
  type Plano,
} from '../../src/content/escenas';
import { carpetaDeAudio } from '../../src/content/audio-guion';
import { lineaPorId } from '../../src/content/guion';
import { EFECTOS } from '../../src/engine/audio/sintesis';
import { iniciarControlador } from '../../src/signals/controlador';
import {
  escena,
  escenaTerminada,
  escenaVista,
  iniciarEscena,
  reiniciarEscena,
  seguirFinales,
  terminarEscena,
} from '../../src/signals/escena';
import { controlesActivos, reiniciarInterfaz } from '../../src/signals/interfaz';
import { fase, final, reiniciarPartida, reloj } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';
import { colaVoz, reiniciarVoz } from '../../src/signals/voz';

const raiz = path.resolve(__dirname, '..', '..');

/** Lo que dura un .m4a, leído de su caja `mvhd` (sin ffmpeg). */
function segundosDeM4a(ruta: string): number {
  const datos = readFileSync(ruta);
  const i = datos.indexOf('mvhd', 0, 'latin1');
  if (i < 0) throw new Error(`${ruta}: sin mvhd`);
  const version = datos.readUInt8(i + 4);
  if (version === 1) {
    return Number(datos.readBigUInt64BE(i + 28)) / datos.readUInt32BE(i + 24);
  }
  return datos.readUInt32BE(i + 20) / datos.readUInt32BE(i + 16);
}

/** Un `localStorage` en memoria. */
function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

describe('las escenas', () => {
  it('existen la intro y los tres finales con giro; pedir ayuda no tiene escena', () => {
    expect([...ESCENAS]).toEqual(['intro', 'el_legado', 'justo_a_tiempo', 'tiempo_cumplido']);
  });

  it('duran lo del guion de cámara: la intro unos 45 s y cada final unos 25 s', () => {
    expect(duracionDe(escenaPorId('intro'))).toBeGreaterThanOrEqual(38);
    expect(duracionDe(escenaPorId('intro'))).toBeLessThanOrEqual(48);
    for (const id of ['el_legado', 'justo_a_tiempo', 'tiempo_cumplido'] as const) {
      expect(duracionDe(escenaPorId(id)), id).toBeGreaterThanOrEqual(20);
      expect(duracionDe(escenaPorId(id)), id).toBeLessThanOrEqual(32);
    }
  });

  it('cada sonido es un efecto del juego y cada tarjeta existe', () => {
    for (const id of ESCENAS) {
      for (const p of escenaPorId(id).planos) {
        expect(p.dura, id).toBeGreaterThan(0);
        if (p.sonido) expect(Object.keys(EFECTOS), `${id}: ${p.sonido}`).toContain(p.sonido);
        if (p.tarjeta) expect(TARJETAS, id).toContain(p.tarjeta);
      }
    }
    for (const t of TARJETAS_COMPLETAS) expect(TARJETAS).toContain(t);
  });

  it('cada línea de La Voz está en el guion, grabada, y le alcanza el plano para sonar entera', () => {
    for (const id of ESCENAS) {
      const e = escenaPorId(id);
      e.planos.forEach((p, i) => {
        if (!p.voz) return;
        const linea = lineaPorId(p.voz);
        expect(linea, p.voz).not.toBeNull();
        if (!linea) return;
        const archivo = path.join(
          raiz,
          'public',
          'assets',
          'audio',
          'es-CO',
          carpetaDeAudio(linea.sala),
          `${linea.id}.m4a`,
        );
        const dura = segundosDeM4a(archivo);
        expect(tiempoParaHablar(e, i), `${p.voz} dura ${dura} s`).toBeGreaterThanOrEqual(dura);
      });
    }
  });

  it('la intro cuenta el caso sin decir quién es el estudiante', () => {
    const intro = escenaPorId('intro');
    const textos = intro.planos.flatMap((p) => [
      p.texto ?? '',
      p.efrainDice ?? '',
      p.voz ? (lineaPorId(p.voz)?.texto ?? '') : '',
    ]);
    for (const t of textos) expect(t).not.toMatch(/Efraín|Cárdenas|celador/i);
    expect(intro.planos.some((p) => p.efrain)).toBe(false);
    expect(intro.planos.some((p) => p.tarjeta === 'foto-legado')).toBe(false);
    // El nombre completo solo sale en «El legado».
    for (const id of ['justo_a_tiempo', 'tiempo_cumplido'] as const) {
      expect(escenaPorId(id).planos.some((p) => p.tarjeta === 'foto-legado')).toBe(false);
    }
  });

  it('la intro termina donde empieza la partida, mirando a la salida', () => {
    const intro = escenaPorId('intro');
    const ultimo = intro.planos[intro.planos.length - 1] as Plano;
    const toma = tomaEn(ultimo, 1, false);
    expect(toma.pos).toEqual([0, 1.6, 4.2]);
    const o = orientacionHacia(toma.pos, toma.mira);
    expect(o.yaw).toBeCloseTo(0, 5);
    expect(o.pitch).toBeCloseTo(-0.12, 5);
  });

  it('los finales con Don Efraín lo dejan en la portería, sin atravesar paredes', () => {
    for (const id of ESCENAS) {
      for (const p of escenaPorId(id).planos) {
        for (const t of [p.desde, p.hasta]) {
          if (!t) continue;
          expect(Math.abs(t.pos[0]), id).toBeLessThan(2.9);
          expect(Math.abs(t.pos[2]), id).toBeLessThan(4.9);
        }
        if (p.efrain) {
          expect(Math.abs(p.efrain.x), id).toBeLessThan(2.8);
          expect(Math.abs(p.efrain.z), id).toBeLessThan(4.8);
        }
      }
    }
  });
});

describe('el reloj de una escena', () => {
  const e = escenaPorId('el_legado');

  it('planoEn dice el plano, su inicio y cuánto lleva; al terminar, null', () => {
    expect(planoEn(e, 0)).toMatchObject({ indice: 0, inicio: 0, avance: 0 });
    const primero = e.planos[0] as Plano;
    expect(planoEn(e, primero.dura)).toMatchObject({ indice: 1, inicio: primero.dura });
    expect(planoEn(e, primero.dura / 2)?.avance).toBeCloseTo(0.5);
    expect(planoEn(e, duracionDe(e))).toBeNull();
  });

  it('la cámara se mueve suave; con movimiento reducido, corte seco a la toma final', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.5)).toBe(0.5);
    const p = e.planos[0] as Plano;
    expect(tomaEn(p, 0, false).pos).toEqual(p.desde.pos);
    expect(tomaEn(p, 0, true)).toEqual(p.hasta);
    expect(tomaEn(p, 1, false).pos).toEqual(p.hasta?.pos);
  });

  it('el subtítulo sigue aunque cambie el plano, cambia con la línea siguiente y se va al final', () => {
    const inicioVoz = (e.planos[0] as Plano).dura + (e.planos[1] as Plano).dura;
    expect(subtituloEn(e, 1, lineaPorId)).toBeNull();
    const voz = subtituloEn(e, inicioVoz + 0.1, lineaPorId);
    expect(voz).toMatchObject({ quien: 'voz', id: 'voz-fin-legado', desde: inicioVoz });
    const efrain = subtituloEn(e, inicioVoz + (e.planos[2] as Plano).dura + 0.1, lineaPorId);
    expect(efrain).toMatchObject({ quien: 'efrain', texto: 'Ese era yo.' });
    expect(subtituloEn(e, duracionDe(e), lineaPorId)).toBeNull();
  });

  it('orientacionHacia: yaw 0 mira hacia −Z, como la cámara del jugador', () => {
    expect(orientacionHacia([0, 1, 0], [0, 1, -5]).yaw).toBeCloseTo(0);
    expect(orientacionHacia([0, 1, 0], [-5, 1, 0]).yaw).toBeCloseTo(Math.PI / 2);
    expect(orientacionHacia([0, 1, 0], [0, 2, -1]).pitch).toBeCloseTo(Math.PI / 4);
  });
});

describe('escenas vistas', () => {
  it('solo se aceptan ids conocidos de lo guardado', () => {
    expect([...leerVistas('intro,el_legado,<script>,intro')]).toEqual(['intro', 'el_legado']);
    expect(leerVistas(null).size).toBe(0);
    expect(leerVistas('x'.repeat(500)).size).toBe(0);
    expect(escribirVistas(new Set(['tiempo_cumplido', 'intro']))).toBe('intro,tiempo_cumplido');
  });
});

describe('signals de la escena', () => {
  beforeEach(() => {
    reiniciarEscena();
    reiniciarPartida();
  });

  it('iniciar la anota como vista; terminar dice cuál fue y cómo', () => {
    const almacen = almacenFalso();
    iniciarEscena('el_legado', almacen);
    expect(escena.value?.id).toBe('el_legado');
    expect(escenaVista('el_legado', almacen)).toBe(true);
    expect(almacen.getItem(CLAVE_ESCENAS_VISTAS)).toBe('el_legado');
    // Con una en curso no empieza otra.
    iniciarEscena('intro', almacen);
    expect(escena.value?.id).toBe('el_legado');
    terminarEscena('saltada');
    expect(escena.value).toBeNull();
    expect(escenaTerminada.value).toEqual({ id: 'el_legado', como: 'saltada' });
  });

  it('un almacén que falla no rompe nada', () => {
    const roto = {
      getItem: () => {
        throw new Error('sin permiso');
      },
      setItem: () => {
        throw new Error('lleno');
      },
    };
    expect(escenaVista('intro', roto)).toBe(false);
    iniciarEscena('intro', roto);
    expect(escena.value?.id).toBe('intro');
  });

  it('al llegar a un final con escena, empieza sola una vez; pedir ayuda no tiene', () => {
    const almacen = almacenFalso();
    const dejar = seguirFinales(almacen);
    final.value = 'pedir_ayuda';
    fase.value = 'final';
    expect(escena.value).toBeNull();
    reiniciarPartida();
    final.value = 'tiempo_cumplido';
    fase.value = 'final';
    expect(escena.value?.id).toBe('tiempo_cumplido');
    terminarEscena('fin');
    // Otra partida con el mismo final: ya se vio en este equipo.
    reiniciarPartida();
    final.value = 'tiempo_cumplido';
    fase.value = 'final';
    expect(escena.value).toBeNull();
    dejar();
  });
});

describe('la intro en la partida', () => {
  let detener: () => void = () => undefined;
  let ahora = 1_000;

  beforeEach(() => {
    vi.useFakeTimers();
    ahora = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    reiniciarEscena();
    reiniciarPartida();
    reiniciarInterfaz();
    reiniciarVoz();
  });

  afterEach(() => {
    detener();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('la primera vez: la intro, con el reloj quieto y sin controles; luego La Voz se presenta', () => {
    const almacen = almacenFalso();
    detener = iniciarControlador({ documento: null, almacen, escenas: true });
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(fase.value).toBe('jugando');
    expect(escena.value?.id).toBe('intro');
    expect(reloj.value.pausado).toBe(true);
    expect(controlesActivos.value).toBe(false);
    expect(colaVoz.value).toEqual([]);

    ahora += 5_000;
    terminarEscena('saltada');
    expect(reloj.value.pausado).toBe(false);
    expect(controlesActivos.value).toBe(true);
    expect(colaVoz.value).toEqual(['voz-intro-1', 'voz-intro-2']);
  });

  it('si ya se vio en este equipo, la partida empieza directo', () => {
    const almacen = almacenFalso({ [CLAVE_ESCENAS_VISTAS]: 'intro' });
    detener = iniciarControlador({ documento: null, almacen, escenas: true });
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(escena.value).toBeNull();
    expect(reloj.value.pausado).toBe(false);
    expect(colaVoz.value).toEqual(['voz-intro-1', 'voz-intro-2']);
  });

  it('salir durante la intro la quita', () => {
    detener = iniciarControlador({ documento: null, almacen: almacenFalso(), escenas: true });
    enviar({ t: 'iniciar', modo: 'individual' });
    expect(escena.value?.id).toBe('intro');
    enviar({ t: 'salir' });
    expect(escena.value).toBeNull();
    expect(fase.value).toBe('inicio');
  });
});
