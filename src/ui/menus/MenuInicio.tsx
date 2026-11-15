import { useState } from 'preact/hooks';
import { ajustes } from '../../signals/ajustes';
import { guardada } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import PanelAjustes from '../ajustes/Ajustes';
import { formatoReloj } from '../hud/formato';
import { navegadorActual, sugerirInstalar, TEXTO_INSTALAR } from './instalar';
import '../botones.css';
import './menus.css';

/**
 * Menú de inicio (T32). Por ahora solo ofrece el modo individual: crear partida y unirse con
 * código llegan con el cooperativo (T78–T93) y quedan ocultos hasta entonces.
 */
export default function MenuInicio() {
  const pendiente = guardada.value;
  const [conAjustes, setConAjustes] = useState(false);
  const [instalar] = useState(() => sugerirInstalar(navegadorActual()));
  const zurdo = ajustes.value.zurdo;
  return (
    <>
      <main class="menu" aria-labelledby="menu-titulo" inert={conAjustes}>
        <div class="menu-caja">
          <p class="menu-antetitulo">Escape room de matemáticas</p>
          <h1 id="menu-titulo" class="menu-titulo">
            La Última Prueba
          </h1>
          <p class="menu-texto">
            Son las 23:59 y las puertas del colegio se cerraron contigo adentro. Por los parlantes
            despierta La Voz: supera cinco salas y recupera la salida. Tienes 40 minutos.
          </p>
          {/* Partida guardada en este equipo (T31c): se puede seguir donde iba. */}
          {pendiente && (
            <p class="menu-guardada">
              Tienes una partida guardada: te quedan {formatoReloj(pendiente.restanteMs)} y llevas{' '}
              {pendiente.sellos} de 5 sellos. «Jugar solo» empieza una nueva y borra la guardada.
            </p>
          )}
          <div class="menu-acciones">
            {pendiente && (
              <button
                type="button"
                class="boton boton-principal"
                onClick={() => enviar({ t: 'continuar' })}
              >
                Continuar partida
              </button>
            )}
            <button
              type="button"
              class={`boton ${pendiente ? 'boton-secundario' : 'boton-principal'}`}
              onClick={() => enviar({ t: 'iniciar', modo: 'individual' })}
            >
              Jugar solo
            </button>
            <button
              type="button"
              class="boton boton-secundario"
              data-foco-retorno="ajustes"
              onClick={() => setConAjustes(true)}
            >
              Ajustes
            </button>
            <a class="boton boton-secundario" href="/">
              Volver a la portada
            </a>
          </div>
          <p class="menu-nota">
            {zurdo
              ? 'Mueve con el joystick de la derecha, mira arrastrando a la izquierda y toca los objetos para examinarlos.'
              : 'Mueve con el joystick de la izquierda, mira arrastrando a la derecha y toca los objetos para examinarlos.'}
          </p>
          {/* T95: en iPhone, la única forma de quitar las barras de Safari. */}
          {instalar && <p class="menu-nota menu-instalar">{TEXTO_INSTALAR}</p>}
        </div>
      </main>
      {conAjustes && <PanelAjustes alCerrar={() => setConAjustes(false)} />}
    </>
  );
}
