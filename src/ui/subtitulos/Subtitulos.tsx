import { useEffect } from 'preact/hooks';
import { lineaPorId } from '../../content/guion';
import { audioDesbloqueado } from '../../signals/audio';
import {
  colaVoz,
  mostrarLinea,
  msDeSubtitulo,
  ocultarLinea,
  sonidoVoz,
  terminarLinea,
} from '../../signals/voz';
import './subtitulos.css';

/**
 * Subtítulo de La Voz (T34): la primera línea de la cola. Se monta solo sin paneles abiertos
 * (`Partida`): una línea pedida con un panel abierto (el sello sale dentro del panel de la
 * máquina) espera a que el jugador vuelva a la escena.
 *
 * Con la voz grabada (T42b), el subtítulo anota la línea en `lineaEnPantalla`, el motor la
 * hace sonar y el subtítulo se quita cuando termina el audio. Si el audio no carga, o el
 * navegador todavía no deja sonar, se ve su duración estimada.
 *
 * El texto sale del guion del bundle, nunca de fuera. El lector de pantalla lo lee al
 * aparecer (`aria-live`), con «La Voz» delante para saber quién habla.
 */
export default function Subtitulos() {
  const id = colaVoz.value[0];
  const linea = id ? lineaPorId(id) : null;
  const sonido = sonidoVoz.value;
  const audioListo = audioDesbloqueado.value;

  useEffect(() => {
    if (!id) return;
    mostrarLinea(id);
    return () => ocultarLinea(id);
  }, [id]);

  // Se recalcula cuando el audio de la línea empieza, falla o el navegador lo desbloquea.
  const estado = sonido && sonido.id === id ? sonido.estado : null;
  useEffect(() => {
    if (!id) return;
    const ms = msDeSubtitulo(
      id,
      linea?.duracion_s ?? 0,
      sonidoVoz.peek(),
      audioListo,
      performance.now(),
    );
    const t = window.setTimeout(() => terminarLinea(id), ms);
    return () => window.clearTimeout(t);
  }, [id, estado, audioListo]);

  return (
    <div class="subtitulos" aria-live="polite" aria-atomic="true">
      {linea && (
        <p class="subtitulo" key={linea.id} data-audio={estado ?? undefined}>
          <span class="subtitulo-quien">La Voz:</span> {linea.texto}
        </p>
      )}
    </div>
  );
}
