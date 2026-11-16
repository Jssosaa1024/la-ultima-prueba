import { effect } from '@preact/signals';
import { rangoDuracion, salaCorta, type ModoAnalitica } from '../game/analitica';
import { crearContador, type Contar } from '../net/analitica';
import { coop } from './coop';
import { DURACION_MS, fase, modo, reloj, restanteEn, sellos } from './partida';

/**
 * Analítica sin cookies ni datos personales (T98): mira las señales de la partida y cuenta
 * tres cosas, una vez cada una:
 *
 * - `partida_iniciada`: al empezar una partida nueva (no al continuar una guardada).
 * - `sala_resuelta`: cada sello nuevo, con la sala (`s1`…`s5`).
 * - `partida_terminada`: al llegar a un final, con el rango de minutos jugados.
 *
 * En grupo cuenta solo el anfitrión, para que una partida de 4 no sume 4. No toca el juego:
 * solo lee signals.
 */

/** Margen para considerar «nueva» una partida en grupo (la foto llega con el reloj andando). */
const MARGEN_NUEVA_MS = 60_000;

export interface OpcionesAnalitica {
  /** A dónde va cada conteo; por defecto, a Supabase (nada si no hay variables). */
  contar?: Contar;
  ahora?: () => number;
  /** Cuándo tomar la base de sellos al empezar (en pruebas, al instante). */
  despues?: (fn: () => void) => void;
}

export function iniciarAnalitica(opciones: OpcionesAnalitica = {}): () => void {
  const contar = opciones.contar ?? crearContador();
  const ahora = opciones.ahora ?? (() => performance.now());
  const despues = opciones.despues ?? queueMicrotask;
  let enPartida = false;
  /** Sellos que ya había (o ya se contaron) en esta partida; `null` mientras se toma la base. */
  let contados: Set<string> | null = null;
  let generacion = 0;

  const modoActual = (): ModoAnalitica | null => {
    if (modo.peek() === 'individual') return 'solo';
    if (modo.peek() === 'cooperativo') return coop.peek().soyAnfitrion ? 'grupo' : null;
    return null;
  };

  return effect(() => {
    const f = fase.value;
    const lista = sellos.value;
    if (f === 'jugando' && !enPartida) {
      enPartida = true;
      contados = null;
      const mia = ++generacion;
      // La partida guardada recupera sus sellos justo después de pasar a «jugando»: la base se
      // toma cuando todo quedó en su sitio, para no contarlos como nuevos.
      despues(() => {
        if (mia !== generacion || !enPartida) return;
        const base = sellos.peek();
        contados = new Set(base);
        const m = modoActual();
        const restante = restanteEn(reloj.peek(), ahora());
        if (m && base.length === 0 && restante > DURACION_MS - MARGEN_NUEVA_MS) {
          contar({ evento: 'partida_iniciada', modo: m, detalle: '' });
        }
      });
      return;
    }
    if (f === 'jugando' && contados) {
      for (const s of lista) {
        if (contados.has(s)) continue;
        contados.add(s);
        const m = modoActual();
        const corta = salaCorta(s);
        if (m && corta) contar({ evento: 'sala_resuelta', modo: m, detalle: corta });
      }
      return;
    }
    if (f === 'final' && enPartida) {
      enPartida = false;
      contados = null;
      const m = modoActual();
      const jugado = DURACION_MS - restanteEn(reloj.peek(), ahora());
      if (m) contar({ evento: 'partida_terminada', modo: m, detalle: rangoDuracion(jugado) });
      return;
    }
    if (f === 'inicio') {
      enPartida = false;
      contados = null;
    }
  });
}
