import { useEffect, useState } from 'preact/hooks';
import { abrirPanel, cerrarPanel } from '../../signals/interfaz';
import { modo } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import Sello from '../tema/Sello';
import Dialogo from './Dialogo';
import './pausa.css';

/** Lo que dura el golpe del sello «Expediente cerrado» antes de volver al menú. */
const GOLPE_MS = 450;

const menosMovimiento = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Pausa y confirmación para salir (ola 6, T41d), con el tema del archivo.
 *
 * - Solo: el botón «Pausa» del HUD abre la ficha y el reloj se detiene mientras está abierta.
 *   Desde ahí se va a los ajustes o se sale, con confirmación.
 * - En grupo: el reloj no se detiene por uno solo (la pausa se vota en la barra del grupo),
 *   así que el botón «Salir» del HUD abre directamente la confirmación.
 *
 * Al confirmar, el sello «Expediente cerrado» golpea la ficha y la partida termina. Reemplaza
 * al `window.confirm` que usaba el HUD.
 */
export default function PanelPausa() {
  const individual = modo.value === 'individual';
  const [confirmar, setConfirmar] = useState(!individual);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    if (!individual) return;
    enviar({ t: 'pausar' });
    return () => enviar({ t: 'reanudar' });
  }, [individual]);

  const salir = (): void => {
    if (saliendo) return;
    setSaliendo(true);
    window.setTimeout(() => enviar({ t: 'salir' }), menosMovimiento() ? 0 : GOLPE_MS);
  };

  if (!confirmar) {
    return (
      <Dialogo
        // Una clave por paso: al cambiar, el panel se monta de nuevo y el foco va a él.
        key="pausa"
        tema="archivo"
        antetitulo="Expediente abierto"
        titulo="Pausa"
        retorno="pausa"
        cerrar="Seguir jugando"
        alCerrar={cerrarPanel}
        acciones={
          <>
            <button
              type="button"
              class="boton boton-secundario"
              onClick={() => abrirPanel('ajustes')}
            >
              Ajustes
            </button>
            <button type="button" class="boton boton-secundario" onClick={() => setConfirmar(true)}>
              Salir de la partida
            </button>
          </>
        }
      >
        <div class="pausa-cuerpo">
          <Sello texto="En pausa" color="azul" grande golpe decorativo clase="pausa-sello" />
          <p role="status">El reloj de las 00:40 está detenido mientras esta ficha esté abierta.</p>
        </div>
      </Dialogo>
    );
  }

  return (
    <Dialogo
      key="confirmar"
      tema="archivo"
      antetitulo={individual ? 'Pausa' : 'Partida en grupo'}
      titulo="¿Salir de la partida?"
      retorno="pausa"
      cerrar={individual ? 'No, seguir jugando' : 'No, seguir en el grupo'}
      cerrarSecundario
      alCerrar={cerrarPanel}
      acciones={
        <button type="button" class="boton boton-principal" disabled={saliendo} onClick={salir}>
          Sí, salir
        </button>
      }
    >
      <div class="pausa-cuerpo">
        {saliendo ? (
          <Sello texto="Expediente cerrado" grande golpe clase="pausa-sello" />
        ) : (
          <Sello texto="¿Cerrar?" decorativo clase="pausa-sello" />
        )}
        <p>
          {individual
            ? 'Se pierde lo que llevas: el expediente se cierra y vuelves al menú.'
            : 'Sales del grupo y vuelves al menú. Los demás pueden seguir sin ti.'}
        </p>
        {!individual && (
          <p class="pausa-nota">
            El reloj no se detiene mientras decides. Para pausar en grupo, voten «Pausar» en la
            barra del grupo.
          </p>
        )}
      </div>
    </Dialogo>
  );
}
