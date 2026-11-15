import { useEffect } from 'preact/hooks';
import { grabacionDeSala } from '../../content/grabaciones';
import { cerrarPanel } from '../../signals/interfaz';
import { grabaciones, sala } from '../../signals/partida';
import Dialogo from '../paneles/Dialogo';
import { textoAvance, tituloGrabacion } from './textos';
import './grabaciones.css';

/**
 * Lo que se ve al recoger una grabación (T75): dónde estaba y lo que dice. Es la de la sala
 * actual; si el jugador vuelve a usar el escondite, se muestra otra vez. El audio llega
 * después: por ahora la grabación se lee.
 */
export default function PanelGrabacion() {
  const grabacion = grabacionDeSala(sala.value);
  const recogidas = grabaciones.value;
  const laTiene = grabacion !== null && recogidas.includes(grabacion.id);

  // Sin grabación recogida en este lugar no hay nada que mostrar.
  useEffect(() => {
    if (!laTiene) cerrarPanel();
  }, [laTiene]);
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
