/**
 * Controlador de la prueba de estrés en el motor (T11o–T11r). Lo crea el motor junto con el
 * medidor, solo con el panel `?debug=1` abierto. Atiende `ordenEstres`, arma la carga del
 * eje, pasa cada cuadro al ciclo y, al terminar, libera todo y comprueba que
 * `renderer.info.memory` volvió a los valores de antes (T11r).
 */
import { effect } from '@preact/signals';
import type { Camera, Object3D, WebGLRenderer } from 'three';
import { bytesTexturasDe } from '../medidor';
import { aMb, estresActivo } from '../metricas';
import { crearCalor, escalonDeCalor } from './calor';
import type { Calor } from './calor';
import { crearCarga } from './cargas';
import type { CargaEstres } from './cargas';
import { crearCiclo, ultimoEstable } from './ciclo';
import type { Ciclo, EstadoCiclo } from './ciclo';
import { describirCarga, maxEscalones } from './ejes';
import { ESTRES_INACTIVO, corriendo, estres, ordenEstres } from './estado';
import { almacenDelNavegador, borrarMarca, guardarMarca } from './marca';
import type { Eje } from './marca';

export interface OpcionesControlador {
  renderer: WebGLRenderer;
  escena: Object3D;
  camara: Camera;
  canvas: HTMLCanvasElement;
  raizSala: () => Object3D | null;
  dprEquipo: () => number;
  /** Fija el pixel ratio del canvas; `null` lo devuelve al del juego. */
  fijarPixelRatio(ratio: number | null): void;
}

export interface ControladorEstres {
  cuadro(ahoraMs: number): void;
  liberar(): void;
}

const memoria = (r: WebGLRenderer) => ({
  geometrias: r.info.memory.geometries,
  texturas: r.info.memory.textures,
});

export function crearControladorEstres(o: OpcionesControlador): ControladorEstres {
  const almacen = almacenDelNavegador();
  let carga: CargaEstres | null = null;
  let ciclo: Ciclo | null = null;
  let calor: Calor | null = null;
  let antes = memoria(o.renderer);

  const publicar = (cambios: Partial<typeof ESTRES_INACTIVO>): void => {
    estres.value = { ...estres.peek(), ...cambios };
  };

  /** Saca la carga, devuelve el pixel ratio y compara la memoria con la de antes (T11r). */
  const soltarCarga = (): void => {
    carga?.liberar();
    carga = null;
    o.fijarPixelRatio(null);
    estresActivo.value = false;
    const despues = memoria(o.renderer);
    publicar({
      memoria: {
        antes,
        despues,
        liberada: despues.geometrias <= antes.geometrias && despues.texturas <= antes.texturas,
      },
    });
  };

  const armarCarga = (eje: Eje): CargaEstres => {
    antes = memoria(o.renderer);
    estresActivo.value = true;
    return crearCarga(eje, {
      renderer: o.renderer,
      escena: o.escena,
      camara: o.camara,
      raizSala: o.raizSala(),
      dprEquipo: o.dprEquipo(),
      fijarPixelRatio: (r) => o.fijarPixelRatio(r),
    });
  };

  const alCambiar = (e: EstadoCiclo): void => {
    publicar({
      fase: e.fase,
      eje: e.eje,
      escalon: e.escalon,
      carga: e.carga,
      escalones: e.escalones,
      motivo: e.motivo,
    });
  };

  const iniciar = (eje: Eje): void => {
    const dpr = o.dprEquipo();
    estres.value = { ...ESTRES_INACTIVO, eje, fase: 'preparando' };
    const esta = armarCarga(eje);
    carga = esta;
    ciclo = crearCiclo({
      eje,
      maxEscalones: maxEscalones(eje, dpr),
      aplicar: (escalon) => esta.aplicar(escalon),
      describir: (escalon) => describirCarga(eje, escalon, dpr),
      medir: () => ({
        triangulos: o.renderer.info.render.triangles,
        draw_calls: o.renderer.info.render.calls,
        mb_texturas: aMb(bytesTexturasDe(o.escena)),
      }),
      guardarMarca: (m) => guardarMarca(almacen, m),
      borrarMarca: () => borrarMarca(almacen),
      alCambiar,
      alTerminar: (e) => {
        alCambiar(e);
        ciclo = null;
        soltarCarga();
      },
    });
    ciclo.iniciar(performance.now());
  };

  /** 3 minutos al 70 % del último escalón estable del eje que se acaba de medir. */
  const iniciarCalor = (): void => {
    const e = estres.peek();
    const estable = ultimoEstable(e.escalones);
    if (!e.eje || estable === null) return;
    const eje = e.eje;
    const nivel = escalonDeCalor(estable);
    const textoCarga = describirCarga(eje, nivel, o.dprEquipo());
    const esta = armarCarga(eje);
    carga = esta;
    publicar({ fase: 'preparando', carga: textoCarga, calorRestanteS: 180 });
    const listo = (): void => {
      if (carga !== esta) return;
      calor = crearCalor();
      publicar({ fase: 'calor' });
    };
    Promise.resolve(esta.aplicar(nivel)).then(listo, () => {
      soltarCarga();
      publicar({ fase: 'terminada', motivo: 'error' });
    });
  };

  const terminarCalor = (resultado: { p95PrimerMinutoMs: number; p95UltimoMinutoMs: number }) => {
    calor = null;
    soltarCarga();
    publicar({
      fase: 'terminada',
      calorRestanteS: 0,
      calor: {
        carga: estres.peek().carga,
        p95_primer_minuto_ms: resultado.p95PrimerMinutoMs,
        p95_ultimo_minuto_ms: resultado.p95UltimoMinutoMs,
      },
    });
  };

  const detener = (): void => {
    if (ciclo) {
      ciclo.detener();
      return;
    }
    if (carga) {
      calor = null;
      soltarCarga();
      publicar({ fase: 'terminada', motivo: 'detenida' });
    }
  };

  const dejarDeEscuchar = effect(() => {
    const orden = ordenEstres.value;
    if (!orden) return;
    ordenEstres.value = null;
    const ocupada = corriendo(estres.peek());
    if (orden.t === 'detener') detener();
    else if (ocupada) return;
    else if (orden.t === 'iniciar') iniciar(orden.eje);
    else iniciarCalor();
  });

  // Si el navegador quita el contexto de WebGL, la prueba para ahí.
  const alPerderContexto = (): void => {
    if (ciclo) ciclo.contextoPerdido();
    else if (carga) detener();
  };
  o.canvas.addEventListener('webglcontextlost', alPerderContexto);

  let ultimaCuenta = -1;
  return {
    cuadro(ahoraMs) {
      ciclo?.cuadro(ahoraMs);
      if (calor) {
        const r = calor.cuadro(ahoraMs);
        if (r) terminarCalor(r);
        else if (calor.restanteS !== ultimaCuenta) {
          ultimaCuenta = calor.restanteS;
          publicar({ calorRestanteS: ultimaCuenta });
        }
      }
    },
    liberar() {
      dejarDeEscuchar();
      o.canvas.removeEventListener('webglcontextlost', alPerderContexto);
      // Cerrar el panel a mitad de la prueba la detiene y lo libera todo.
      if (ciclo || carga) detener();
    },
  };
}
