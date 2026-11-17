import { useState } from 'preact/hooks';
import { salaPorId } from '../../content/salas';
import { cerrarPanel } from '../../signals/interfaz';
import { opcionesFinal, SALAS_CON_SELLO, totalSellos } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import Dialogo from '../paneles/Dialogo';
import { textoConfirmarSalida, textoGrabacionesFaltantes, textoSellosFaltantes } from './textos';
import './finales.css';

/**
 * Elección de final frente a la puerta de salida (T31b). La puerta nunca dice «no»: muestra
 * cuántos sellos faltan en el mural o, con los cinco, las dos formas de terminar. «Restaurar
 * archivo» pide además las tres grabaciones y dice en qué salas queda alguna.
 *
 * «Salir» con grabaciones pendientes pide confirmar, como el intercomunicador (hito 1,
 * punto 2): esa partida ya no puede terminar en «El legado».
 */
export default function EleccionFinal() {
  const opciones = opcionesFinal.value;
  const faltanSellos = SALAS_CON_SELLO.length - totalSellos.value;
  const [confirmando, setConfirmando] = useState(false);

  if (!opciones.salir) {
    return (
      <Dialogo
        tema="archivo"
        antetitulo="Portería"
        titulo="Puerta de salida"
        cerrar="Volver"
        alCerrar={cerrarPanel}
      >
        <p>La puerta no abre todavía. {textoSellosFaltantes(faltanSellos)}</p>
      </Dialogo>
    );
  }

  const salir = (): void => enviar({ t: 'elegir_final', opcion: 'salir' });

  if (confirmando) {
    // `key` distinta: el diálogo se monta de nuevo y lleva el foco a la pregunta.
    return (
      <Dialogo
        tema="archivo"
        key="confirmar"
        antetitulo="Portería"
        titulo="Puerta de salida"
        cerrar="Seguir buscando"
        alCerrar={() => setConfirmando(false)}
        acciones={
          <button type="button" class="boton boton-secundario" onClick={salir}>
            Salir de todos modos
          </button>
        }
      >
        <p>{textoConfirmarSalida(opciones.faltanGrabaciones)}</p>
        <p>¿Quieres salir ya?</p>
      </Dialogo>
    );
  }

  return (
    <Dialogo
      tema="archivo"
      key="elegir"
      antetitulo="Portería"
      titulo="Puerta de salida"
      cerrar="Volver"
      alCerrar={cerrarPanel}
    >
      <p>
        Los cinco sellos están en el mural y la puerta ya puede abrirse. ¿Cómo termina la noche?
      </p>
      <ul class="eleccion">
        <li class="eleccion-opcion">
          <p class="eleccion-texto">Sales del colegio con la memoria USB antes de las 00:40.</p>
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => (opciones.faltanGrabaciones > 0 ? setConfirmando(true) : salir())}
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
