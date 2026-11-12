import { cargarEjemplo, pideEjemplo } from '../../signals/ejemplo';
import { enviar } from '../../signals/puente';
import './menus.css';

/**
 * Menú de inicio (T32). Por ahora solo ofrece el modo individual: crear partida y unirse con
 * código llegan con el cooperativo (T78–T93) y quedan ocultos hasta entonces.
 */
export default function MenuInicio() {
  return (
    <main class="menu" aria-labelledby="menu-titulo">
      <div class="menu-caja">
        <p class="menu-antetitulo">Escape room de matemáticas</p>
        <h1 id="menu-titulo" class="menu-titulo">
          La Última Prueba
        </h1>
        <p class="menu-texto">
          Son las 23:59 y las puertas del colegio se cerraron contigo adentro. Por los parlantes
          despierta La Voz: supera cinco salas y recupera la salida. Tienes 40 minutos.
        </p>
        <div class="menu-acciones">
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => {
              enviar({ t: 'iniciar', modo: 'individual' });
              // `/jugar?ejemplo=1`: datos de ejemplo mientras no existan el motor y el contenido.
              if (pideEjemplo(window.location.search)) cargarEjemplo();
            }}
          >
            Jugar solo
          </button>
          <a class="boton boton-secundario" href="/">
            Volver a la portada
          </a>
        </div>
        <p class="menu-nota">
          Mueve con el joystick de la izquierda, mira arrastrando a la derecha y toca los objetos
          para examinarlos.
        </p>
      </div>
    </main>
  );
}
