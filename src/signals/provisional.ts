import { batch } from '@preact/signals';
import { fase, final, modo, reiniciarPartida, reloj, restanteEn, sala } from './partida';
import { escuchar, type Comando } from './puente';
import { reiniciarInterfaz } from './interfaz';

/**
 * Controlador PROVISIONAL de la partida individual.
 *
 * La lógica real vive en `game/` (máquina de estados T24, reloj T25, finales T28), que
 * todavía no está en `main`. Mientras tanto, este módulo atiende las órdenes del puente con
 * lo mínimo para que las pantallas funcionen. Cuando llegue `game/`, se borra este archivo y
 * su controlador se suscribe con `escuchar()` en su lugar.
 */

const ahora = (): number => performance.now();

function pausar(): void {
  const r = reloj.value;
  if (r.pausado) return;
  const t = ahora();
  reloj.value = { restanteMs: restanteEn(r, t), pausado: true, desde: t };
}

function reanudar(): void {
  const r = reloj.value;
  if (!r.pausado || fase.value !== 'jugando') return;
  reloj.value = { ...r, pausado: false, desde: ahora() };
}

function atender(comando: Comando): void {
  switch (comando.t) {
    case 'iniciar':
      // El cooperativo aún no existe: solo se atiende el modo individual.
      if (comando.modo !== 'individual') return;
      reiniciarInterfaz();
      batch(() => {
        reiniciarPartida();
        modo.value = 'individual';
        sala.value = 'porteria';
        fase.value = 'jugando';
        reloj.value = { ...reloj.value, pausado: false, desde: ahora() };
      });
      return;
    case 'salir':
      reiniciarInterfaz();
      reiniciarPartida();
      return;
    case 'pausar':
      pausar();
      return;
    case 'reanudar':
      reanudar();
      return;
    case 'elegir_final':
      batch(() => {
        pausar();
        final.value = comando.final;
        fase.value = 'final';
      });
      return;
    case 'accion':
      // Recoger y usar objetos llegan con la lógica del juego.
      return;
  }
}

/** Empieza a atender órdenes. Devuelve la función para detenerlo. */
export function iniciarControladorProvisional(): () => void {
  return escuchar(atender);
}
