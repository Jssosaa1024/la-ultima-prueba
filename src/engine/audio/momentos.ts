/**
 * Los momentos del juego que suenan aunque ninguna máquina responda (T42c): abrir una puerta,
 * tocar una que sigue cerrada, empezar a usar una máquina, mover sus controles, ver encenderse
 * un sensor o una lámpara y recoger algo.
 *
 * Todo sale de los signals que ya publican el controlador individual y el cooperativo, así que
 * suena igual en las dos partidas. Las reglas (qué efecto toca en cada caso) son funciones
 * puras; `escucharMomentos` las conecta con los signals. Solo se llama después del primer
 * toque: antes, el módulo de audio no existe.
 */
import { effect } from '@preact/signals';
import { aviso, enfocado, panel, type Panel } from '../../signals/interfaz';
import { condiciones, etapa, mecanismo, type EtapaActual } from '../../signals/mecanismo';
import { fase, grabaciones, inventario, sala } from '../../signals/partida';
import type { NombreEfecto } from './sintesis';

/** Los paneles que se abren al usar un objeto de la escena. */
const PANELES_DE_USO: readonly Panel[] = ['mecanismo', 'salida', 'ayuda'];

/** Los objetos que suenan distinto al usarlos. Los demás hacen `clac`. */
const SONIDO_DE_USO: Readonly<Record<string, NombreEfecto>> = {
  's1-registradora': 'teclas',
  'porteria-intercomunicador': 'interfono',
};

/** Qué suena al empezar a usar un objeto (se abre su panel). */
export function efectoDeUso(objeto: string | null): NombreEfecto {
  return (objeto && SONIDO_DE_USO[objeto]) || 'clac';
}

/** Qué suena al mover un control de la máquina de cada sala. */
export function efectoDeAjuste(puzzle: string): NombreEfecto {
  switch (puzzle) {
    case 's4-carritos':
      return 'libro';
    case 's5-urna':
      return 'ficha';
    default:
      // Un rodillo que encaja, una perilla, la muesca del reflector o un poste en su riel.
      return 'clic';
  }
}

/**
 * Las etapas que responden en vivo, sin palanca: los sensores del gimnasio (etapas 1 y 2) y
 * las lámparas de la biblioteca. En ellas, cada condición que se cumple hace `bip`, porque el
 * jugador ya la ve en la sala. En las demás, las condiciones se calculan igual pero no suenan:
 * delatarían la respuesta antes de accionar la máquina.
 */
export const ETAPAS_EN_VIVO: Readonly<Record<string, readonly number[]>> = {
  's3-reflector': [0, 1],
  's4-carritos': [0, 1, 2],
};

export function respondeEnVivo(e: EtapaActual | null): boolean {
  return e !== null && (ETAPAS_EN_VIVO[e.puzzle]?.includes(e.etapa) ?? false);
}

/** Cuántas condiciones pasaron de no cumplirse a cumplirse. */
export function condicionesNuevas(
  antes: Readonly<Record<string, boolean>>,
  ahora: Readonly<Record<string, boolean>>,
): number {
  return Object.entries(ahora).filter(([k, v]) => v && antes[k] !== true).length;
}

const claveDe = (e: EtapaActual | null): string | null => (e ? `${e.puzzle}:${e.etapa}` : null);

/** Empieza a escuchar los momentos. Devuelve la función que deja de escucharlos. */
export function escucharMomentos(tocar: (efecto: NombreEfecto) => void): () => void {
  // Lo que ya estaba al desbloquear no suena: pasó antes del primer toque.
  let jugando = fase.peek() === 'jugando';
  let lugar = sala.peek();
  let objetos = inventario.peek().length;
  let recogidas = grabaciones.peek().length;
  let ultimoAviso = aviso.peek();
  let abierto = panel.peek();
  let clave = claveDe(etapa.peek());
  let estado = mecanismo.peek();
  let cumple = condiciones.peek();

  const dejar = [
    // Puertas y objetos recogidos. Al empezar, continuar o salir de una partida cambian a la
    // vez la fase, la sala y el inventario: eso no suena, solo lo que pasa jugando.
    effect(() => {
      const ahora = fase.value === 'jugando';
      const s = sala.value;
      const n = inventario.value.length;
      const g = grabaciones.value.length;
      if (jugando && ahora) {
        if (s !== lugar) tocar('puerta');
        if (n > objetos || g > recogidas) tocar('recoger');
      }
      jugando = ahora;
      lugar = s;
      objetos = n;
      recogidas = g;
    }),
    // La puerta que todavía no se abre. Cada aviso es un objeto nuevo, aunque se repita.
    effect(() => {
      const a = aviso.value;
      if (a && a !== ultimoAviso && a.t === 'puerta_cerrada') tocar('puerta-cerrada');
      ultimoAviso = a;
    }),
    // Empezar a usar una máquina, la puerta de salida o el intercomunicador.
    effect(() => {
      const p = panel.value;
      if (p !== abierto && p !== null && PANELES_DE_USO.includes(p)) {
        tocar(efectoDeUso(enfocado.peek()?.id ?? null));
      }
      abierto = p;
    }),
    // Los controles de la máquina y, en las que responden en vivo, sus sensores y lámparas.
    // Al pasar de etapa cambian los ajustes y las condiciones: eso lo cuenta el sello.
    effect(() => {
      const e = etapa.value;
      const m = mecanismo.value;
      const c = condiciones.value;
      const k = claveDe(e);
      if (e && k === clave) {
        if (m !== estado && estado !== null) tocar(efectoDeAjuste(e.puzzle));
        if (respondeEnVivo(e) && condicionesNuevas(cumple, c) > 0) tocar('bip');
      }
      clave = k;
      estado = m;
      cumple = c;
    }),
  ];
  return () => dejar.forEach((d) => d());
}
