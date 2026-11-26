import { batch, type Signal } from '@preact/signals';
import { esObjetoSuelto, grabacionDeObjeto } from '../content/grabaciones';
import { PUZZLES, puzzleDeSala } from '../content/puzzles';
import type { Puzzle } from '../content/esquema';
import { fichasDeLugar } from '../content/fichas';
import { destinoDePuerta, fraseDePuertaFalsa, nombreDeObjeto } from '../content/salas';
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
  msParaReposo,
  reglaDeIntento,
  type Reposo,
} from '../game/intentos';
import {
  aplicar,
  crearPartida,
  etapaActual,
  numeroDeSala,
  opcionesDeFinal,
  salaResuelta,
  SALAS,
  sellos as sellosDe,
  tieneCincoSellos,
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
import { resumenDeAprendizaje } from '../game/aprendizaje';
import type { Evaluacion } from '../game/puzzles';
import { evaluar } from '../game/puzzles';
import { iguales } from '../game/puzzles/tipos';
import { agotado, crearReloj, pausar, reanudar, restante } from '../game/reloj';
import { fichas, type Ficha } from './contenido';
import { decir, reiniciarVoz } from './voz';
import {
  cuadernoActivo,
  datosEncontrados,
  limpiarNota,
  MAX_NOTAS,
  notas,
  reiniciarCuaderno,
} from './cuaderno';
import {
  abrirInspeccion,
  abrirPanel,
  avisar,
  cerrarPanel,
  enfocado,
  reiniciarInterfaz,
  type ObjetoEnfocado,
} from './interfaz';
import {
  condiciones,
  etapa,
  maquinaResuelta,
  mecanismo,
  pistas,
  pistasVistas,
  reiniciarMecanismo,
  resultado,
} from './mecanismo';
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
  aprendizaje,
  reiniciarPartida,
  reloj,
  sala,
  sellos,
  type ObjetoInventario,
} from './partida';
import { girarTelefono } from './pantalla';
import { tocarPuertaFalsa } from './puertas-falsas';
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
/** El reloj de la portería: al examinarlo, La Voz recuerda la hora (`voz-intro-3`). */
export const OBJETO_RELOJ = 'porteria-reloj';
/** Reloj activo sin tocar nada en una sala antes de que La Voz diga `voz-espera` (T34). */
export const ESPERA_VOZ_MS = 90_000;
/** Intento fallido de una etapa con el que La Voz dice `voz-fallo` (T34). */
export const INTENTO_VOZ_FALLO = 3;
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

/**
 * Las líneas de La Voz que no deben repetirse al continuar una partida guardada: la
 * presentación y, de cada sala con avance, su entrada y su sello. El guardado no las anota;
 * se deducen del avance.
 */
function lineasYaDichas(g: Guardado | null): Set<string> {
  const dichas = new Set<string>();
  if (!g) return dichas;
  for (const id of ['voz-intro-1', 'voz-intro-2', 'voz-intro-3']) dichas.add(id);
  const p = g.partida;
  for (const s of SALAS) {
    const n = numeroDeSala(s);
    if (p.etapas[s] > 0 || p.lugar === s) dichas.add(`voz-s${n}-entrar`);
    if (salaResuelta(p, s)) dichas.add(`voz-s${n}-sello`);
  }
  if (tieneCincoSellos(p)) dichas.add('voz-final');
  return dichas;
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
 * - `oculta`: la pestaña no se ve (otra app, pantalla bloqueada);
 * - `vertical`: el celular está en vertical y se ve el aviso de girarlo (T41b).
 */
type MotivoPausa = 'orden' | 'oculta' | 'vertical';

interface EtapaEnCurso {
  sala: SalaId;
  puzzle: Puzzle;
  etapa: number;
}

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
  /** Cómo quedó la máquina de cada sala resuelta en esta sesión de juego (T76). */
  let finales: Partial<Record<SalaId, unknown>> = {};
  /** En las etapas que responden en vivo: cuánto llevan quietos los ajustes de cada sala. */
  let reposos: Partial<Record<SalaId, Reposo>> = {};
  let contadorResultados = 0;
  /** Avance con el que se armaron las fichas publicadas. */
  let fichasDe: Partida['etapas'] | null = null;
  /** Instante desde el que corre tiempo de etapa sin contar todavía en las pistas. */
  let marca: number | null = null;
  let contadorNotas = 0;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  /** Líneas de La Voz que suenan una sola vez por partida y ya se pidieron (T34). */
  let dichas = new Set<string>();
  /** Reloj activo en una etapa sin que el jugador toque nada, para `voz-espera`. */
  let msSinTocar = 0;
  /** Etapas (`sala:etapa`) en las que ya sonó `voz-espera`: una vez por etapa. */
  let esperas = new Set<string>();

  /** Pide una línea de La Voz que suena una sola vez por partida. */
  function decirUnaVez(id: string): void {
    if (dichas.has(id)) return;
    dichas.add(id);
    decir(id);
  }

  /** Cuenta un intento fallido; al tercero de la etapa, La Voz anima a seguir probando. */
  function contarIntento(e: EstadoPistas, puzzle: Puzzle): EstadoPistas {
    const despues = registrarIntento(e, puzzle.pistas);
    if (despues.intentosEnEtapa === INTENTO_VOZ_FALLO) decir('voz-fallo');
    return despues;
  }

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
      // Con el sello, la máquina se queda como estaba al resolverse.
      if (salaResuelta(partida, actual.sala)) {
        finales[actual.sala] = copiar(estado);
        decirUnaVez(`voz-s${numeroDeSala(actual.sala)}-sello`);
      }
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
      // Mucho rato sin tocar nada en la sala: La Voz sugiere el cuaderno, una vez por etapa.
      msSinTocar += ms;
      if (msSinTocar >= ESPERA_VOZ_MS && !esperas.has(`${s}:${n}`)) {
        esperas.add(`${s}:${n}`);
        decir('voz-espera');
      }
      let e = avanzarTiempo(pistasPorSala[s] ?? PISTAS_INICIALES, puzzle.pistas, ms);
      const quieto = reposos[s];
      const estado = ajustes[s];
      let resuelve: Evaluacion | null = null;
      if (quieto?.pendiente && estado !== undefined) {
        const r = avanzarReposo(puzzle, n, estado, quieto, ms);
        reposos[s] = r.reposo;
        if (r.intento) e = contarIntento(e, puzzle);
        if (!r.reposo.pendiente) {
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

  /**
   * Lo que se lee al examinar cada objeto (T35c), de todas las salas a la vez: el cuaderno
   * muestra los datos encontrados en cualquiera. Algunas fichas cambian con la etapa de su
   * sala, así que se vuelven a armar solo cuando cambia el avance.
   */
  function publicarFichas(p: Partida): void {
    if (fichasDe === p.etapas) return;
    fichasDe = p.etapas;
    const todas: Record<string, Ficha> = { ...fichasDeLugar('porteria') };
    for (const s of SALAS) Object.assign(todas, fichasDeLugar(s, etapaActual(p, s)));
    asignar(fichas, todas);
  }

  /**
   * Los ajustes con los que quedó la máquina de la sala actual, si ya tiene sello: los que
   * se usaron al resolverla (también tras recargar) o, si no se saben (un guardado de antes
   * de guardarlos, o uno que no pasó la revisión), la solución de ejemplo de su última etapa.
   */
  function estadoConservado(p: Partida): unknown {
    if (p.lugar === 'porteria' || !salaResuelta(p, p.lugar)) return null;
    const ultima = puzzleDeSala(numeroDeSala(p.lugar))?.etapas.at(-1);
    return finales[p.lugar] ?? (ultima ? copiar(ultima.solucion) : null);
  }

  /** Copia la partida a los signals. */
  function publicar(): void {
    const p = partida;
    if (!p) return;
    batch(() => {
      sala.value = p.lugar;
      publicarFichas(p);
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
        maquinaResuelta.value = null;
      } else {
        asignar(maquinaResuelta, estadoConservado(p));
        etapa.value = null;
        mecanismo.value = null;
        asignar(condiciones, {});
      }
      const vistas = p.lugar === 'porteria' ? undefined : pistasPorSala[p.lugar];
      // En una sala ya resuelta se pueden releer las pistas abiertas, pero no se avisa de una
      // «nueva»: ya no hay nada que resolver con ella.
      const yaResuelta = p.lugar !== 'porteria' && salaResuelta(p, p.lugar);
      asignar(pistas, {
        ofrecidas: yaResuelta ? (vistas?.vistas ?? 0) : (vistas?.ofrecidas ?? 0),
        vistas: vistas?.vistas ?? 0,
      });
      asignar(
        pistasVistas,
        Object.fromEntries(
          SALAS.flatMap((s) => {
            const n = pistasPorSala[s]?.vistas ?? 0;
            return n > 0 ? [[s, n]] : [];
          }),
        ),
      );

      if (p.fase === 'final') {
        cerrarPanel();
        // Lo que aprendió en cada sala, con las pistas que abrió (punto 15 del hito 1).
        aprendizaje.value = resumenDeAprendizaje(p, pistasPorSala);
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
      // El momento en que La Voz diría `voz-espera`, si aún no lo dijo en esta etapa.
      if (!esperas.has(`${actual.sala}:${actual.etapa}`)) {
        espera = Math.min(espera, ESPERA_VOZ_MS - msSinTocar);
      }
      // En las etapas que responden en vivo, el momento en que se mira el resultado (y cuenta
      // el intento) o en que se cumple el reposo.
      const quieto = reposos[actual.sala];
      const reposo = quieto ? msParaReposo(actual.puzzle, actual.etapa, quieto) : null;
      if (reposo !== null) espera = Math.min(espera, reposo);
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

  /** Guarda la partida en curso. */
  function guardarPartida(): void {
    if (!almacen || !partida) return;
    guardar(almacen, {
      v: VERSION_GUARDADO,
      partida,
      restanteMs: restante(reloj.value, ahora()),
      pistas: pistasPorSala,
      mecanismos: ajustes,
      resueltas: finales,
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
      // Cómo quedó cada máquina resuelta, también tras recargar (decisión 11 del hito 1).
      finales = g ? { ...g.resueltas } : {};
      msSinTocar = 0;
      esperas = new Set();
      dichas = lineasYaDichas(g);
      // Las notas nuevas siguen la numeración guardada, para no repetir ids.
      contadorNotas = g ? Math.max(0, ...g.notas.map((n) => Number(n.id.slice(1)))) : 0;
      motivos.clear();
      if (documento?.hidden) motivos.add('oculta');
      if (girarTelefono.peek()) motivos.add('vertical');
      batch(() => {
        reiniciarInterfaz();
        reiniciarPartida();
        reiniciarCuaderno();
        reiniciarMecanismo();
        reiniciarVoz();
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
      // Una partida nueva empieza con la puerta que se cierra y La Voz presentándose.
      if (!g) {
        decirUnaVez('voz-intro-1');
        decirUnaVez('voz-intro-2');
      }
      // Si se guardó justo al acabarse el tiempo, no queda nada que jugar.
      if (g && g.restanteMs <= 0) partida = aplicar(partida, { t: 'tiempo_agotado' });
    });
  }

  function salir(): void {
    // En cooperativo este controlador no tiene partida: no hay nada suyo que borrar, y la
    // partida individual guardada sigue ahí.
    const habia = partida !== null;
    clearTimeout(temporizador);
    temporizador = undefined;
    partida = null;
    fichasDe = null;
    marca = null;
    motivos.delete('orden');
    // Salir es abandonar la partida («Se pierde lo que llevas»): también se borra lo guardado.
    if (almacen && habia) {
      borrarGuardado(almacen);
      guardada.value = null;
    }
    batch(() => {
      fichas.value = {};
      reiniciarInterfaz();
      reiniciarPartida();
      reiniciarCuaderno();
      reiniciarMecanismo();
      reiniciarVoz();
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
    // Los papeles que se recogen también se leen: quedan en «Datos encontrados».
    if (fichas.value[objeto.id]) anotarDato(objeto.id);
  }

  function anotarDato(objeto: string): void {
    if (!datosEncontrados.value.includes(objeto)) {
      datosEncontrados.value = [...datosEncontrados.value, objeto];
    }
  }

  /** Usa un objeto. Devuelve si el objeto debe seguir enfocado después. */
  function usar(objeto: string): boolean {
    const destino = destinoDePuerta(objeto);
    if (destino === 'porteria') {
      jugar({ t: 'volver_porteria' });
      // Con los cinco sellos, al volver a la portería La Voz plantea la elección.
      if (partida && tieneCincoSellos(partida)) decirUnaVez('voz-final');
      return false;
    }
    if (destino) {
      // Las salas se abren en orden (`salaAbierta`): una puerta cerrada no deja entrar.
      const estabaEnPorteria = partida?.lugar === 'porteria';
      if (jugar({ t: 'entrar', sala: destino })) {
        decirUnaVez(`voz-s${numeroDeSala(destino)}-entrar`);
      } else if (estabaEnPorteria) {
        avisar({ t: 'puerta_cerrada', sala: numeroDeSala(destino) });
      }
      return false;
    }
    // Las puertas falsas del pasillo no abren: picaporte y una frase corta.
    const falsa = fraseDePuertaFalsa(objeto);
    if (falsa) {
      tocarPuertaFalsa(falsa, dichas);
      return false;
    }
    if (partida?.lugar !== 'porteria') {
      // Los escondites de las grabaciones no son parte de la máquina (T75): al usarlos se
      // recoge la grabación (la regla solo la acepta en su sala y una vez) y se muestra.
      const escondida = grabacionDeObjeto(objeto);
      if (escondida) {
        jugar({ t: 'recoger_grabacion', grabacion: escondida.id });
        abrirPanel('grabacion');
        return true;
      }
      // Los balones que sí rebotan tampoco: el motor los anima y no pasa nada más.
      if (esObjetoSuelto(objeto)) return true;
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
        if (objeto === OBJETO_RELOJ) decirUnaVez('voz-intro-3');
        // Lo que se inspecciona queda anotado en «Datos encontrados» del cuaderno.
        anotarDato(objeto);
        // El objeto sigue enfocado: al cerrar la ficha, su botón «Examinar» vuelve a estar
        // ahí (y el foco vuelve a él), por si el jugador quiere leerla otra vez.
      } else if (accion === 'recoger') {
        recoger(actual);
        enfocado.value = null;
      } else if (!usar(objeto)) {
        enfocado.value = null;
      }
    });
  }

  function atender(comando: Comando): void {
    despachar(comando);
    // El jugador hizo algo: la espera de `voz-espera` vuelve a empezar.
    if (['accion', 'ajustar', 'accionar', 'ver_pista', 'nota'].includes(comando.t)) msSinTocar = 0;
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
            pistasPorSala[actual.sala] = contarIntento(e, actual.puzzle);
          }
          responder(actual, estado, evaluacion);
        });
        return;
      case 'ver_pista': {
        const lugar = partida?.fase === 'jugando' ? partida.lugar : 'porteria';
        if (lugar === 'porteria') return;
        // Primero se cuenta el tiempo (puede ofrecer una pista nueva) y luego se abre.
        cambiar(() => {
          // Con el sello ya no se abren pistas nuevas: no queda nada que resolver (T76).
          if (!partida || salaResuelta(partida, lugar)) return;
          const e = pistasPorSala[lugar];
          if (e) pistasPorSala[lugar] = verPista(e);
        });
        return;
      }
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
  // Con el celular en vertical el reloj se detiene mientras se ve el aviso de girarlo (T41b).
  const dejarDeMirarOrientacion = girarTelefono.subscribe((vertical) => {
    if (!partida) return;
    cambiar(() => {
      if (vertical) motivos.add('vertical');
      else motivos.delete('vertical');
    });
  });
  mirarGuardado();
  return () => {
    dejarDeEscuchar();
    dejarDeMirarOrientacion();
    documento?.removeEventListener('visibilitychange', alCambiarVisibilidad);
    clearTimeout(temporizador);
  };
}
