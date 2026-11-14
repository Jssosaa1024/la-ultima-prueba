import type { EstadoDe, EtapaDe, Mecanismo, PuzzleDe } from '../../../content/esquema';
import type { ResultadoMecanismo } from '../../../signals/mecanismo';

/**
 * Marco común de los paneles de mecanismo (T37).
 *
 * Cada sala tiene su panel 2D en `src/ui/mecanismos/<mecanismo>/Panel.tsx`. El panel solo
 * dibuja la máquina y sus controles; el marco (`PanelMecanismo.tsx`) pone todo lo demás:
 *
 * - el título, «Etapa 1 de 3» y la situación de la etapa (del JSON del puzzle);
 * - el botón de accionar, en las etapas con regla `accionar` (palanca, polea, manija);
 * - el aviso de que la máquina responde sola, en las etapas con regla `reposo`;
 * - el paso a la etapa siguiente («Seguir») y el aviso del sello.
 *
 * Para hacer un panel:
 *
 * 1. Reemplaza el contenido de `<mecanismo>/Panel.tsx` por un componente con `export default`
 *    que reciba `PropsPanel<'<mecanismo>'>`. No hay que registrarlo en ningún otro archivo.
 * 2. Dibuja `estado` con los controles de `marco/Controles.tsx` (`Pasos`, `Opciones`) o con
 *    los tuyos, siempre discretos y de al menos 44 px. Cada cambio llama a `ajustar` con el
 *    estado NUEVO Y COMPLETO; el controlador lo valida con las reglas y, si lo acepta, vuelve
 *    por `estado`. Con `bloqueado`, los controles se muestran sin dejar cambiar nada.
 * 3. Muestra lo que pasó con `resultado` dentro de `<Respuesta>`: lo que imprimió, hasta
 *    dónde subió, dónde cayó la sombra. La máquina nunca dice «incorrecto». Las condiciones
 *    en vivo (lámparas, sensores) salen de `condiciones`, con `<Indicador>`.
 * 4. Si la respuesta tiene una animación larga (la corrida de los tanques), llama a
 *    `ocupar(true)` al empezar y `ocupar(false)` al terminar: mientras tanto el marco
 *    esconde sus botones.
 *
 * El panel no envía órdenes al puente ni lee signals: todo le llega por estas props.
 */
export interface PropsPanel<M extends Mecanismo = Mecanismo> {
  puzzle: PuzzleDe<M>;
  /** Datos de la etapa que se está mostrando (controles, éxito, textos). */
  etapa: EtapaDe<M>;
  /** 0 = presentar, 1 = torcer, 2 = dominar. */
  numero: number;
  /** Ajustes de la máquina, ya revisados con las reglas de la etapa. */
  estado: EstadoDe<M>;
  /** Condiciones de la etapa que se cumplen con esos ajustes. */
  condiciones: Readonly<Record<string, boolean>>;
  /** Lo último que respondió la máquina en esta etapa, o `null` si aún no ha respondido. */
  resultado: ResultadoDe<M> | null;
  /** Se muestra una etapa que ya quedó resuelta: los controles no se pueden cambiar. */
  bloqueado: boolean;
  /** Pide un cambio de ajustes. Recibe el estado nuevo completo. */
  ajustar: (estado: EstadoDe<M>) => void;
  /** Avisa al marco que hay una animación en curso, para que esconda sus botones. */
  ocupar: (ocupado: boolean) => void;
}

/** Resultado de la máquina con los ajustes del tipo de ese mecanismo. */
export type ResultadoDe<M extends Mecanismo> = Omit<ResultadoMecanismo, 'estado'> & {
  estado: EstadoDe<M>;
};
