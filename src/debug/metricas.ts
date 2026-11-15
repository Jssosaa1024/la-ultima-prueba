/**
 * Métricas del panel `?debug=1` (T11m, especificación «Panel de métricas y prueba de estrés»).
 *
 * Aquí viven los signals que lee el panel y la lógica pura que los calcula: la ventana de
 * tiempos de cuadro (mediana, p95 y 1 % más lento), los colores contra el presupuesto, la
 * memoria estimada de texturas y los MB descargados de cada sala.
 *
 * Reglas de costo:
 * - Con el panel cerrado el motor no llama a nada de esto en cada cuadro: no hay asignaciones.
 * - Con el panel abierto, el motor registra cada cuadro en un búfer fijo (sin asignar) y los
 *   signals se escriben como máximo cada 500 ms.
 */
import { signal } from '@preact/signals';

/** Cada cuánto, como máximo, se escriben los signals de las métricas. */
export const MS_ENTRE_PUBLICACIONES = 500;
/** Ventana de los tiempos de cuadro: los últimos 5 s. */
export const VENTANA_MS = 5000;
/** Un hueco mayor entre cuadros es una pausa (pestaña oculta, carga), no un cuadro lento. */
export const HUECO_MAX_MS = 1000;
/** Desde qué fracción del límite un valor se pinta en ámbar. */
export const UMBRAL_AMBAR = 0.85;

/** Presupuesto de AGENTS.md y de la especificación, sección 0: el verde llega hasta aquí. */
export const LIMITES_PANEL = {
  p95Ms: 33,
  triangulos: 60_000,
  drawCalls: 40,
  mbTexturas: 16,
  mbDescargados: 2.6,
  cargaMs: 5000,
} as const;

export type Color = 'verde' | 'ambar' | 'rojo';

/** Verde hasta el 85 % del límite, ámbar hasta el límite y rojo por encima. */
export function colorContra(valor: number, limite: number): Color {
  if (valor > limite) return 'rojo';
  if (valor > limite * UMBRAL_AMBAR) return 'ambar';
  return 'verde';
}

export interface EstadisticasCuadro {
  /** Cuadros en la ventana. */
  cuadros: number;
  medianaMs: number;
  p95Ms: number;
  /** El 1 % más lento: el percentil 99 del tiempo de cuadro. */
  p1Ms: number;
}

/** Percentil `q` (0 a 1) de los primeros `n` valores ya ordenados, por el método del rango más cercano. */
function percentil(ordenados: Float64Array, n: number, q: number): number {
  if (n === 0) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1));
  return ordenados[i] ?? 0;
}

const redondear1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Ventana circular de tiempos de cuadro. `registrar` no asigna memoria: escribe en un búfer
 * de tamaño fijo. Solo `estadisticas` (cada 500 ms) ordena una copia, también preasignada.
 */
export interface VentanaCuadros {
  /** Cuenta un cuadro que tardó `ms` y que terminó en el instante `ahoraMs`. */
  registrar(ms: number, ahoraMs: number): void;
  /** Mediana, p95 y 1 % más lento de los cuadros de los últimos `VENTANA_MS`. */
  estadisticas(ahoraMs: number): EstadisticasCuadro;
  vaciar(): void;
}

export function crearVentanaCuadros(capacidad = 1024): VentanaCuadros {
  const duraciones = new Float64Array(capacidad);
  const instantes = new Float64Array(capacidad);
  const ordenados = new Float64Array(capacidad);
  let siguiente = 0;
  let cantidad = 0;

  return {
    registrar(ms, ahoraMs) {
      duraciones[siguiente] = ms;
      instantes[siguiente] = ahoraMs;
      siguiente = (siguiente + 1) % capacidad;
      if (cantidad < capacidad) cantidad++;
    },
    estadisticas(ahoraMs) {
      let n = 0;
      for (let k = 0; k < cantidad; k++) {
        const i = (siguiente - 1 - k + capacidad) % capacidad;
        if (ahoraMs - (instantes[i] ?? 0) > VENTANA_MS) break;
        ordenados[n++] = duraciones[i] ?? 0;
      }
      const vista = ordenados.subarray(0, n);
      vista.sort();
      return {
        cuadros: n,
        medianaMs: redondear1(percentil(vista, n, 0.5)),
        p95Ms: redondear1(percentil(vista, n, 0.95)),
        p1Ms: redondear1(percentil(vista, n, 0.99)),
      };
    },
    vaciar() {
      siguiente = 0;
      cantidad = 0;
    },
  };
}

/**
 * Bytes por píxel de una textura en la GPU, según cómo quedó tras transcodificar el KTX2:
 * 0,5 B en ETC2 RGB (y en los otros formatos de 4 bits por píxel), 1 B en ASTC 4×4, ETC2 RGBA
 * y los de 8 bits por píxel, y 4 B sin comprimir.
 */
export type ClaseTextura = 'bpp4' | 'bpp8' | 'sin-comprimir';
export const BYTES_POR_PIXEL: Record<ClaseTextura, number> = {
  bpp4: 0.5,
  bpp8: 1,
  'sin-comprimir': 4,
};
/** Los mipmaps suman un tercio más. */
export const FACTOR_MIPMAPS = 1.33;

export function bytesTextura(
  ancho: number,
  alto: number,
  clase: ClaseTextura,
  conMipmaps: boolean,
): number {
  const base = Math.max(0, ancho) * Math.max(0, alto) * BYTES_POR_PIXEL[clase];
  return conMipmaps ? base * FACTOR_MIPMAPS : base;
}

/** Lo mínimo de una entrada de `PerformanceObserver` de tipo `resource`. */
export interface Recurso {
  name: string;
  transferSize: number;
  decodedBodySize: number;
}

export interface Descargas {
  /** Bytes que llegaron por la red (`transferSize`). */
  bytesRed: number;
  /** Archivos de la sala que vinieron de la caché (transferSize 0 con cuerpo). */
  desdeCache: number;
  archivos: number;
}

/**
 * Suma lo descargado bajo `/assets/salas/<sala>/`. Lo que vino de la caché (del navegador o
 * del service worker) llega con `transferSize` 0 y se cuenta aparte.
 */
export function sumarDescargas(recursos: Iterable<Recurso>, sala: string): Descargas {
  const ruta = `/assets/salas/${sala}/`;
  const total: Descargas = { bytesRed: 0, desdeCache: 0, archivos: 0 };
  for (const r of recursos) {
    let camino: string;
    try {
      camino = new URL(r.name, 'http://x').pathname;
    } catch {
      continue;
    }
    if (!camino.startsWith(ruta)) continue;
    total.archivos++;
    if (r.transferSize > 0) total.bytesRed += r.transferSize;
    else if (r.decodedBodySize > 0) total.desdeCache++;
  }
  return total;
}

export const MB = 1024 * 1024;
export const aMb = (bytes: number): number => Math.round((bytes / MB) * 100) / 100;

/** Lo que muestra el panel. Lo escribe el motor como máximo cada 500 ms. */
export interface Metricas {
  /** `false` hasta la primera publicación con el panel abierto. */
  lista: boolean;
  sala: string | null;
  cuadro: EstadisticasCuadro;
  triangulos: number;
  drawCalls: number;
  mbTexturas: number;
  /** `renderer.info.memory`: si crecen al volver a una sala, falta un `dispose()`. */
  geometrias: number;
  texturas: number;
  mbDescargados: number;
  archivosDeCache: number;
  /** Desde `sala:inicio` hasta `sala:primer-cuadro` de la última sala; `null` si no hay. */
  cargaMs: number | null;
  /** Contexto del equipo. */
  devicePixelRatio: number;
  pixelRatioUsado: number;
  /** Perfil de calidad (bajo, medio, alto). Aún no existe: lo fija T11y. */
  perfil: string | null;
}

export const METRICAS_VACIAS: Metricas = {
  lista: false,
  sala: null,
  cuadro: { cuadros: 0, medianaMs: 0, p95Ms: 0, p1Ms: 0 },
  triangulos: 0,
  drawCalls: 0,
  mbTexturas: 0,
  geometrias: 0,
  texturas: 0,
  mbDescargados: 0,
  archivosDeCache: 0,
  cargaMs: null,
  devicePixelRatio: 1,
  pixelRatioUsado: 1,
  perfil: null,
};

export const metricas = signal<Metricas>(METRICAS_VACIAS);

/**
 * Si el panel de depuración está abierto. Lo escribe la interfaz (`?debug=1` o 3 toques en
 * la esquina superior izquierda); el motor solo mide mientras es `true`.
 */
export const depuracionAbierta = signal(false);

// --- Tiempo de carga de cada sala: `performance.measure` entre dos marcas -------------------

let salaCargando: string | null = null;
let ultimaCarga: { sala: string; ms: number } | null = null;

/** El motor empieza a cargar una sala. Una vez por cambio de sala: no cuesta por cuadro. */
export function marcarInicioSala(sala: string): void {
  salaCargando = sala;
  try {
    performance.mark('sala:inicio');
  } catch {
    // Sin la API de rendimiento no hay tiempo de carga; el juego sigue igual.
  }
}

/** Primer cuadro dibujado de la sala: mide desde `sala:inicio`. */
export function marcarPrimerCuadro(): void {
  const sala = salaCargando;
  salaCargando = null;
  if (sala === null) return;
  try {
    performance.mark('sala:primer-cuadro');
    const medida = performance.measure(`sala:${sala}`, 'sala:inicio', 'sala:primer-cuadro');
    ultimaCarga = { sala, ms: Math.round(medida.duration) };
  } catch {
    ultimaCarga = null;
  }
}

export const ultimaCargaDeSala = (): { sala: string; ms: number } | null => ultimaCarga;

/** Solo para las pruebas de unidad. */
export function reiniciarCargas(): void {
  salaCargando = null;
  ultimaCarga = null;
}
