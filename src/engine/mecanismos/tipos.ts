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
  /** Deja de escuchar los signals. Las mallas se liberan con la sala. */
  liberar(): void;
}
