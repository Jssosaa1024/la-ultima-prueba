import { batch, type Signal } from '@preact/signals';
import { PUZZLES, puzzleDeSala } from '../content/puzzles';
import type { Puzzle } from '../content/esquema';
import { destinoDePuerta, nombreDeObjeto } from '../content/salas';
import {
  borrarGuardado,
  cargar,
  guardar,
  VERSION_GUARDADO,
  type Almacen,
  type Guardado,
} from '../game/guardado';
import {
  alCambiarEstado,
  avanzarReposo,
  intentoAlAccionar,
  reglaDeIntento,
  type Reposo,
} from '../game/intentos';
import {
  aplicar,
  crearPartida,
  ETAPAS_POR_SALA,
  etapaActual,
  GRABACIONES,
  numeroDeSala,
  opcionesDeFinal,
  salaResuelta,
  sellos as sellosDe,
  type Accion,
  type Partida,
  type SalaId,
} from '../game/partida';
import {
  avanzarTiempo,
  nuevaEtapa,
  PISTAS_INICIALES,
  registrarIntento,
  verPista,
  type EstadoPistas,
} from '../game/pistas';
import type { Evaluacion } from '../game/puzzles';
import { evaluar } from '../game/puzzles';
import { iguales } from '../game/puzzles/tipos';
import { agotado, crearReloj, pausar, reanudar, restante } from '../game/reloj';
import {
  cuadernoActivo,
  datosEncontrados,
  limpiarNota,
  MAX_NOTAS,
  notas,
  reiniciarCuaderno,
} from './cuaderno';
import { cargarEjemplo, conEjemplo, enfocarSiguiente, quitarEjemplo } from './ejemplo';
import {
  abrirInspeccion,
  abrirPanel,
  avisar,
  cerrarPanel,
  enfocado,
  reiniciarInterfaz,
  type ObjetoEnfocado,
} from './interfaz';
import { condiciones, etapa, mecanismo, pistas, reiniciarMecanismo, resultado } from './mecanismo';
import {
  avance,
  DURACION_MS,
  fase,
  final,
  grabaciones,
  guardada,
  inventario,
  modo,
  opcionesFinal,
  reiniciarPartida,
  reloj,
  sala,
  sellos,
  type FinalId,
  type ObjetoInventario,
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
 *
 * Mecanismos (T31d): los paneles envían `ajustar` y `accionar`. Hay dos clases de etapa, según
 * su regla `intento` del JSON:
 * - `accionar`: la máquina responde cuando se acciona su objeto. Si los ajustes resuelven la
 *   etapa, la partida avanza; si no, cuenta un intento para las pistas.
 * - `reposo`: la máquina responde en vivo. Cuando los ajustes quedan quietos los segundos de
 *   la regla, cuenta un intento si no resuelven o la partida avanza si resuelven. Así, pasar
 *   por la solución mientras se arrastra un control no resuelve la etapa.
 *
 * Guardado (T31c): después de cada orden, al pausar y al ocultar la pestaña se guarda la
 * partida con `game/guardado.ts`. Si el almacenamiento no existe o falla (pestaña privada,
 * cuota llena), se juega igual, sin guardar.
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
  /** Por defecto, `localStorage`. `null`: no se guarda la partida. */
  almacen?: Almacen | null;
}

/** `localStorage`, o `null` si no existe o el navegador no deja usarlo (pestaña privada). */
function almacenDelNavegador(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** El objeto recogido con ese id, como va en el inventario; `null` si ya no existe. */
function objetoDeInventario(id: string): ObjetoInventario | null {
  const nombre = nombreDeObjeto(id);
  if (!nombre) return null;
  return id === OBJETO_CUADERNO ? { id, nombre, conBoton: true } : { id, nombre };
}

/**
 * Por qué está detenido el reloj. Mientras quede algún motivo, no corre:
 * - `orden`: lo pidió la interfaz (el cuaderno abierto en modo individual);
 * - `oculta`: la pestaña no se ve (otra app, pantalla bloqueada).
 */
type MotivoPausa = 'orden' | 'oculta';

interface EtapaEnCurso {
  sala: SalaId;
  puzzle: Puzzle;
  etapa: number;
}

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

/** El mismo mapa por sala, sin la entrada de esa sala. */
function sinSala<T>(mapa: Partial<Record<SalaId, T>>, sala: SalaId): Partial<Record<SalaId, T>> {
  const resto: Partial<Record<SalaId, T>> = {};
  for (const [clave, valor] of Object.entries(mapa) as [SalaId, T][]) {
    if (clave !== sala) resto[clave] = valor;
  }
  return resto;
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
  const almacen = opciones.almacen !== undefined ? opciones.almacen : almacenDelNavegador();

  let partida: Partida | null = null;
  const motivos = new Set<MotivoPausa>();
  /** Pistas de cada puzzle visitado. */
  let pistasPorSala: Partial<Record<SalaId, EstadoPistas>> = {};
  /** Ajustes de cada mecanismo en su etapa actual: se conservan al salir y volver. */
  let ajustes: Partial<Record<SalaId, unknown>> = {};
  /** En las etapas que responden en vivo: cuánto llevan quietos los ajustes de cada sala. */
  let reposos: Partial<Record<SalaId, Reposo>> = {};
  let contadorResultados = 0;
  /** Instante desde el que corre tiempo de etapa sin contar todavía en las pistas. */
  let marca: number | null = null;
  let contadorNotas = 0;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  /** La sala donde está el jugador, si todavía le falta alguna etapa. */
  function etapaEnCurso(): EtapaEnCurso | null {
    if (!partida || partida.fase !== 'jugando' || partida.lugar === 'porteria') return null;
    const n = etapaActual(partida, partida.lugar);
    const puzzle = puzzleDeSala(numeroDeSala(partida.lugar));
    return n === null || !puzzle ? null : { sala: partida.lugar, puzzle, etapa: n };
  }

  /**
   * La máquina respondió con esos ajustes: publica el resultado y, si resuelven la etapa,
   * avanza la partida. La etapa siguiente empieza con su estado inicial y sin intentos.
   */
  function responder(actual: EtapaEnCurso, estado: unknown, evaluacion: Evaluacion): void {
    if (!partida) return;
    if (evaluacion.resuelta) {
      partida = aplicar(partida, { t: 'resolver_etapa', sala: actual.sala, etapa: actual.etapa });
      pistasPorSala[actual.sala] = nuevaEtapa(pistasPorSala[actual.sala] ?? PISTAS_INICIALES);
      ajustes = sinSala(ajustes, actual.sala);
      reposos = sinSala(reposos, actual.sala);
    }
    resultado.value = {
      n: ++contadorResultados,
      sala: actual.sala,
      puzzle: actual.puzzle.id,
      etapa: actual.etapa,
      estado: copiar(estado),
      condiciones: evaluacion.condiciones,
      resuelta: evaluacion.resuelta,
      sello: evaluacion.resuelta && salaResuelta(partida, actual.sala),
    };
  }

  /**
   * Suma el tiempo de reloj activo que pasó en la etapa desde la última marca: a las pistas
   * y, en las etapas que responden en vivo, al reposo de los ajustes.
   */
  function contarTiempo(t: number): void {
    const actual = etapaEnCurso();
    if (marca !== null && actual) {
      const ms = t - marca;
      const { sala: s, puzzle, etapa: n } = actual;
      let e = avanzarTiempo(pistasPorSala[s] ?? PISTAS_INICIALES, puzzle.pistas, ms);
      const quieto = reposos[s];
      const estado = ajustes[s];
      let resuelve: Evaluacion | null = null;
      if (quieto?.pendiente && estado !== undefined) {
        const r = avanzarReposo(puzzle, n, estado, quieto, ms);
        reposos[s] = r.reposo;
        if (r.intento) {
          e = registrarIntento(e, puzzle.pistas);
        } else if (!r.reposo.pendiente) {
          // Se cumplió el reposo sin contar intento: o los ajustes resuelven la etapa, o
          // todavía no forman un resultado (libros sin repartir).
          const evaluacion = evaluar(puzzle, n, estado);
          if (evaluacion?.resuelta) resuelve = evaluacion;
        }
      }
      pistasPorSala[s] = e;
      if (resuelve) responder(actual, estado, resuelve);
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
      asignar(avance, p.etapas);
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
        // Un final borra el guardado (lo hace `guardar`): ya no hay nada que continuar.
        guardada.value = null;
      }
    });
  }

  /**
   * Un solo temporizador para lo próximo que debe pasar sin que nadie toque nada: que se
   * ofrezca la siguiente pista, que una máquina en vivo cumpla su reposo o que se acabe el
   * tiempo. Con el reloj detenido no hay nada que esperar.
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
      // En las etapas que responden en vivo, el momento en que se cumple el reposo.
      const regla = reglaDeIntento(actual.puzzle, actual.etapa);
      const quieto = reposos[actual.sala];
      if (regla?.tipo === 'reposo' && quieto?.pendiente) {
        espera = Math.min(espera, regla.segundos * 1000 - quieto.msQuieto);
      }
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
    let aceptada = false;
    cambiar(() => {
      // La partida se lee aquí adentro: al contar el tiempo pudo resolverse una etapa en vivo.
      if (!partida) return;
      const despues = aplicar(partida, accion);
      aceptada = despues !== partida;
      partida = despues;
    });
    return aceptada;
  }

  /** Guarda la partida en curso. Con datos de ejemplo no se guarda: no es una partida real. */
  function guardarPartida(): void {
    if (!almacen || !partida || conEjemplo.value) return;
    guardar(almacen, {
      v: VERSION_GUARDADO,
      partida,
      restanteMs: restante(reloj.value, ahora()),
      pistas: pistasPorSala,
      mecanismos: ajustes,
      notas: notas.value.map((n) => ({ id: n.id, texto: n.texto })),
      datos: [...datosEncontrados.value],
      inventario: inventario.value.map((o) => o.id),
    });
  }

  /** Le dice al menú si hay una partida guardada que se pueda continuar. */
  function mirarGuardado(): Guardado | null {
    const g = almacen ? cargar(almacen, PUZZLES) : null;
    guardada.value = g ? { restanteMs: g.restanteMs, sellos: sellosDe(g.partida).length } : null;
    return g;
  }

  function alVencer(): void {
    cambiar((t) => {
      if (partida && agotado(reloj.value, t)) partida = aplicar(partida, { t: 'tiempo_agotado' });
    });
    guardarPartida();
  }

  function alCambiarVisibilidad(): void {
    // Sin partida no hay reloj que detener; al empezar se vuelve a mirar si está oculta.
    if (!partida) return;
    cambiar(() => {
      if (documento?.hidden) motivos.add('oculta');
      else motivos.delete('oculta');
    });
    // Al ocultarse la pestaña puede que no haya otra oportunidad de guardar.
    guardarPartida();
  }

  /**
   * Empieza una partida individual: nueva (inventario vacío: la linterna y el cuaderno se
   * recogen en la portería) o, con `g`, la que estaba guardada. El tiempo con la pestaña
   * cerrada no cuenta: el reloj sigue desde lo que quedaba.
   */
  function empezar(g: Guardado | null): void {
    cambiar((t) => {
      partida = g ? g.partida : crearPartida();
      pistasPorSala = g ? { ...g.pistas } : {};
      ajustes = g ? { ...g.mecanismos } : {};
      reposos = {};
      // Las notas nuevas siguen la numeración guardada, para no repetir ids.
      contadorNotas = g ? Math.max(0, ...g.notas.map((n) => Number(n.id.slice(1)))) : 0;
      motivos.clear();
      if (documento?.hidden) motivos.add('oculta');
      batch(() => {
        reiniciarInterfaz();
        reiniciarPartida();
        reiniciarCuaderno();
        reiniciarMecanismo();
        modo.value = 'individual';
        fase.value = 'jugando';
        reloj.value = crearReloj(g ? g.restanteMs : DURACION_MS, t);
        if (g) {
          notas.value = g.notas;
          datosEncontrados.value = g.datos;
          // Un objeto que ya no existe en el contenido no vuelve al inventario.
          inventario.value = g.inventario.flatMap((id) => objetoDeInventario(id) ?? []);
          cuadernoActivo.value = g.inventario.includes(OBJETO_CUADERNO);
        }
      });
      // Si se guardó justo al acabarse el tiempo, no queda nada que jugar.
      if (g && g.restanteMs <= 0) partida = aplicar(partida, { t: 'tiempo_agotado' });
    });
  }

  function salir(): void {
    clearTimeout(temporizador);
    temporizador = undefined;
    partida = null;
    marca = null;
    motivos.delete('orden');
    // Salir es abandonar la partida («Se pierde lo que llevas»): también se borra lo guardado.
    if (almacen) borrarGuardado(almacen);
    guardada.value = null;
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
    // Los datos de ejemplo no son una partida: no dejan nada guardado que continuar.
    if (almacen) borrarGuardado(almacen);
    guardada.value = null;
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

  /** Usa un objeto. Devuelve si el objeto debe seguir enfocado después. */
  function usar(objeto: string): boolean {
    const destino = destinoDePuerta(objeto);
    if (destino === 'porteria') {
      jugar({ t: 'volver_porteria' });
      return false;
    }
    if (destino) {
      // Las salas se abren en orden (`salaAbierta`): una puerta cerrada no deja entrar.
      const estabaEnPorteria = partida?.lugar === 'porteria';
      if (!jugar({ t: 'entrar', sala: destino }) && estabaEnPorteria) {
        avisar({ t: 'puerta_cerrada', sala: numeroDeSala(destino) });
      }
      return false;
    }
    if (partida?.lugar !== 'porteria') {
      // En una sala, cualquier otro objeto que se usa es parte de su máquina: abre el panel
      // del mecanismo (el objeto 3D solo anima). El objeto sigue enfocado para volver a él.
      abrirPanel('mecanismo');
      return true;
    }
    // La puerta de salida muestra qué se puede elegir; el intercomunicador pide confirmar.
    if (objeto === OBJETO_SALIDA) abrirPanel('salida');
    if (objeto === OBJETO_INTERCOMUNICADOR) abrirPanel('ayuda');
    return false;
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
        // El objeto sigue enfocado: al cerrar la ficha, su botón «Examinar» vuelve a estar
        // ahí (y el foco vuelve a él), por si el jugador quiere leerla otra vez.
      } else if (accion === 'recoger') {
        recoger(actual);
        enfocado.value = null;
      } else if (!usar(objeto)) {
        enfocado.value = null;
      }
      enfocarSiguiente();
    });
  }

  function atender(comando: Comando): void {
    despachar(comando);
    // Se guarda después de cada orden (T31c). `salir` ya borró el guardado y dejó sin partida.
    guardarPartida();
  }

  function despachar(comando: Comando): void {
    switch (comando.t) {
      case 'iniciar':
        // El cooperativo aún no existe: solo se atiende el modo individual.
        if (comando.modo === 'individual') empezar(null);
        return;
      case 'continuar': {
        // Solo desde el menú, y solo si lo guardado sigue siendo válido.
        if (partida) return;
        const g = mirarGuardado();
        if (g) empezar(g);
        return;
      }
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
      case 'ajustar':
        cambiar(() => {
          // Los ajustes llegan de un panel: se revisan con las reglas de la etapa actual.
          const actual = etapaEnCurso();
          if (!actual || evaluar(actual.puzzle, actual.etapa, comando.estado) === null) return;
          if (iguales(ajustes[actual.sala], comando.estado)) return;
          ajustes[actual.sala] = copiar(comando.estado);
          // Las máquinas que responden en vivo empiezan a contar el reposo desde este cambio.
          if (reglaDeIntento(actual.puzzle, actual.etapa)?.tipo === 'reposo') {
            reposos[actual.sala] = alCambiarEstado();
          }
        });
        return;
      case 'accionar':
        cambiar(() => {
          const actual = etapaEnCurso();
          if (!actual) return;
          // Solo responde el objeto que confirma esta etapa (la palanca, la polea, la manija).
          const regla = reglaDeIntento(actual.puzzle, actual.etapa);
          if (regla?.tipo !== 'accionar' || regla.objeto !== comando.objeto) return;
          const estado = ajustes[actual.sala];
          const evaluacion = evaluar(actual.puzzle, actual.etapa, estado);
          if (!evaluacion) return;
          if (intentoAlAccionar(actual.puzzle, actual.etapa, comando.objeto, estado)) {
            const e = pistasPorSala[actual.sala] ?? PISTAS_INICIALES;
            pistasPorSala[actual.sala] = registrarIntento(e, actual.puzzle.pistas);
          }
          responder(actual, estado, evaluacion);
        });
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
          // Más notas de las que acepta el guardado harían que no se pudiera reanudar.
          if (!texto || notas.value.length >= MAX_NOTAS) return;
          notas.value = [...notas.value, { id: `n${++contadorNotas}`, texto }];
        } else {
          notas.value = notas.value.filter((n) => n.id !== comando.id);
        }
        return;
    }
  }

  const dejarDeEscuchar = escuchar(atender);
  documento?.addEventListener('visibilitychange', alCambiarVisibilidad);
  mirarGuardado();
  return () => {
    dejarDeEscuchar();
    documento?.removeEventListener('visibilitychange', alCambiarVisibilidad);
    clearTimeout(temporizador);
  };
}
