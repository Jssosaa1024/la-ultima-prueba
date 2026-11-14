import { batch, type Signal } from '@preact/signals';
import { puzzleDeSala } from '../content/puzzles';
import type { Puzzle } from '../content/esquema';
import { destinoDePuerta } from '../content/salas';
import {
  aplicar,
  crearPartida,
  ETAPAS_POR_SALA,
  etapaActual,
  GRABACIONES,
  numeroDeSala,
  opcionesDeFinal,
  sellos as sellosDe,
  type Accion,
  type Partida,
  type SalaId,
} from '../game/partida';
import { avanzarTiempo, PISTAS_INICIALES, verPista, type EstadoPistas } from '../game/pistas';
import { evaluar } from '../game/puzzles';
import { iguales } from '../game/puzzles/tipos';
import { agotado, crearReloj, pausar, reanudar, restante } from '../game/reloj';
import {
  cuadernoActivo,
  datosEncontrados,
  limpiarNota,
  notas,
  reiniciarCuaderno,
} from './cuaderno';
import { cargarEjemplo, enfocarSiguiente, quitarEjemplo } from './ejemplo';
import {
  abrirInspeccion,
  abrirPanel,
  avisar,
  cerrarPanel,
  enfocado,
  reiniciarInterfaz,
  type ObjetoEnfocado,
} from './interfaz';
import { condiciones, etapa, mecanismo, pistas, reiniciarMecanismo } from './mecanismo';
import {
  DURACION_MS,
  fase,
  final,
  grabaciones,
  inventario,
  modo,
  opcionesFinal,
  reiniciarPartida,
  reloj,
  sala,
  sellos,
  type FinalId,
} from './partida';
import { escuchar, type Comando } from './puente';

/**
 * Controlador de la partida individual (T31b).
 *
 * Es el único que escribe los signals de la partida. Recibe las órdenes del puente, las pasa
 * por las reglas puras de `game/` (máquina de estados, reloj y pistas) y copia el resultado a
 * los signals que leen `ui/` y `engine/`. En cooperativo, este papel lo tendrá el anfitrión.
 *
 * Debe empezar a escuchar ANTES que el motor: el motor compara la sala de la partida justo
 * después de que este controlador la cambia (ver `engine/motor.ts`).
 */

/** Objetos de la portería con un papel fijo en la partida (ids de `content/salas.json`). */
export const OBJETO_SALIDA = 'porteria-salida';
export const OBJETO_INTERCOMUNICADOR = 'porteria-intercomunicador';
export const OBJETO_CUADERNO = 'porteria-cuaderno';

/** Lo mínimo del documento que se usa: saber si la pestaña está oculta y cuándo cambia. */
export interface DocumentoVisible {
  readonly hidden: boolean;
  addEventListener(tipo: 'visibilitychange', oyente: () => void): void;
  removeEventListener(tipo: 'visibilitychange', oyente: () => void): void;
}

export interface OpcionesControlador {
  /** Por defecto, el documento del navegador. `null`: no se mira la visibilidad. */
  documento?: DocumentoVisible | null;
}

/**
 * Por qué está detenido el reloj. Mientras quede algún motivo, no corre:
 * - `orden`: lo pidió la interfaz (el cuaderno abierto en modo individual);
 * - `oculta`: la pestaña no se ve (otra app, pantalla bloqueada).
 */
type MotivoPausa = 'orden' | 'oculta';

/** Con `?ejemplo=1&final=<id>`: la acción de `game/partida.ts` que lleva a ese final. */
const ACCION_DE_FINAL: Readonly<Record<FinalId, Accion>> = {
  justo_a_tiempo: { t: 'elegir_final', opcion: 'salir' },
  el_legado: { t: 'elegir_final', opcion: 'restaurar' },
  pedir_ayuda: { t: 'pedir_ayuda' },
  tiempo_cumplido: { t: 'tiempo_agotado' },
};

const ahora = (): number => performance.now();

/** Escribe el signal solo si el contenido cambió, para no redibujar sin necesidad. */
function asignar<T>(s: Signal<T>, valor: T): void {
  if (!iguales(s.value, valor)) s.value = valor;
}

/** Copia de un valor JSON (los estados de los mecanismos solo tienen números, textos y listas). */
const copiar = (x: unknown): unknown => JSON.parse(JSON.stringify(x)) as unknown;

/** Empieza a atender órdenes. Devuelve la función para detenerlo. */
export function iniciarControlador(opciones: OpcionesControlador = {}): () => void {
  const documento =
    opciones.documento !== undefined
      ? opciones.documento
      : typeof document === 'undefined'
        ? null
        : document;

  let partida: Partida | null = null;
  const motivos = new Set<MotivoPausa>();
  /** Pistas de cada puzzle visitado. */
  let pistasPorSala: Partial<Record<SalaId, EstadoPistas>> = {};
  /** Ajustes de cada mecanismo en su etapa actual: se conservan al salir y volver. */
  let ajustes: Partial<Record<SalaId, unknown>> = {};
  /** Instante desde el que corre tiempo de etapa sin contar todavía en las pistas. */
  let marca: number | null = null;
  let contadorNotas = 0;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  /** La sala donde está el jugador, si todavía le falta alguna etapa. */
  function etapaEnCurso(): { sala: SalaId; puzzle: Puzzle; etapa: number } | null {
    if (!partida || partida.fase !== 'jugando' || partida.lugar === 'porteria') return null;
    const n = etapaActual(partida, partida.lugar);
    const puzzle = puzzleDeSala(numeroDeSala(partida.lugar));
    return n === null || !puzzle ? null : { sala: partida.lugar, puzzle, etapa: n };
  }

  /** Suma a las pistas el tiempo de reloj activo que pasó en la etapa desde la última marca. */
  function contarTiempo(t: number): void {
    const actual = etapaEnCurso();
    if (marca !== null && actual) {
      const antes = pistasPorSala[actual.sala] ?? PISTAS_INICIALES;
      pistasPorSala[actual.sala] = avanzarTiempo(antes, actual.puzzle.pistas, t - marca);
    }
    marca = null;
  }

  /** El reloj corre solo mientras se juega y no hay ningún motivo de pausa. */
  function ajustarReloj(t: number): void {
    if (!partida) return;
    const detenido = partida.fase !== 'jugando' || motivos.size > 0;
    reloj.value = detenido ? pausar(reloj.value, t) : reanudar(reloj.value, t);
  }

  /** Copia la partida a los signals. */
  function publicar(): void {
    const p = partida;
    if (!p) return;
    batch(() => {
      sala.value = p.lugar;
      asignar(sellos, sellosDe(p));
      asignar(grabaciones, p.grabaciones);
      asignar(opcionesFinal, opcionesDeFinal(p));

      const actual = etapaEnCurso();
      const inicial = actual?.puzzle.etapas[actual.etapa]?.estado_inicial;
      if (actual && inicial !== undefined) {
        const estado = (ajustes[actual.sala] ??= copiar(inicial));
        asignar(etapa, { sala: actual.sala, puzzle: actual.puzzle.id, etapa: actual.etapa });
        asignar(mecanismo, estado);
        asignar(condiciones, evaluar(actual.puzzle, actual.etapa, estado)?.condiciones ?? {});
      } else {
        etapa.value = null;
        mecanismo.value = null;
        asignar(condiciones, {});
      }
      const vistas = p.lugar === 'porteria' ? undefined : pistasPorSala[p.lugar];
      asignar(pistas, { ofrecidas: vistas?.ofrecidas ?? 0, vistas: vistas?.vistas ?? 0 });

      if (p.fase === 'final') {
        cerrarPanel();
        final.value = p.final;
        fase.value = 'final';
      }
    });
  }

  /**
   * Un solo temporizador para lo próximo que debe pasar sin que nadie toque nada: que se
   * ofrezca la siguiente pista o que se acabe el tiempo. Con el reloj detenido no hay nada
   * que esperar.
   */
  function programar(t: number): void {
    clearTimeout(temporizador);
    temporizador = undefined;
    if (!partida || partida.fase !== 'jugando' || reloj.value.pausado) return;
    let espera = restante(reloj.value, t);
    const actual = etapaEnCurso();
    if (actual) {
      const e = pistasPorSala[actual.sala] ?? PISTAS_INICIALES;
      const siguiente = actual.puzzle.pistas[e.ofrecidas];
      if (siguiente) espera = Math.min(espera, siguiente.tras_segundos * 1000 - e.msEnEtapa);
    }
    temporizador = setTimeout(alVencer, Math.max(0, Math.ceil(espera)));
  }

  /**
   * Todo cambio pasa por aquí: primero se cuenta el tiempo jugado con el estado anterior,
   * luego se aplica el cambio y al final se ajustan el reloj, los signals y el temporizador.
   */
  function cambiar(mutar: (t: number) => void): void {
    const t = ahora();
    contarTiempo(t);
    mutar(t);
    ajustarReloj(t);
    marca = etapaEnCurso() && !reloj.value.pausado ? t : null;
    publicar();
    programar(t);
  }

  /** Pasa una acción por las reglas de la partida. Devuelve si se aceptó. */
  function jugar(accion: Accion): boolean {
    const antes = partida;
    if (!antes) return false;
    let despues = antes;
    cambiar(() => {
      despues = aplicar(antes, accion);
      partida = despues;
    });
    return despues !== antes;
  }

  function alVencer(): void {
    cambiar((t) => {
      if (partida && agotado(reloj.value, t)) partida = aplicar(partida, { t: 'tiempo_agotado' });
    });
  }

  function alCambiarVisibilidad(): void {
    // Sin partida no hay reloj que detener; al empezar se vuelve a mirar si está oculta.
    if (!partida) return;
    cambiar(() => {
      if (documento?.hidden) motivos.add('oculta');
      else motivos.delete('oculta');
    });
  }

  function empezar(): void {
    cambiar((t) => {
      partida = crearPartida();
      pistasPorSala = {};
      ajustes = {};
      contadorNotas = 0;
      motivos.clear();
      if (documento?.hidden) motivos.add('oculta');
      batch(() => {
        reiniciarInterfaz();
        reiniciarPartida();
        reiniciarCuaderno();
        reiniciarMecanismo();
        modo.value = 'individual';
        fase.value = 'jugando';
        // El inventario empieza vacío: la linterna y el cuaderno se recogen en la portería.
        reloj.value = crearReloj(DURACION_MS, t);
      });
    });
  }

  function salir(): void {
    clearTimeout(temporizador);
    temporizador = undefined;
    partida = null;
    marca = null;
    motivos.delete('orden');
    batch(() => {
      quitarEjemplo();
      reiniciarInterfaz();
      reiniciarPartida();
      reiniciarCuaderno();
      reiniciarMecanismo();
    });
  }

  /** `/jugar?ejemplo=1`: sala 1 resuelta y cuaderno en mano; con `final`, salta a ese final. */
  function cargarDatosDeEjemplo(finalPedido: FinalId | null): void {
    const base = partida;
    if (!base || base.fase !== 'jugando') return;
    cambiar(() => {
      let p: Partida = { ...base, etapas: { ...base.etapas, 's1-cooperativa': ETAPAS_POR_SALA } };
      if (finalPedido) {
        p = {
          ...crearPartida(),
          etapas: {
            's1-cooperativa': ETAPAS_POR_SALA,
            's2-laboratorio': ETAPAS_POR_SALA,
            's3-gimnasio': ETAPAS_POR_SALA,
            's4-biblioteca': ETAPAS_POR_SALA,
            's5-rectoria': ETAPAS_POR_SALA,
          },
          grabaciones: [...GRABACIONES],
        };
        p = aplicar(p, ACCION_DE_FINAL[finalPedido]);
      }
      partida = p;
      batch(() => {
        cuadernoActivo.value = true;
        cargarEjemplo();
      });
    });
  }

  function recoger(objeto: ObjetoEnfocado): void {
    if (inventario.value.some((o) => o.id === objeto.id)) return;
    // El cuaderno no va a la lista del inventario: activa su botón del HUD.
    const esCuaderno = objeto.id === OBJETO_CUADERNO;
    inventario.value = [
      ...inventario.value,
      esCuaderno
        ? { id: objeto.id, nombre: objeto.nombre, conBoton: true }
        : { id: objeto.id, nombre: objeto.nombre },
    ];
    if (esCuaderno) cuadernoActivo.value = true;
  }

  function usar(objeto: string): void {
    const destino = destinoDePuerta(objeto);
    if (destino === 'porteria') {
      jugar({ t: 'volver_porteria' });
      return;
    }
    if (destino) {
      // Las salas se abren en orden (`salaAbierta`): una puerta cerrada no deja entrar.
      const estabaEnPorteria = partida?.lugar === 'porteria';
      if (!jugar({ t: 'entrar', sala: destino }) && estabaEnPorteria) {
        avisar({ t: 'puerta_cerrada', sala: numeroDeSala(destino) });
      }
      return;
    }
    if (partida?.lugar !== 'porteria') return;
    // La puerta de salida muestra qué se puede elegir; el intercomunicador pide confirmar.
    if (objeto === OBJETO_SALIDA) abrirPanel('salida');
    if (objeto === OBJETO_INTERCOMUNICADOR) abrirPanel('ayuda');
  }

  function atenderAccion(objeto: string, accion: ObjetoEnfocado['accion']): void {
    const actual = enfocado.value;
    if (!partida || partida.fase !== 'jugando') return;
    // Solo vale la acción del objeto que el jugador tiene enfocado.
    if (!actual || actual.id !== objeto || actual.accion !== accion) return;
    batch(() => {
      if (accion === 'examinar') {
        abrirInspeccion(objeto);
        // Lo que se inspecciona queda anotado en «Datos encontrados» del cuaderno.
        if (!datosEncontrados.value.includes(objeto)) {
          datosEncontrados.value = [...datosEncontrados.value, objeto];
        }
      } else if (accion === 'recoger') {
        recoger(actual);
      } else {
        usar(objeto);
      }
      enfocado.value = null;
      enfocarSiguiente();
    });
  }

  function atender(comando: Comando): void {
    switch (comando.t) {
      case 'iniciar':
        // El cooperativo aún no existe: solo se atiende el modo individual.
        if (comando.modo === 'individual') empezar();
        return;
      case 'salir':
        salir();
        return;
      case 'pausar':
        if (partida) cambiar(() => motivos.add('orden'));
        return;
      case 'reanudar':
        if (partida) cambiar(() => motivos.delete('orden'));
        return;
      case 'accion':
        atenderAccion(comando.objeto, comando.accion);
        return;
      case 'elegir_final':
        jugar({ t: 'elegir_final', opcion: comando.opcion });
        return;
      case 'pedir_ayuda':
        jugar({ t: 'pedir_ayuda' });
        return;
      case 'ver_pista': {
        const lugar = partida?.fase === 'jugando' ? partida.lugar : 'porteria';
        if (lugar === 'porteria') return;
        // Primero se cuenta el tiempo (puede ofrecer una pista nueva) y luego se abre.
        cambiar(() => {
          const e = pistasPorSala[lugar];
          if (e) pistasPorSala[lugar] = verPista(e);
        });
        return;
      }
      case 'ejemplo':
        cargarDatosDeEjemplo(comando.final);
        return;
      case 'nota':
        if (!partida || partida.fase !== 'jugando') return;
        if (comando.op === 'agregar') {
          const texto = limpiarNota(comando.texto);
          if (texto) notas.value = [...notas.value, { id: `n${++contadorNotas}`, texto }];
        } else {
          notas.value = notas.value.filter((n) => n.id !== comando.id);
        }
        return;
    }
  }

  const dejarDeEscuchar = escuchar(atender);
  documento?.addEventListener('visibilitychange', alCambiarVisibilidad);
  return () => {
    dejarDeEscuchar();
    documento?.removeEventListener('visibilitychange', alCambiarVisibilidad);
    clearTimeout(temporizador);
  };
}
