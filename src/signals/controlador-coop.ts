import { batch, effect } from '@preact/signals';
import type { Evento } from '../game/coop/mensajes';
import {
  ClienteCoop,
  crearCodigo,
  crearTransporte,
  directo,
  elegirRed,
  entornoDelBuild,
  jugadorDelNavegador,
  leerCodigo,
  VERSION_CONTENIDO,
  type Identidad,
  type Transporte,
} from '../net';
import { fichas } from './contenido';
import { coop, jugadoresDeFoto, reiniciarCoop, soloEntrePestanas, type ErrorCoop } from './coop';
import { reiniciarCuaderno } from './cuaderno';
import { reiniciarInterfaz } from './interfaz';
import { JuegoCoop } from './juego-coop';
import { reiniciarMecanismo } from './mecanismo';
import { fase, modo, reiniciarPartida } from './partida';
import { poseParaEnviar, recibirPose, reiniciarPoses } from './poses';
import { reiniciarVoz } from './voz';
import { escuchar, type Comando } from './puente';

/**
 * Controlador del modo cooperativo (T32, T81 y siguientes).
 *
 * Igual que el controlador individual, es el único que escribe los signals de la partida
 * mientras se juega en grupo, pero no decide nada: envía intenciones al anfitrión por la red
 * (`net/cliente.ts`) y copia a los signals lo que el anfitrión ya decidió. El controlador
 * individual no hace nada en cooperativo porque no tiene partida.
 *
 * La red se elige con `net/`: Supabase si está configurado, o BroadcastChannel entre pestañas
 * (`?red=pestanas` o sin variables).
 */

/** Si en este tiempo no llega la foto del anfitrión, la partida no existe (o no hay nadie). */
export const ESPERA_UNION_MS = 10_000;

export interface OpcionesCoop {
  /** Por defecto, el transporte que elige `net/` según el build y la URL. */
  crearTransporte?: () => Promise<Transporte>;
  /** Dónde se guarda el id del jugador. Por defecto, `sessionStorage` (uno por pestaña). */
  almacen?: Storage | null;
  /** Por defecto, `location.search`. */
  busqueda?: string;
  /** Reloj de la red (ms). Por defecto, `Date.now`; las pruebas usan el de la red en memoria. */
  ahora?: () => number;
}

/**
 * `sessionStorage`: el id vale para esta pestaña y sobrevive a recargarla (T89), y dos
 * pestañas del mismo navegador son dos jugadores distintos (las pruebas e2e lo necesitan).
 */
function almacenDePestana(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function iniciarControladorCoop(opciones: OpcionesCoop = {}): () => void {
  const busqueda = opciones.busqueda ?? (typeof location === 'undefined' ? '' : location.search);
  const almacen = opciones.almacen !== undefined ? opciones.almacen : almacenDePestana();
  const nuevoTransporte =
    opciones.crearTransporte ?? (() => crearTransporte(elegirRed(entornoDelBuild(), busqueda)));

  let cliente: ClienteCoop | null = null;
  /** La partida en este navegador, desde que empieza (T84b). */
  let juego: JuegoCoop | null = null;
  /** Alias y color de cada jugador visto en Presence, para quien se desconecta. */
  const conocidos = new Map<string, Identidad>();
  const quitar: (() => void)[] = [];
  let intervalo: ReturnType<typeof setInterval> | undefined;
  let esperaUnion: ReturnType<typeof setTimeout> | undefined;
  /** Sube con cada conexión: lo que termina tarde de una conexión vieja se descarta. */
  let generacion = 0;

  function limpiar(): void {
    generacion++;
    clearInterval(intervalo);
    clearTimeout(esperaUnion);
    intervalo = undefined;
    esperaUnion = undefined;
    for (const q of quitar.splice(0)) q();
    const viejo = cliente;
    cliente = null;
    juego = null;
    conocidos.clear();
    if (viejo) void viejo.salir().catch(() => undefined);
  }

  function fallar(error: ErrorCoop): void {
    const codigo = coop.peek().codigo;
    limpiar();
    coop.value = { ...coop.peek(), estado: 'error', error, codigo, jugadores: [] };
  }

  /** Copia a los signals lo que sabe el cliente. */
  function publicar(e?: Evento): void {
    const c = cliente;
    if (!c) return;
    if (c.rechazo) {
      fallar(c.rechazo);
      return;
    }
    const foto = c.foto;
    if (!foto) return;
    clearTimeout(esperaUnion);
    for (const id of c.presentes) conocidos.set(id.jugador, id);
    const jugadores = jugadoresDeFoto(foto, c.presentes, conocidos, c.yo);
    // Quien no entró al orden de la partida (llegó quinto o tarde) recibe su `rechazo`.
    const enLaPartida = foto.orden.includes(c.yo);
    const estado = foto.fase === 'espera' ? 'espera' : enLaPartida ? 'jugando' : 'conectando';
    batch(() => {
      coop.value = {
        ...coop.peek(),
        estado,
        error: null,
        jugadores,
        soyAnfitrion: foto.anfitrion === c.yo,
      };
      if (estado === 'jugando') {
        if (fase.peek() === 'inicio') {
          // Empieza la partida: todo en cero, como en el modo individual.
          reiniciarInterfaz();
          reiniciarPartida();
          reiniciarCuaderno();
          reiniciarMecanismo();
          reiniciarVoz();
          fichas.value = {};
          modo.value = 'cooperativo';
          fase.value = 'jugando';
          juego = new JuegoCoop(
            c.yo,
            (i) => void c.enviar(i),
            (d) => void c.t.enviar('dir', directo(c.yo, d)),
          );
          juego.empezar();
        }
        juego?.publicar(foto, e);
      }
    });
  }

  async function conectar(
    codigo: string,
    identidad: Omit<Identidad, 'jugador' | 'unido_en' | 'version_contenido'>,
    crear: boolean,
  ): Promise<void> {
    limpiar();
    const mia = generacion;
    const id: Identidad = {
      ...identidad,
      jugador: jugadorDelNavegador(almacen),
      unido_en: Date.now(),
      version_contenido: VERSION_CONTENIDO,
    };
    coop.value = {
      ...coop.peek(),
      estado: 'conectando',
      codigo,
      error: null,
      jugadores: [],
      soyAnfitrion: crear,
      soloPestanas: soloEntrePestanas(busqueda),
    };
    try {
      const t = await nuevoTransporte();
      if (mia !== generacion) return;
      const c = new ClienteCoop(t, id, opciones.ahora);
      cliente = c;
      quitar.push(
        c.alCambiar((e) => publicar(e)),
        // Señales y frases rápidas de los demás (T91). Las propias ya se anotaron al enviarlas.
        t.escuchar('dir', (m) => {
          if (m.t === 'senal' && m.de !== c.yo) juego?.alSenal(m.de, m.p);
          // Poses de los demás (T82): el motor las interpola.
          else if (m.t === 'pose' && m.de !== c.yo) recibirPose(m.de, m.p);
        }),
        // La pose propia (T82): el motor decide cuándo (4 Hz en movimiento y al detenerse).
        effect(() => {
          const p = poseParaEnviar.value;
          if (p && juego) void t.enviar('dir', directo(c.yo, { t: 'pose', p }));
        }),
        t.presencia(() => queueMicrotask(() => publicar())),
      );
      if (crear) await c.crear(codigo);
      else await c.unirse(codigo);
      if (mia !== generacion) return;
      intervalo = setInterval(() => {
        c.tick();
        publicar();
      }, 1000);
      if (!crear) {
        // Pide la foto por si el anfitrión ya la mandó antes de que este cliente escuchara.
        c.pedirEstado();
        esperaUnion = setTimeout(() => {
          if (mia === generacion && !c.foto) fallar('no_encontrada');
        }, ESPERA_UNION_MS);
      }
      publicar();
    } catch {
      if (mia === generacion) fallar('conexion');
    }
  }

  function salir(): void {
    limpiar();
    reiniciarCoop();
    reiniciarPoses();
    // El controlador individual también atiende `salir` y deja la partida y la interfaz en
    // cero; aquí basta con soltar la red. Si no había partida (sala de espera), se limpia igual.
    batch(() => {
      reiniciarInterfaz();
      reiniciarPartida();
      reiniciarCuaderno();
      reiniciarMecanismo();
      reiniciarVoz();
      fichas.value = {};
    });
  }

  function atender(comando: Comando): void {
    switch (comando.t) {
      case 'crear_partida':
        if (fase.peek() !== 'inicio') return;
        void conectar(crearCodigo(), { alias: comando.alias, color: comando.color }, true);
        return;
      case 'unirse': {
        if (fase.peek() !== 'inicio') return;
        // El código viene del jugador o de la URL: se valida con la regla del protocolo.
        const codigo = leerCodigo(comando.codigo);
        if (!codigo) return;
        void conectar(codigo, { alias: comando.alias, color: comando.color }, false);
        return;
      }
      case 'listo':
        if (cliente?.foto?.fase === 'espera') {
          void cliente.enviar({ t: 'listo', p: { listo: comando.listo } });
        }
        return;
      case 'salir':
        if (coop.peek().estado !== 'inactivo') salir();
        return;
      default:
        juego?.atender(comando);
        return;
    }
  }

  const dejarDeEscuchar = escuchar(atender);
  return () => {
    dejarDeEscuchar();
    if (coop.peek().estado !== 'inactivo') salir();
  };
}
