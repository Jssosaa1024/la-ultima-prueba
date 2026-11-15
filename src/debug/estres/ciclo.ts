/**
 * Motor de la prueba de estrés (T11o): un eje por corrida, escalón por escalón.
 *
 * Cada escalón:
 * 1. Guarda la marca en `localStorage` antes de subir la carga.
 * 2. Sube la carga (puede tardar: las texturas se descargan y se transcodifican).
 * 3. Calienta 1 s sin medir: compilación de shaders y subida de texturas.
 * 4. Mide 5 s: mediana, p95 y 1 % más lento, más triángulos, draw calls y MB de texturas.
 * 5. Decide: para si el p95 pasa de 33 ms dos escalones seguidos, si llega
 *    `webglcontextlost` o si el eje no tiene más escalones; si no, sigue.
 *
 * Es lógica pura: el reloj son los tiempos de cuadro que le pasa el motor, y la carga, la
 * marca y las medidas extra llegan como funciones. Así se prueba con Vitest.
 */
import { crearVentanaCuadros } from '../metricas';
import type { EscalonInforme, EstadoEscalon } from '../informe';
import type { Eje, Marca } from './marca';

export const CALENTAR_MS = 1000;
export const MEDIR_MS = 5000;
/** El p95 de 33 ms es el presupuesto: 30 fps sostenidos. */
export const P95_LIMITE_MS = 33;
export const LENTOS_SEGUIDOS_PARA_PARAR = 2;
/**
 * Durante la prueba un cuadro de 1 o 2 s es un resultado (el teléfono no da más), no una pausa:
 * solo se descarta un hueco tan largo que tiene que ser la pestaña oculta.
 */
export const HUECO_ESTRES_MS = 10_000;

export type FaseCiclo = 'preparando' | 'calentando' | 'midiendo' | 'terminada';
export type MotivoFin = 'limite' | 'sin-escalones' | 'contexto-perdido' | 'detenida' | 'error';

export interface MedidaExtra {
  triangulos: number;
  draw_calls: number;
  mb_texturas: number;
}

export interface OpcionesCiclo {
  eje: Eje;
  maxEscalones: number;
  /** Deja la carga del nivel `escalon` (acumulada: el 3 tiene tres veces la del 1). */
  aplicar(escalon: number): Promise<void> | void;
  describir(escalon: number): string;
  /** Triángulos, draw calls y MB de texturas del último cuadro. */
  medir(): MedidaExtra;
  guardarMarca(marca: Marca): void;
  borrarMarca(): void;
  /** Cada cambio de fase o de escalón, para el panel. */
  alCambiar?(estado: EstadoCiclo): void;
  alTerminar(estado: EstadoCiclo): void;
}

export interface EstadoCiclo {
  eje: Eje;
  fase: FaseCiclo;
  escalon: number;
  carga: string;
  escalones: EscalonInforme[];
  motivo: MotivoFin | null;
}

export interface Ciclo {
  readonly estado: EstadoCiclo;
  /** Empieza por el escalón 1. */
  iniciar(ahoraMs: number): void;
  /** Después de dibujar cada cuadro. */
  cuadro(ahoraMs: number): void;
  contextoPerdido(): void;
  detener(): void;
}

/** Número del último escalón estable; `null` si ninguno lo fue. */
export function ultimoEstable(escalones: readonly EscalonInforme[]): number | null {
  let ultimo: number | null = null;
  for (const e of escalones) if (e.estado === 'estable') ultimo = e.escalon;
  return ultimo;
}

/** Si hay que parar: los dos últimos escalones medidos pasaron de 33 ms de p95. */
export function debeParar(escalones: readonly EscalonInforme[]): boolean {
  if (escalones.length < LENTOS_SEGUIDOS_PARA_PARAR) return false;
  return escalones.slice(-LENTOS_SEGUIDOS_PARA_PARAR).every((e) => e.estado === 'lento');
}

export function crearCiclo(o: OpcionesCiclo): Ciclo {
  const ventana = crearVentanaCuadros(2048, MEDIR_MS + 100);
  const estado: EstadoCiclo = {
    eje: o.eje,
    fase: 'preparando',
    escalon: 0,
    carga: '',
    escalones: [],
    motivo: null,
  };
  let desde = 0;
  let anterior: number | null = null;
  let pedido = 0;

  const avisar = (): void => o.alCambiar?.({ ...estado, escalones: [...estado.escalones] });

  const terminar = (motivo: MotivoFin): void => {
    if (estado.fase === 'terminada') return;
    pedido++;
    estado.fase = 'terminada';
    estado.motivo = motivo;
    o.borrarMarca();
    avisar();
    o.alTerminar({ ...estado, escalones: [...estado.escalones] });
  };

  const subir = (escalon: number): void => {
    estado.escalon = escalon;
    estado.carga = o.describir(escalon);
    estado.fase = 'preparando';
    // 1. La marca, antes de subir: si la pestaña se cae, queda dicho en qué escalón fue.
    o.guardarMarca({
      eje: o.eje,
      escalon,
      estado: 'en-curso',
      escalones: estado.escalones,
    });
    avisar();
    const este = ++pedido;
    const listo = (): void => {
      if (este !== pedido || estado.fase === 'terminada') return;
      estado.fase = 'calentando';
      // El reloj del calentamiento empieza en el siguiente cuadro.
      desde = -1;
      avisar();
    };
    try {
      const r = o.aplicar(escalon);
      if (r) r.then(listo, () => terminar('error'));
      else listo();
    } catch {
      terminar('error');
    }
  };

  const cerrarEscalon = (ahoraMs: number): void => {
    const medida = ventana.estadisticas(ahoraMs);
    // Sin un solo cuadro en 5 s: tan lento que no hay nada que medir.
    const e =
      medida.cuadros > 0
        ? medida
        : { cuadros: 0, medianaMs: MEDIR_MS, p95Ms: MEDIR_MS, p1Ms: MEDIR_MS };
    const extra = o.medir();
    const lento = e.p95Ms > P95_LIMITE_MS;
    const resultado: EscalonInforme = {
      escalon: estado.escalon,
      carga: estado.carga,
      mediana_ms: e.medianaMs,
      p95_ms: e.p95Ms,
      p1_ms: e.p1Ms,
      triangulos: extra.triangulos,
      draw_calls: extra.draw_calls,
      mb_texturas: extra.mb_texturas,
      estado: (lento ? 'lento' : 'estable') satisfies EstadoEscalon,
    };
    estado.escalones.push(resultado);
    if (debeParar(estado.escalones)) terminar('limite');
    else if (estado.escalon >= o.maxEscalones) terminar('sin-escalones');
    else subir(estado.escalon + 1);
  };

  return {
    get estado() {
      return estado;
    },
    iniciar() {
      subir(1);
    },
    cuadro(ahoraMs) {
      if (estado.fase === 'calentando') {
        if (desde < 0) desde = ahoraMs;
        if (ahoraMs - desde >= CALENTAR_MS) {
          estado.fase = 'midiendo';
          desde = ahoraMs;
          anterior = ahoraMs;
          ventana.vaciar();
          avisar();
        }
        return;
      }
      if (estado.fase !== 'midiendo') return;
      if (anterior !== null) {
        const ms = ahoraMs - anterior;
        if (ms > 0 && ms < HUECO_ESTRES_MS) ventana.registrar(ms, ahoraMs);
      }
      anterior = ahoraMs;
      if (ahoraMs - desde >= MEDIR_MS) cerrarEscalon(ahoraMs);
    },
    contextoPerdido() {
      if (estado.fase === 'terminada') return;
      estado.escalones.push({
        escalon: estado.escalon,
        carga: estado.carga,
        estado: 'contexto-perdido',
      });
      terminar('contexto-perdido');
    },
    detener() {
      terminar('detenida');
    },
  };
}
