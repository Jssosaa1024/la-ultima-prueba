import { batch, type Signal } from '@preact/signals';
import type { Puzzle } from '../content/esquema';
import { fichasDeLugar } from '../content/fichas';
import { grabacionDeObjeto, esObjetoSuelto } from '../content/grabaciones';
import { puzzleDeSala } from '../content/puzzles';
import { destinoDePuerta, nombreDeObjeto, SALAS_3D } from '../content/salas';
import { resumenDeAprendizaje } from '../game/aprendizaje';
import type { Directo, Evento, Foto, Intencion } from '../game/coop/mensajes';
import { esRecogible, lugarInicial, puzzlePorId, REQUIERE_HERRAMIENTA } from '../game/coop/mundo';
import { repartoDeFoto } from '../game/coop/replica';
import {
  aplicar,
  etapaActual,
  numeroDeSala,
  opcionesDeFinal,
  salaResuelta,
  SALAS,
  sellos as sellosDe,
  type Lugar,
  type Partida,
  type SalaId,
} from '../game/partida';
import type { EstadoPistas } from '../game/pistas';
import { evaluar } from '../game/puzzles';
import { iguales } from '../game/puzzles/tipos';
import { reglaDeIntento } from '../game/intentos';
import { fichas, type Ficha } from './contenido';
import {
  esperaD,
  miPosicion,
  misRoles,
  objetosFuera,
  propuestaCoop,
  reparto,
  rolesDe,
  senales,
  votosCoop,
  type Frase,
  type SenalCoop,
} from './coop';
import { cuadernoActivo, datosEncontrados, limpiarNota, MAX_NOTAS, notas } from './cuaderno';
import {
  abrirInspeccion,
  abrirPanel,
  avisar,
  cerrarPanel,
  enfocado,
  panel,
  type ObjetoEnfocado,
} from './interfaz';
import {
  condiciones,
  etapa,
  maquinaResuelta,
  mecanismo,
  pistas,
  pistasVistas,
  resultado,
} from './mecanismo';
import {
  aprendizaje,
  avance,
  fase,
  final,
  grabaciones,
  inventario,
  opcionesFinal,
  reloj,
  sala,
  sellos,
  type ObjetoInventario,
} from './partida';
import type { Comando } from './puente';
import { decir } from './voz';

/**
 * La partida cooperativa en este navegador (T84b): copia la foto del anfitrión a los mismos
 * signals que usa el modo individual y convierte las órdenes de la interfaz en intenciones.
 * Nada cambia la partida aquí: solo el anfitrión decide, y lo decidido llega como eventos.
 *
 * Lo único local: los ajustes que quien tiene D está probando en su panel antes de
 * proponerlos (el borrador), las notas del cuaderno (no viajan por la red) y cómo quedó cada
 * máquina resuelta.
 */

/** Objetos con papel fijo en la portería (los mismos del controlador individual). */
const OBJETO_SALIDA = 'porteria-salida';
const OBJETO_INTERCOMUNICADOR = 'porteria-intercomunicador';
const OBJETO_CUADERNO = 'porteria-cuaderno';

const copiar = (x: unknown): unknown => JSON.parse(JSON.stringify(x)) as unknown;

function asignar<T>(s: Signal<T>, valor: T): void {
  if (!iguales(s.value, valor)) s.value = valor;
}

/** La partida de la foto, con la forma de `game/partida.ts`. */
export function partidaDeFoto(f: Foto): Partida {
  const etapas = Object.fromEntries(SALAS.map((s, i) => [s, f.etapas[i] ?? 0])) as Record<
    SalaId,
    number
  >;
  return {
    fase: f.fase === 'final' ? 'final' : 'jugando',
    lugar: f.lugar,
    etapas,
    final: f.final,
    grabaciones: [...f.grabaciones],
  };
}

/** Las pistas de la foto por sala, como las guarda el modo individual. */
export function pistasDeFoto(f: Foto): Partial<Record<SalaId, EstadoPistas>> {
  const r: Partial<Record<SalaId, EstadoPistas>> = {};
  SALAS.forEach((s, i) => {
    const p = f.pistas[i];
    if (p) {
      r[s] = {
        ofrecidas: p.ofrecidas,
        vistas: p.vistas,
        msEnEtapa: p.ms,
        intentosEnEtapa: p.intentos,
      };
    }
  });
  return r;
}

function objetoDeInventario(id: string): ObjetoInventario | null {
  const nombre = nombreDeObjeto(id);
  return nombre ? { id, nombre } : null;
}

/** El grupo puede ir a ese lugar (pasando por la portería si hace falta), como `moverA` del anfitrión. */
export function puedeIrA(p: Partida, destino: Lugar): boolean {
  if (destino === p.lugar) return false;
  const enPorteria = p.lugar === 'porteria' ? p : aplicar(p, { t: 'volver_porteria' });
  if (destino === 'porteria') return enPorteria !== p;
  return aplicar(enPorteria, { t: 'entrar', sala: destino }) !== enPorteria;
}

/** Una señal como máximo cada este tiempo (protocolo, `senal`). */
export const SENAL_CADA_MS = 1000;
/** Cuántas señales recientes se guardan para la interfaz y el motor. */
const MAX_SENALES = 8;

/** Centro de un objeto de la sala, en metros, o null si no existe. */
export function centroDeObjeto(id: string): { x: number; y: number; z: number } | null {
  for (const sala of SALAS_3D) {
    const o = sala.objetos.find((x) => x.id === id);
    if (o) return { x: o.pos[0], y: o.pos[1] + o.tam[1] / 2, z: o.pos[2] };
  }
  return null;
}

/** Metros a cm enteros dentro de lo que acepta el protocolo (±100 m). */
const cm = (m: number): number => Math.max(-10_000, Math.min(10_000, Math.round(m * 100)));

interface EtapaEnCurso {
  sala: SalaId;
  puzzle: Puzzle;
  etapa: number;
}

export class JuegoCoop {
  /** Ajustes que quien tiene D está probando, por sala, antes de proponerlos. */
  private borrador: Partial<Record<SalaId, unknown>> = {};
  /** Cómo quedó cada máquina resuelta en esta partida. */
  private resueltas: Partial<Record<SalaId, unknown>> = {};
  /** Estado de cada propuesta vista, para mostrar con qué respondió la máquina. */
  private readonly propuestas = new Map<number, unknown>();
  private ultimaPropuesta: number | null = null;
  private contadorResultados = 0;
  private contadorNotas = 0;
  private fichasDe: string | null = null;
  private readonly dichas = new Set<string>();
  private foto: Foto | null = null;

  private ultimaSenal = -Infinity;
  private contadorSenales = 0;

  constructor(
    readonly yo: string,
    private readonly enviarIntencion: (i: Intencion) => void,
    private readonly enviarDirecto: (d: Directo) => void = () => undefined,
  ) {}

  /** Llega una señal de otro jugador (ya validada por `net/`). */
  alSenal(jugador: string, p: Extract<Directo, { t: 'senal' }>['p']): void {
    const f = this.foto;
    if (!f || f.fase !== 'jugando' || !f.orden.includes(jugador)) return;
    this.guardarSenal(jugador, p);
  }

  private guardarSenal(jugador: string, p: Extract<Directo, { t: 'senal' }>['p']): void {
    const nueva: SenalCoop = {
      n: ++this.contadorSenales,
      jugador,
      ...p,
      frase: p.frase as Frase | null,
      en: performance.now(),
    };
    senales.value = [...senales.value, nueva].slice(-MAX_SENALES);
  }

  /** Señala el objeto enfocado (o el lugar del jugador) con una frase, o sin ella (T91). */
  private senalar(f: Foto, frase: Frase | null): void {
    const t = performance.now();
    if (t - this.ultimaSenal < SENAL_CADA_MS) return;
    this.ultimaSenal = t;
    const objeto = enfocado.peek();
    const punto = (objeto && centroDeObjeto(objeto.id)) ?? miPosicion.peek();
    const s = f.lugar === 'porteria' ? 0 : numeroDeSala(f.lugar);
    const p = {
      s,
      x: punto ? cm(punto.x) : 0,
      y: punto ? cm(punto.y) : 0,
      z: punto ? cm(punto.z) : 0,
      frase,
    };
    this.enviarDirecto({ t: 'senal', p });
    this.guardarSenal(this.yo, p);
  }

  private decirUnaVez(id: string): void {
    if (this.dichas.has(id)) return;
    this.dichas.add(id);
    decir(id);
  }

  private etapaEnCurso(f: Foto): EtapaEnCurso | null {
    if (f.fase !== 'jugando' || f.lugar === 'porteria') return null;
    const p = partidaDeFoto(f);
    const n = etapaActual(p, f.lugar);
    const puzzle = puzzleDeSala(numeroDeSala(f.lugar));
    return n === null || !puzzle ? null : { sala: f.lugar, puzzle, etapa: n };
  }

  /** Este jugador tiene D en la sala actual (y nadie lo está esperando). */
  soyD(): boolean {
    return misRoles.peek().includes('D') && esperaD.peek() === null;
  }

  /** Al empezar la partida. */
  empezar(): void {
    cuadernoActivo.value = true;
    this.decirUnaVez('voz-intro-1');
    this.decirUnaVez('voz-intro-2');
  }

  /** Copia la foto (ya con el evento `e` aplicado) a los signals. */
  publicar(f: Foto, e?: Evento): void {
    const antes = this.foto;
    this.foto = f;
    if (f.propuesta) this.propuestas.set(f.propuesta.id, copiar(f.propuesta.estado));
    if (e?.t === 'propuesta') {
      this.propuestas.set(e.p.id, copiar(e.p.estado));
      this.ultimaPropuesta = e.p.id;
    }
    if (f.propuesta) this.ultimaPropuesta = f.propuesta.id;
    const p = partidaDeFoto(f);
    batch(() => {
      if (e?.t === 'resultado') this.alResultado(e.p, p);
      sala.value = f.lugar;
      this.publicarFichas(p);
      asignar(sellos, sellosDe(p));
      asignar(avance, p.etapas);
      asignar(grabaciones, p.grabaciones);
      asignar(opcionesFinal, opcionesDeFinal(p));
      asignar(
        inventario,
        f.objetos
          .filter((o) => o.portador === this.yo && o.objeto !== OBJETO_CUADERNO)
          .flatMap((o) => objetoDeInventario(o.objeto) ?? []),
      );
      // T84c: lo que alguien lleva, o quedó en otro lugar, no se ve donde lo puso la sala.
      asignar(
        objetosFuera,
        f.objetos
          .filter((o) => o.portador !== null || o.sala !== lugarInicial(o.objeto))
          .map((o) => o.objeto),
      );
      asignar(datosEncontrados, f.revelados);
      // El reloj solo se corrige con lo que lo trae (y al empezar). Copiarlo en cada
      // publicación lo dejaría quieto entre una foto y la siguiente.
      if (!antes || e?.t === 'inicio' || e?.t === 'reloj' || e?.t === 'estado') {
        reloj.value = {
          restanteMs: f.reloj.restante_ms,
          pausado: f.reloj.pausado,
          desde: performance.now(),
        };
      }
      this.publicarRoles(f);
      this.publicarMecanismo(f, p);
      if (e?.t === 'grabacion' && e.p.por === this.yo) abrirPanel('grabacion');
      // La Voz al entrar por primera vez a cada sala.
      if (f.lugar !== 'porteria' && antes?.lugar !== f.lugar) {
        this.decirUnaVez(`voz-s${numeroDeSala(f.lugar)}-entrar`);
      }
      if (f.fase === 'final' && f.final) {
        cerrarPanel();
        aprendizaje.value = resumenDeAprendizaje(p, pistasDeFoto(f));
        final.value = f.final;
        fase.value = 'final';
      }
    });
  }

  private publicarFichas(p: Partida): void {
    const clave = JSON.stringify(p.etapas);
    if (this.fichasDe === clave) return;
    this.fichasDe = clave;
    const todas: Record<string, Ficha> = { ...fichasDeLugar('porteria') };
    for (const s of SALAS) Object.assign(todas, fichasDeLugar(s, etapaActual(p, s)));
    asignar(fichas, todas);
  }

  private publicarRoles(f: Foto): void {
    const r = repartoDeFoto(f);
    asignar(reparto, r?.reparto ?? null);
    asignar(misRoles, rolesDe(r?.reparto ?? null, this.yo));
    const espera = r?.esperandoA
      ? { jugador: r.esperandoA, faltanMs: r.faltanMs, desde: performance.now() }
      : null;
    // Solo se reescribe si cambia quién falta: la cuenta regresiva la lleva la interfaz.
    if (espera?.jugador !== esperaD.peek()?.jugador) esperaD.value = espera;
    asignar(
      votosCoop,
      f.votos.map((v) => ({ asunto: v.asunto, opcion: v.opcion, votos: [...v.votos] })),
    );
    asignar(
      propuestaCoop,
      f.propuesta && {
        id: f.propuesta.id,
        puzzle: f.propuesta.puzzle,
        etapa: f.propuesta.etapa,
        por: f.propuesta.por,
        estado: f.propuesta.estado,
        aceptan: f.propuesta.votos.filter((v) => v.acepta).map((v) => v.jugador),
      },
    );
  }

  private publicarMecanismo(f: Foto, p: Partida): void {
    const actual = this.etapaEnCurso(f);
    const inicial = actual?.puzzle.etapas[actual.etapa]?.estado_inicial;
    if (actual && inicial !== undefined) {
      const abierta =
        f.propuesta && f.propuesta.puzzle === actual.puzzle.id && f.propuesta.etapa === actual.etapa
          ? f.propuesta.estado
          : undefined;
      // Quien tiene D ve su borrador; los demás ven la propuesta abierta (o el inicio).
      const propio = this.borrador[actual.sala];
      const estado = this.soyD() ? (propio ?? abierta ?? inicial) : (abierta ?? inicial);
      asignar(etapa, { sala: actual.sala, puzzle: actual.puzzle.id, etapa: actual.etapa });
      asignar(mecanismo, estado);
      asignar(condiciones, evaluar(actual.puzzle, actual.etapa, estado)?.condiciones ?? {});
      maquinaResuelta.value = null;
    } else {
      const lugar = f.lugar;
      const resuelta = lugar !== 'porteria' && salaResuelta(p, lugar);
      const ultima = resuelta ? puzzleDeSala(numeroDeSala(lugar))?.etapas.at(-1) : undefined;
      asignar(
        maquinaResuelta,
        resuelta ? (this.resueltas[lugar] ?? (ultima ? copiar(ultima.solucion) : null)) : null,
      );
      etapa.value = null;
      mecanismo.value = null;
      asignar(condiciones, {});
    }
    const i = SALAS.indexOf(f.lugar as SalaId);
    const vistas = i < 0 ? undefined : f.pistas[i];
    const yaResuelta = f.lugar !== 'porteria' && salaResuelta(p, f.lugar);
    asignar(pistas, {
      ofrecidas: yaResuelta ? (vistas?.vistas ?? 0) : (vistas?.ofrecidas ?? 0),
      vistas: vistas?.vistas ?? 0,
    });
    // Las pistas que abrió cualquiera del grupo, para el cuaderno de todos (T86).
    asignar(
      pistasVistas,
      Object.fromEntries(
        SALAS.flatMap((s, k) => {
          const n = f.pistas[k]?.vistas ?? 0;
          return n > 0 ? [[s, n]] : [];
        }),
      ),
    );
  }

  private alResultado(r: Extract<Evento, { t: 'resultado' }>['p'], p: Partida): void {
    const puzzle = puzzlePorId(r.puzzle);
    const s = puzzle ? SALAS[puzzle.sala - 1] : undefined;
    if (!puzzle || !s) return;
    const estado =
      this.ultimaPropuesta !== null ? this.propuestas.get(this.ultimaPropuesta) : undefined;
    if (r.resuelta) {
      this.borrador = Object.fromEntries(Object.entries(this.borrador).filter(([k]) => k !== s));
      if (r.sello) {
        this.resueltas[s] = copiar(estado);
        this.decirUnaVez(`voz-s${puzzle.sala}-sello`);
      }
    }
    resultado.value = {
      n: ++this.contadorResultados,
      sala: s,
      puzzle: r.puzzle,
      etapa: r.etapa,
      estado: copiar(estado ?? null),
      condiciones: r.condiciones,
      resuelta: r.resuelta,
      sello: r.sello && salaResuelta(p, s),
    };
  }

  // ——— Órdenes de la interfaz ———

  /** Atiende una orden del puente. Devuelve si era del juego (no de la conexión). */
  atender(c: Comando): void {
    const f = this.foto;
    if (!f || f.fase !== 'jugando') return;
    switch (c.t) {
      case 'accion':
        this.accion(f, c.objeto, c.accion);
        return;
      case 'ajustar': {
        const actual = this.etapaEnCurso(f);
        if (!actual || !this.soyD()) return;
        if (evaluar(actual.puzzle, actual.etapa, c.estado) === null) return;
        this.borrador[actual.sala] = copiar(c.estado);
        this.publicar(f);
        return;
      }
      case 'accionar': {
        const actual = this.etapaEnCurso(f);
        const regla = actual && reglaDeIntento(actual.puzzle, actual.etapa);
        if (regla?.tipo !== 'accionar' || regla.objeto !== c.objeto) return;
        this.proponer(f);
        return;
      }
      case 'proponer':
        this.proponer(f);
        return;
      case 'confirmar':
        if (f.propuesta) {
          this.enviarIntencion({
            t: 'confirmar',
            p: { propuesta: f.propuesta.id, acepta: c.acepta },
          });
        }
        return;
      case 'votar':
        this.enviarIntencion({
          t: 'votar',
          p: { asunto: c.asunto, opcion: c.opcion, acepta: c.acepta },
        });
        return;
      case 'elegir_final':
        // En grupo es un voto: el panel se cierra y la votación sigue en el HUD (T87).
        this.enviarIntencion({
          t: 'votar',
          p: { asunto: 'final', opcion: c.opcion, acepta: true },
        });
        cerrarPanel();
        return;
      case 'pedir_ayuda':
        this.enviarIntencion({ t: 'votar', p: { asunto: 'ayuda', opcion: null, acepta: true } });
        cerrarPanel();
        return;
      case 'ver_pista': {
        const actual = this.etapaEnCurso(f);
        if (actual) this.enviarIntencion({ t: 'pedir_pista', p: { puzzle: actual.puzzle.id } });
        return;
      }
      case 'senal':
        this.senalar(f, c.frase);
        return;
      case 'nota':
        if (c.op === 'agregar') {
          const texto = limpiarNota(c.texto);
          if (!texto || notas.value.length >= MAX_NOTAS) return;
          notas.value = [...notas.value, { id: `n${++this.contadorNotas}`, texto }];
        } else {
          notas.value = notas.value.filter((n) => n.id !== c.id);
        }
        return;
      default:
        // `pausar` y `reanudar` los manda el cuaderno al abrirse: en grupo el reloj solo se
        // detiene por votación.
        return;
    }
  }

  private proponer(f: Foto): void {
    const actual = this.etapaEnCurso(f);
    if (!actual || !this.soyD()) return;
    const estado = this.borrador[actual.sala] ?? actual.puzzle.etapas[actual.etapa]?.estado_inicial;
    if (estado === undefined || evaluar(actual.puzzle, actual.etapa, estado) === null) return;
    this.enviarIntencion({
      t: 'proponer',
      p: { puzzle: actual.puzzle.id, etapa: actual.etapa, estado: copiar(estado) },
    });
  }

  private accion(f: Foto, objeto: string, accion: ObjetoEnfocado['accion']): void {
    const actual = enfocado.value;
    if (!actual || actual.id !== objeto || actual.accion !== accion) return;
    batch(() => {
      if (accion === 'examinar') {
        this.examinar(f, objeto);
      } else if (accion === 'recoger') {
        // El cuaderno: en grupo cada uno ya tiene el suyo.
        if (objeto !== OBJETO_CUADERNO && esRecogible(objeto)) {
          this.enviarIntencion({ t: 'recoger', p: { objeto } });
        }
        enfocado.value = null;
      } else if (!this.usar(f, objeto)) {
        enfocado.value = null;
      }
    });
  }

  /**
   * Examinar abre la ficha y la anota en el cuaderno de todos (`usar` sin herramienta). Lo que
   * pide una herramienta (la pizarra en penumbra) solo se lee si alguien la usó ya, o si este
   * jugador la lleva: entonces la usa.
   */
  private examinar(f: Foto, objeto: string): void {
    const pide = REQUIERE_HERRAMIENTA[objeto];
    const revelado = f.revelados.includes(objeto);
    if (pide !== undefined && !revelado) {
      const laLlevo = f.objetos.some((o) => o.objeto === pide && o.portador === this.yo);
      if (!laLlevo) {
        avisar({ t: 'necesita_herramienta', objeto, herramienta: pide });
        return;
      }
      this.enviarIntencion({ t: 'usar', p: { herramienta: pide, objetivo: objeto } });
    } else if (!revelado) {
      this.enviarIntencion({ t: 'usar', p: { herramienta: null, objetivo: objeto } });
    }
    abrirInspeccion(objeto);
  }

  /** Usa un objeto. Devuelve si el objeto debe seguir enfocado después. */
  private usar(f: Foto, objeto: string): boolean {
    const p = partidaDeFoto(f);
    const destino = destinoDePuerta(objeto);
    if (destino) {
      // En grupo, cruzar una puerta es proponer ir a ese lugar: todos votan (T87).
      if (!puedeIrA(p, destino)) {
        if (destino !== 'porteria') avisar({ t: 'puerta_cerrada', sala: numeroDeSala(destino) });
        return false;
      }
      this.enviarIntencion({ t: 'votar', p: { asunto: 'sala', opcion: destino, acepta: true } });
      return false;
    }
    if (f.lugar !== 'porteria') {
      const escondida = grabacionDeObjeto(objeto);
      if (escondida) {
        if (p.grabaciones.includes(escondida.id)) abrirPanel('grabacion');
        else this.enviarIntencion({ t: 'usar', p: { herramienta: null, objetivo: objeto } });
        return true;
      }
      if (esObjetoSuelto(objeto)) return true;
      abrirPanel('mecanismo');
      return true;
    }
    if (objeto === OBJETO_SALIDA) abrirPanel('salida');
    if (objeto === OBJETO_INTERCOMUNICADOR) abrirPanel('ayuda');
    return false;
  }

  /** Al salir de la partida. */
  reiniciar(): void {
    if (panel.peek() !== null) cerrarPanel();
  }
}
