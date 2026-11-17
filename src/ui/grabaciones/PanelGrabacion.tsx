import { useEffect } from 'preact/hooks';
import { grabacionDeSala } from '../../content/grabaciones';
import { cerrarPanel } from '../../signals/interfaz';
import { grabaciones, sala } from '../../signals/partida';
import { mostrarLinea, ocultarLinea } from '../../signals/voz';
import Dialogo from '../paneles/Dialogo';
import { textoAvance, tituloGrabacion } from './textos';
import './grabaciones.css';

/**
 * Lo que se ve al recoger una grabación (T75): dónde estaba y lo que dice. Es la de la sala
 * actual; si el jugador vuelve a usar el escondite, se muestra otra vez. Mientras el panel
 * está abierto suena la grabación con la voz del profe (T42b); al cerrarlo, se calla.
 */
export default function PanelGrabacion() {
  const grabacion = grabacionDeSala(sala.value);
  const recogidas = grabaciones.value;
  const laTiene = grabacion !== null && recogidas.includes(grabacion.id);

  // Sin grabación recogida en este lugar no hay nada que mostrar.
  useEffect(() => {
    if (!laTiene) cerrarPanel();
  }, [laTiene]);
  const idSonido = grabacion && laTiene ? grabacion.id : null;
  useEffect(() => {
    if (!idSonido) return;
    mostrarLinea(idSonido);
    return () => ocultarLinea(idSonido);
  }, [idSonido]);
  if (!grabacion || !laTiene) return null;

  return (
    <Dialogo
      antetitulo={tituloGrabacion(grabacion.numero)}
      titulo="Encontraste una grabación"
      cerrar="Seguir"
      alCerrar={cerrarPanel}
    >
      <p>{grabacion.lugar} había una grabación de La Voz. Dice:</p>
      <blockquote class="grabacion-texto">{grabacion.texto}</blockquote>
      <p>Quedó copiada en tu cuaderno.</p>
      <p class="grabacion-avance">{textoAvance(recogidas.length)}</p>
    </Dialogo>
  );
}
