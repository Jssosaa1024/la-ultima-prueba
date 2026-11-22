import type { AccionObjeto } from './interfaz';
import type { Asunto, FRASES, OpcionVoto } from '../game/coop/mensajes';
import type { OpcionFinal } from '../game/partida';
import type { Alias, Color } from '../net/protocolo';
import type { Modo } from './partida';

/**
 * Puente de órdenes entre capas (T31).
 *
 * Los signals cuentan cómo está el juego; las órdenes piden que algo cambie. `ui/` y
 * `engine/` llaman a `enviar()`, y quien tenga la autoridad (la lógica del juego, o el
 * anfitrión en cooperativo) se suscribe con `escuchar()` y actualiza los signals.
 * Así ninguna capa importa a otra: todas importan de `signals/`.
 *
 * Las órdenes llevan ids y valores de listas cerradas. La única excepción es la nota del
 * cuaderno, que el jugador escribe y se limita a 280 caracteres.
 */
export type Comando =
  /** Empezar una partida desde el menú de inicio. */
  | { t: 'iniciar'; modo: Modo }
  /** Seguir la partida guardada en este equipo (T31c). */
  | { t: 'continuar' }
  /** Abandonar la partida (o la sala de espera del cooperativo) y volver al menú. */
  | { t: 'salir' }
  /** Cooperativo (T32): crear una partida con el alias y el color elegidos de la lista. */
  | { t: 'crear_partida'; alias: Alias; color: Color }
  /** Cooperativo (T32): unirse con el código de 4 caracteres (se valida antes de usarlo). */
  | { t: 'unirse'; codigo: string; alias: Alias; color: Color }
  /** Sala de espera (T81): marcarse listo. El anfitrión inicia marcándose listo él también. */
  | { t: 'listo'; listo: boolean }
  /** Sala de espera (T81b): pedir otro alias y color. Lo que ya tiene otro no se acepta. */
  | { t: 'elegir'; alias: Alias; color: Color }
  /**
   * Cooperativo (T85): quien tiene D propone los ajustes de su panel al grupo. En las máquinas
   * con palanca, `accionar` hace lo mismo.
   */
  | { t: 'proponer' }
  /** Cooperativo (T85): aceptar o rechazar la propuesta abierta. */
  | { t: 'confirmar'; acepta: boolean }
  /** Cooperativo (T87): votar (o retirar el voto) por pausar, reanudar, ir a otra sala, el final o la ayuda. */
  | { t: 'votar'; asunto: Asunto; opcion: OpcionVoto | null; acepta: boolean }
  /**
   * Cooperativo (T91): señalar el objeto enfocado (o donde está el jugador) con una frase
   * rápida de la lista, o sin frase. Máximo una por segundo.
   */
  | { t: 'senal'; frase: (typeof FRASES)[number] | null }
  /**
   * Cooperativo (T84d): pasarle a un compañero (`a`, id de jugador) un objeto que lleva este
   * jugador. El anfitrión lo acepta solo si el destino está conectado.
   */
  | { t: 'pasar'; objeto: string; a: string }
  /** Botón contextual sobre el objeto enfocado. */
  | { t: 'accion'; objeto: string; accion: AccionObjeto }
  /** Pausar el reloj (el menú de pausa y los ajustes, en modo individual). */
  | { t: 'pausar' }
  | { t: 'reanudar' }
  /** Frente a la puerta de salida, con los cinco sellos: salir o restaurar el archivo. */
  | { t: 'elegir_final'; opcion: OpcionFinal }
  /** Confirmación del intercomunicador de la portería. */
  | { t: 'pedir_ayuda' }
  /**
   * Panel de mecanismo: ajustes nuevos de la máquina en la etapa actual, completos y con la
   * forma de `estado_inicial`. El controlador los revisa con las reglas antes de aceptarlos.
   */
  | { t: 'ajustar'; estado: unknown }
  /** Panel de mecanismo: accionar el objeto que confirma la etapa (palanca, polea, manija). */
  | { t: 'accionar'; objeto: string }
  /** Abrir la siguiente pista ofrecida del puzzle de la sala actual. */
  | { t: 'ver_pista' }
  /** Notas del cuaderno: texto escrito por el propio jugador, de 280 caracteres o menos. */
  | { t: 'nota'; op: 'agregar'; texto: string }
  | { t: 'nota'; op: 'borrar'; id: string };

export type Oyente = (comando: Comando) => void;

const oyentes = new Set<Oyente>();

/**
 * Entrega la orden a cada oyente, en el orden en que se suscribieron. Si uno falla, los demás
 * la reciben igual y el error se relanza aparte para que se vea en la consola.
 */
export function enviar(comando: Comando): void {
  for (const oyente of [...oyentes]) {
    try {
      oyente(comando);
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

/** Se suscribe a las órdenes. Devuelve la función para dejar de escuchar. */
export function escuchar(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}
