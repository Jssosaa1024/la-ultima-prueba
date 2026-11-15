/**
 * Prueba de carga del cooperativo (T92): partidas simuladas en la red en memoria, con el
 * anfitrión, los clientes y el emisor de poses de verdad, para contar cuántos eventos por
 * segundo le cobraría Supabase Realtime y compararlos con los límites de cada plan
 * (especificación, «Costo frente a los límites de Supabase»).
 *
 * Supabase cuenta un evento por cada mensaje enviado y uno por cada entrega. El canal usa
 * `self: true`, así que cada mensaje también se entrega a quien lo envía: con 4 jugadores, un
 * mensaje cuesta 1 + 4 = 5 eventos. La especificación estima 4 (sin la entrega propia); el
 * informe da las dos cuentas.
 *
 * Este módulo importa código de `src/` sin extensiones: lo carga `scripts/prueba-carga.ts`
 * con el cargador de Vite, y Vitest lo prueba directo.
 */
import { crearEmisorPoses, POSES_POR_SEGUNDO, yawACentesimas } from '../../src/engine/coop/poses';
import { ClienteCoop } from '../../src/net/cliente';
import { RedEnMemoria } from '../../src/net/memoria';
import {
  ALFABETO_CODIGO,
  ALIAS,
  COLORES,
  VERSION_CONTENIDO,
  directo,
  type Canal,
  type Identidad,
  type SobreDe,
} from '../../src/net/protocolo';
import type { Transporte } from '../../src/net/transporte';

/** Límites de Supabase Realtime por plan (consultados el 5 de noviembre de 2026). */
export const PLANES = [
  { plan: 'Free', eventosPorSegundo: 100, conexiones: 200 },
  { plan: 'Pro', eventosPorSegundo: 500, conexiones: 500 },
  { plan: 'Pro sin tope de gasto', eventosPorSegundo: 2500, conexiones: 10_000 },
] as const;

export interface Escenario {
  partidas: number;
  jugadores: number;
  /** Segundos simulados. */
  segundos: number;
  /** Fracción del tiempo que cada jugador camina (la especificación supone la mitad). */
  fraccionMoviendose: number;
  /** Señales por jugador y minuto (frases rápidas). */
  senalesPorMinuto: number;
  /** Poses por segundo en movimiento; por defecto, las del juego (`POSES_POR_SEGUNDO`). */
  hz: number;
  semilla: number;
}

export const ESCENARIO_BASE: Escenario = {
  partidas: 2,
  jugadores: 4,
  segundos: 120,
  fraccionMoviendose: 0.5,
  senalesPorMinuto: 2,
  hz: POSES_POR_SEGUNDO,
  semilla: 1,
};

export interface Resultado {
  escenario: Escenario;
  /** Mensajes enviados por canal en todo el tiempo medido. */
  mensajes: Record<Canal, number>;
  /** Eventos que cobra Supabase (envío + entregas, con la propia). */
  eventosPorSegundo: { promedio: number; pico: number };
  /** La cuenta de la especificación: sin la entrega a uno mismo. */
  eventosPorSegundoSinPropia: { promedio: number; pico: number };
  conexiones: number;
  planes: { plan: string; cabe: boolean; uso: number }[];
}

/** Azar con semilla, para que cada corrida dé lo mismo. */
function azar(semilla: number): () => number {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Envuelve un transporte para contar cada mensaje que sale, con su hora. */
class Contador {
  readonly porSegundo = new Map<number, { con: number; sin: number }>();
  readonly mensajes: Record<Canal, number> = { int: 0, evt: 0, dir: 0 };
  medir = false;

  constructor(private readonly ahora: () => number) {}

  envolver(t: Transporte, enSala: () => number): Transporte {
    return {
      unirse: (codigo, identidad) => t.unirse(codigo, identidad),
      enviar: async <C extends Canal>(canal: C, mensaje: SobreDe<C>) => {
        // La hora y si se mide, al llamar: la promesa se resuelve después del cuadro.
        const medir = this.medir;
        const s = Math.floor(this.ahora() / 1000);
        const ok = await t.enviar(canal, mensaje);
        if (ok && medir) {
          const n = enSala();
          const fila = this.porSegundo.get(s) ?? { con: 0, sin: 0 };
          fila.con += 1 + n;
          fila.sin += 1 + Math.max(0, n - 1);
          this.porSegundo.set(s, fila);
          this.mensajes[canal]++;
        }
        return ok;
      },
      escuchar: (canal, fn) => t.escuchar(canal, fn),
      presencia: (fn) => t.presencia(fn),
      salir: () => t.salir(),
    };
  }
}

interface Jugador {
  c: ClienteCoop;
  emisor: ReturnType<typeof crearEmisorPoses>;
  x: number;
  z: number;
  yaw: number;
  moviendose: boolean;
  /** Hasta cuándo sigue caminando o quieto. */
  hasta: number;
}

/** Pasos de la simulación: 30 cuadros por segundo, como un celular a 30 fps. */
const PASO_MS = 1000 / 30;

export async function simular(e: Escenario): Promise<Resultado> {
  const red = new RedEnMemoria({ retrasoMs: 60 });
  const contador = new Contador(() => red.ahora);
  const r = azar(e.semilla);
  const partidas: Jugador[][] = [];

  for (let k = 0; k < e.partidas; k++) {
    // Códigos válidos y distintos: «KM» y dos letras del alfabeto del protocolo.
    const a = ALFABETO_CODIGO;
    const codigo = `KM${a[Math.floor(k / a.length) % a.length]}${a[k % a.length]}`;
    const lista: Jugador[] = [];
    for (let j = 0; j < e.jugadores; j++) {
      const id: Identidad = {
        jugador: `j_p${k}x${j}`,
        alias: ALIAS[j % ALIAS.length] ?? 'zorro',
        color: COLORES[j % COLORES.length] ?? 'ambar',
        unido_en: 1000 + j,
        version_contenido: VERSION_CONTENIDO,
      };
      const t = contador.envolver(red.cliente(), () => e.jugadores);
      const c = new ClienteCoop(t, id, () => red.ahora);
      if (j === 0) await c.crear(codigo);
      else await c.unirse(codigo);
      red.vaciar();
      lista.push({
        c,
        emisor: crearEmisorPoses(1000 / e.hz),
        x: 0,
        z: 0,
        yaw: 0,
        moviendose: false,
        hasta: 0,
      });
    }
    for (const j of lista) await j.c.enviar({ t: 'listo', p: { listo: true } });
    red.vaciar();
    if (!lista.every((j) => j.c.foto?.fase === 'jugando')) {
      throw new Error(`La partida ${codigo} no empezó`);
    }
    partidas.push(lista);
  }

  // Desde aquí se mide: ya empezaron todas.
  contador.medir = true;
  const inicio = red.ahora;
  const fin = inicio + e.segundos * 1000;
  const probSenal = e.senalesPorMinuto / 60 / (1000 / PASO_MS);
  let proximoTick = inicio + 1000;

  for (let t = inicio; t < fin; t += PASO_MS) {
    red.avanzar(PASO_MS);
    const ahora = red.ahora;
    for (const lista of partidas) {
      for (const j of lista) {
        if (ahora >= j.hasta) {
          j.moviendose = r() < e.fraccionMoviendose;
          // Tramos de 2 a 6 s caminando o quieto.
          j.hasta = ahora + 2000 + r() * 4000;
          if (j.moviendose) j.yaw = (r() * 2 - 1) * Math.PI;
        }
        if (j.moviendose) {
          // 1,6 m/s, rebotando dentro de una sala de 10 × 10 m.
          j.x = Math.max(-5, Math.min(5, j.x - Math.sin(j.yaw) * 1.6 * (PASO_MS / 1000)));
          j.z = Math.max(-5, Math.min(5, j.z - Math.cos(j.yaw) * 1.6 * (PASO_MS / 1000)));
          j.yaw += 0.01;
        }
        const pose = j.emisor.cuadro(
          ahora,
          1,
          Math.round(j.x * 100),
          0,
          Math.round(j.z * 100),
          yawACentesimas(j.yaw),
        );
        if (pose) void j.c.t.enviar('dir', directo(j.c.yo, { t: 'pose', p: pose }));
        if (r() < probSenal) {
          void j.c.t.enviar(
            'dir',
            directo(j.c.yo, {
              t: 'senal',
              p: { s: 1, x: Math.round(j.x * 100), y: 0, z: Math.round(j.z * 100), frase: 'aqui' },
            }),
          );
        }
      }
    }
    if (ahora >= proximoTick) {
      proximoTick += 1000;
      for (const lista of partidas) for (const j of lista) j.c.tick();
    }
  }
  red.vaciar();
  contador.medir = false;
  // Las promesas de los últimos envíos.
  await new Promise((r) => setTimeout(r, 0));

  const segundos = [...contador.porSegundo.entries()]
    .filter(([s]) => s >= Math.floor(inicio / 1000) && s * 1000 < fin)
    .map(([, v]) => v);
  const total = (k: 'con' | 'sin') => segundos.reduce((a, v) => a + v[k], 0);
  const pico = (k: 'con' | 'sin') => Math.max(0, ...segundos.map((v) => v[k]));
  const redondear = (x: number) => Math.round(x * 10) / 10;
  const promedio = redondear(total('con') / e.segundos);
  const picoCon = pico('con');
  const conexiones = e.partidas * e.jugadores;
  return {
    escenario: e,
    mensajes: { ...contador.mensajes },
    eventosPorSegundo: { promedio, pico: picoCon },
    eventosPorSegundoSinPropia: {
      promedio: redondear(total('sin') / e.segundos),
      pico: pico('sin'),
    },
    conexiones,
    planes: PLANES.map((p) => ({
      plan: p.plan,
      cabe: picoCon <= p.eventosPorSegundo && conexiones <= p.conexiones,
      uso: Math.round((picoCon / p.eventosPorSegundo) * 100),
    })),
  };
}

const n = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** Tabla para la terminal y para el reporte (Markdown). */
export function tabla(resultados: readonly Resultado[]): string {
  const filas = [
    '| Partidas de 4 | Conexiones | Eventos/s (promedio) | Eventos/s (pico) | Sin la entrega propia (pico) | Free (100/s) | Pro (500/s) | Pro sin tope (2.500/s) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of resultados) {
    const planes = r.planes.map((p) => `${p.cabe ? 'cabe' : 'no cabe'} (${p.uso} %)`);
    filas.push(
      `| ${r.escenario.partidas} | ${r.conexiones} | ${n.format(r.eventosPorSegundo.promedio)} | ${n.format(r.eventosPorSegundo.pico)} | ${n.format(r.eventosPorSegundoSinPropia.pico)} | ${planes.join(' | ')} |`,
    );
  }
  return filas.join('\n');
}
