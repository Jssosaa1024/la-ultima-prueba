/**
 * Informe en JSON del panel `?debug=1` (T11n), con el formato de la especificación
 * («Exportación en JSON»). Lógica pura: el panel le pasa las métricas y el contexto.
 *
 * Datos del equipo: solo `userAgent`, pixel ratio y resolución (CLAUDE.md, datos de los
 * jugadores). Nada de nombres, ubicación ni identificadores.
 */
import type { Metricas } from './metricas';

export type EstadoEscalon = 'estable' | 'lento' | 'recarga-por-memoria' | 'contexto-perdido';

export interface EscalonInforme {
  escalon: number;
  /** Qué se agregó, en palabras: «+20.000 triángulos», «+8 texturas», «pixel ratio 1,5». */
  carga: string;
  mediana_ms?: number;
  p95_ms?: number;
  p1_ms?: number;
  triangulos?: number;
  draw_calls?: number;
  mb_texturas?: number;
  estado: EstadoEscalon;
}

export interface InformeEstres {
  eje: string;
  escalones: EscalonInforme[];
  /** Número del último escalón estable; `null` si ninguno lo fue. */
  ultimo_estable: number | null;
  /** T11r: si `renderer.info.memory` volvió a lo de antes al terminar. */
  memoria?: {
    antes: { geometrias: number; texturas: number };
    despues: { geometrias: number; texturas: number };
    liberada: boolean;
  };
  /** Prueba de calor: 3 minutos al 70 % del límite, p95 del primer minuto frente al último. */
  calor?: { carga: string; p95_primer_minuto_ms: number; p95_ultimo_minuto_ms: number };
}

export interface ContextoEquipo {
  userAgent: string;
  devicePixelRatio: number;
  /** Resolución física de la pantalla, en píxeles. */
  pantalla: [number, number];
}

export interface Informe {
  version: 1;
  fecha: string;
  dispositivo: {
    userAgent: string;
    devicePixelRatio: number;
    pantalla: [number, number];
    perfil: string | null;
    ahorro_energia: null;
  };
  sala: string | null;
  metricas: {
    mediana_ms: number;
    p95_ms: number;
    p1_ms: number;
    triangulos: number;
    draw_calls: number;
    mb_texturas: number;
    mb_descargados: number;
    carga_ms: number | null;
    pixel_ratio_usado: number;
  };
  estres: InformeEstres | null;
}

const dos = (n: number): string => String(Math.trunc(Math.abs(n))).padStart(2, '0');

/** Fecha local con su desfase, como en el ejemplo: `2026-11-05T15:00:00-05:00`. */
export function fechaLocal(fecha: Date): string {
  const desfase = -fecha.getTimezoneOffset();
  const signo = desfase >= 0 ? '+' : '-';
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}` +
    `${signo}${dos(desfase / 60)}:${dos(desfase % 60)}`
  );
}

export function armarInforme(
  m: Metricas,
  equipo: ContextoEquipo,
  fecha: Date,
  estres: InformeEstres | null = null,
): Informe {
  return {
    version: 1,
    fecha: fechaLocal(fecha),
    dispositivo: {
      userAgent: equipo.userAgent,
      devicePixelRatio: equipo.devicePixelRatio,
      pantalla: equipo.pantalla,
      perfil: m.perfil,
      // Ningún navegador dice si el ahorro de energía está activo: se anota a mano.
      ahorro_energia: null,
    },
    sala: m.sala,
    metricas: {
      mediana_ms: m.cuadro.medianaMs,
      p95_ms: m.cuadro.p95Ms,
      p1_ms: m.cuadro.p1Ms,
      triangulos: m.triangulos,
      draw_calls: m.drawCalls,
      mb_texturas: m.mbTexturas,
      mb_descargados: m.mbDescargados,
      carga_ms: m.cargaMs,
      pixel_ratio_usado: m.pixelRatioUsado,
    },
    estres,
  };
}

/** Nombre del archivo: solo letras, números y guiones. */
export function nombreArchivo(informe: Informe): string {
  const sala = (informe.sala ?? 'sin-sala').replace(/[^a-z0-9-]/gi, '');
  const fecha = informe.fecha.slice(0, 19).replace(/[^0-9]/g, '');
  return `metricas-${sala}-${fecha}.json`;
}

/** Contexto del equipo, leído del navegador. */
export function contextoDelEquipo(): ContextoEquipo {
  const dpr = window.devicePixelRatio || 1;
  return {
    userAgent: navigator.userAgent,
    devicePixelRatio: dpr,
    pantalla: [Math.round(screen.width * dpr), Math.round(screen.height * dpr)],
  };
}

/** iPhone o iPad (los iPad nuevos dicen «Macintosh», pero tienen pantalla táctil). */
function esIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Descarga el informe. En iPhone, Safari no guarda descargas a la vista: se abre el menú de
 * compartir (AirDrop, WhatsApp, Archivos). Devuelve cómo salió.
 */
export async function exportarInforme(
  informe: Informe,
): Promise<'descargado' | 'compartido' | 'cancelado'> {
  const texto = JSON.stringify(informe, null, 2);
  const nombre = nombreArchivo(informe);
  const archivo = new File([texto], nombre, { type: 'application/json' });
  if (esIos() && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return 'compartido';
    } catch {
      return 'cancelado';
    }
  }
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Con calma: un equipo ocupado tarda en guardar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'descargado';
}
