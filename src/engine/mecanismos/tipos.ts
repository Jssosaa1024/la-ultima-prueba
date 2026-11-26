/**
 * Animación 3D de la máquina de una sala (T45 en adelante).
 *
 * La máquina se opera en su panel 2D; aquí el objeto 3D solo anima lo que pasó. La animación
 * lee los signals de `signals/mecanismo.ts` y `signals/partida.ts`, nunca la interfaz. Las
 * piezas que agrega cuelgan de la sala, así que se liberan con ella al cambiar de sala.
 */
export interface AnimacionSala {
  /** Avanza la animación. `dt` en segundos; se llama en cada cuadro, también con un panel abierto. */
  actualizar(dt: number): void;
  /** En qué va la máquina, en una palabra. Para las pruebas e2e (`data-maquina` del canvas). */
  readonly estado: string;
  /**
   * La máquina se está moviendo por lo último que respondió (una impresión, una corrida, las
   * sombras que se acomodan, la mano de la urna) o abre lo que guarda el sello. Con eso el
   * sonido de acierto o de error espera a que termine (corrección del 25 de noviembre). Sin
   * máquina, falso.
   */
  readonly animando?: boolean;
  /**
   * Lo demás que se anima en la sala y no es su máquina (las flechas del laboratorio), en una
   * palabra. Para las pruebas e2e (`data-detalle` del canvas).
   */
  readonly detalle?: string;
  /** Deja de escuchar los signals. Las mallas se liberan con la sala. */
  liberar(): void;
}
