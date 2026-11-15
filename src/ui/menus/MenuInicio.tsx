import { useState } from 'preact/hooks';
import { ajustes } from '../../signals/ajustes';
import { coop, leerCodigo } from '../../signals/coop';
import { guardada } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import PanelAjustes from '../ajustes/Ajustes';
import FormularioCoop from '../coop/FormularioCoop';
import SalaDeEspera from '../coop/SalaDeEspera';
import { formatoReloj } from '../hud/formato';
import { navegadorActual, sugerirInstalar, TEXTO_INSTALAR } from './instalar';
import '../botones.css';
import './menus.css';

type Vista = 'principal' | 'crear' | 'unirse';

/** `/jugar?codigo=K7MP` abre «Unirse con código» con ese código. Se valida antes de usarlo. */
const codigoDeLaUrl = (): string | null =>
  leerCodigo(new URLSearchParams(location.search).get('codigo'));

/**
 * Menú de inicio (T32): jugar solo, continuar la partida guardada, crear una partida
 * cooperativa o unirse con código. Mientras hay una conexión cooperativa, muestra la sala de
 * espera (T81).
 */
export default function MenuInicio() {
  const pendiente = guardada.value;
  const [conAjustes, setConAjustes] = useState(false);
  const [instalar] = useState(() => sugerirInstalar(navegadorActual()));
  const [codigoUrl] = useState(codigoDeLaUrl);
  const [vista, setVista] = useState<Vista>(codigoUrl ? 'unirse' : 'principal');
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
          {coop.value.estado !== 'inactivo' ? (
            // Al salir de la sala de espera (o de un error) se vuelve al menú principal.
            <SalaDeEspera alSalir={() => setVista('principal')} />
          ) : vista !== 'principal' ? (
            <FormularioCoop
              modo={vista}
              codigoInicial={codigoUrl}
              alVolver={() => setVista('principal')}
            />
          ) : (
            <>
              {/* Partida guardada en este equipo (T31c): se puede seguir donde iba. */}
              {pendiente && (
                <p class="menu-guardada">
                  Tienes una partida guardada: te quedan {formatoReloj(pendiente.restanteMs)} y
                  llevas {pendiente.sellos} de 5 sellos. «Jugar solo» empieza una nueva y borra la
                  guardada.
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
                  onClick={() => setVista('crear')}
                >
                  Crear partida
                </button>
                <button
                  type="button"
                  class="boton boton-secundario"
                  onClick={() => setVista('unirse')}
                >
                  Unirse con código
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
            </>
          )}
          {/* T95: en iPhone, la única forma de quitar las barras de Safari. */}
          {instalar && <p class="menu-nota menu-instalar">{TEXTO_INSTALAR}</p>}
        </div>
      </main>
      {conAjustes && <PanelAjustes alCerrar={() => setConAjustes(false)} />}
    </>
  );
}
