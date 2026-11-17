import { useState } from 'preact/hooks';
import { ajustes } from '../../signals/ajustes';
import { coop, leerCodigo } from '../../signals/coop';
import { guardada } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import PanelAjustes from '../ajustes/Ajustes';
import FormularioCoop from '../coop/FormularioCoop';
import SalaDeEspera from '../coop/SalaDeEspera';
import { formatoReloj } from '../hud/formato';
import Ficha from '../tema/Ficha';
import Sello from '../tema/Sello';
import { navegadorActual, sugerirInstalar, TEXTO_INSTALAR } from './instalar';
import '../botones.css';
import '../tema.css';
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
  const enGrupo = coop.value.estado !== 'inactivo';
  // La ficha vuelve a entrar deslizándose cada vez que cambia lo que muestra.
  const hoja = enGrupo ? 'espera' : vista;
  return (
    <>
      <main class="menu archivo tema-fondo" aria-labelledby="menu-titulo" inert={conAjustes}>
        <div class={`menu-caja${hoja === 'principal' ? '' : ' menu-caja-ancha'}`}>
          <header class="menu-portada">
            <p class="menu-antetitulo tema-etiqueta">Archivo de la I. E. Los Almendros</p>
            <h1 id="menu-titulo" class="menu-titulo tema-titulo">
              La Última Prueba
            </h1>
            {/* El motivo del tema: el reloj ámbar de la portería. */}
            <p class="tema-reloj">
              <span>El archivo se borra a las</span> <strong>00:40</strong>
            </p>
            <p class="menu-texto">
              Son las 23:59 y las puertas del colegio se cerraron contigo adentro. Por los parlantes
              despierta La Voz: supera cinco salas y recupera la salida. Tienes 40 minutos.
            </p>
            {/* T95: en iPhone, la única forma de quitar las barras de Safari. */}
            {instalar && <p class="menu-nota menu-instalar">{TEXTO_INSTALAR}</p>}
          </header>
          <Ficha
            key={hoja}
            variante={hoja === 'principal' ? 'renglones' : 'papel'}
            pestana={hoja === 'principal' ? 'Expediente 00:40' : 'Expediente en grupo'}
            entra
            clase="menu-ficha"
          >
            {hoja === 'principal' && (
              <Sello texto="Por revisar" decorativo golpe clase="menu-sello" />
            )}
            {enGrupo ? (
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
                <div class="menu-acciones menu-acciones-ficha">
                  {pendiente && (
                    <button
                      type="button"
                      class="boton boton-principal menu-accion-ancha"
                      onClick={() => enviar({ t: 'continuar' })}
                    >
                      Continuar partida
                    </button>
                  )}
                  <button
                    type="button"
                    class={`boton ${pendiente ? 'boton-secundario' : 'boton-principal menu-accion-ancha'}`}
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
          </Ficha>
        </div>
      </main>
      {conAjustes && <PanelAjustes alCerrar={() => setConAjustes(false)} />}
    </>
  );
}
