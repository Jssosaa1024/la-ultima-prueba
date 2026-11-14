import { cerrarPanel } from '../../signals/interfaz';
import { enviar } from '../../signals/puente';
import Dialogo from './Dialogo';

/**
 * Confirmación del intercomunicador de la portería (T31b). Pedir ayuda termina la partida en
 * el final «También vale pedir ayuda», así que el botón principal es seguir jugando.
 */
export default function PedirAyuda() {
  return (
    <Dialogo
      antetitulo="Portería"
      titulo="Intercomunicador de emergencia"
      cerrar="Seguir intentando"
      alCerrar={cerrarPanel}
      acciones={
        <button
          type="button"
          class="boton boton-secundario"
          onClick={() => enviar({ t: 'pedir_ayuda' })}
        >
          Pedir ayuda
        </button>
      }
    >
      <p>
        Levantas la tapa del botón rojo. Si lo oprimes, don Efraín, el celador, viene a abrir con su
        llave y la partida termina aquí.
      </p>
      <p>Pedir ayuda también vale. ¿Quieres llamarlo?</p>
    </Dialogo>
  );
}
