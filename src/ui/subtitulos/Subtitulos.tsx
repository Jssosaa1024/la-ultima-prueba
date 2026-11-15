import { useEffect } from 'preact/hooks';
import { lineaPorId } from '../../content/guion';
import { colaVoz, terminarLinea } from '../../signals/voz';
import './subtitulos.css';

/**
 * Subtítulo de La Voz (T34): la primera línea de la cola, el tiempo que dura. Se monta solo
 * sin paneles abiertos (`Partida`): una línea pedida con un panel abierto (el sello sale
 * dentro del panel de la máquina) espera a que el jugador vuelva a la escena.
 *
 * El texto sale del guion del bundle, nunca de fuera. El lector de pantalla lo lee al
 * aparecer (`aria-live`), con «La Voz» delante para saber quién habla.
 */
export default function Subtitulos() {
  const id = colaVoz.value[0];
  const linea = id ? lineaPorId(id) : null;

  useEffect(() => {
    if (!id) return;
    // Sin audio todavía: la línea se ve su duración estimada.
    const ms = (linea?.duracion_s ?? 0) * 1000;
    const t = window.setTimeout(() => terminarLinea(id), ms);
    return () => window.clearTimeout(t);
  }, [id]);

  return (
    <div class="subtitulos" aria-live="polite" aria-atomic="true">
      {linea && (
        <p class="subtitulo" key={linea.id}>
          <span class="subtitulo-quien">La Voz:</span> {linea.texto}
        </p>
      )}
    </div>
  );
}
