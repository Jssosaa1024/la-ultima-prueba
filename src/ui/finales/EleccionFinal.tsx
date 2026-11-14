import { salaPorId } from '../../content/salas';
import { cerrarPanel } from '../../signals/interfaz';
import { opcionesFinal, SALAS_CON_SELLO, totalSellos } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import Dialogo from '../paneles/Dialogo';
import { textoGrabacionesFaltantes, textoSellosFaltantes } from './textos';
import './finales.css';

/**
 * Elección de final frente a la puerta de salida (T31b). La puerta nunca dice «no»: muestra
 * cuántos sellos faltan en el mural o, con los cinco, las dos formas de terminar. «Restaurar
 * archivo» pide además las tres grabaciones y dice en qué salas queda alguna.
 */
export default function EleccionFinal() {
  const opciones = opcionesFinal.value;
  const faltanSellos = SALAS_CON_SELLO.length - totalSellos.value;

  if (!opciones.salir) {
    return (
      <Dialogo
        antetitulo="Portería"
        titulo="Puerta de salida"
        cerrar="Volver"
        alCerrar={cerrarPanel}
      >
        <p>La puerta no abre todavía. {textoSellosFaltantes(faltanSellos)}</p>
      </Dialogo>
    );
  }

  return (
    <Dialogo antetitulo="Portería" titulo="Puerta de salida" cerrar="Volver" alCerrar={cerrarPanel}>
      <p>
        Los cinco sellos están en el mural y la puerta ya puede abrirse. ¿Cómo termina la noche?
      </p>
      <ul class="eleccion">
        <li class="eleccion-opcion">
          <p class="eleccion-texto">Sales del colegio con la memoria USB antes de las 00:40.</p>
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => enviar({ t: 'elegir_final', opcion: 'salir' })}
          >
            Salir
          </button>
        </li>
        <li class="eleccion-opcion">
          <p class="eleccion-texto" id="eleccion-restaurar">
            {opciones.restaurar
              ? 'Con las tres grabaciones puedes restaurar el archivo antes de salir.'
              : textoGrabacionesFaltantes(
                  opciones.faltanGrabaciones,
                  opciones.salasConGrabacion.map((s) => salaPorId(s).nombre),
                )}
          </p>
          <button
            type="button"
            class="boton boton-secundario"
            disabled={!opciones.restaurar}
            aria-describedby="eleccion-restaurar"
            onClick={() => enviar({ t: 'elegir_final', opcion: 'restaurar' })}
          >
            Restaurar archivo
          </button>
        </li>
      </ul>
    </Dialogo>
  );
}
