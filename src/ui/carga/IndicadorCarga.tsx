import { useEffect, useState } from 'preact/hooks';
import { carga } from '../../signals/interfaz';
import '../tema.css';
import './carga.css';

/** Una carga más corta que esto no muestra el aviso: sería solo un parpadeo. */
const ESPERA_MS = 250;

/**
 * Aviso mientras el motor prepara una sala (T20b). Lee el signal `carga`, que escribe el
 * cargador de salas: aparece si la carga tarda más de un cuarto de segundo y se quita al
 * terminar. Si la sala no se pudo cargar, lo dice en lugar de dejar la pantalla quieta.
 * No recibe toques. Tema del archivo (T41c): una ficha de papel con el reloj ámbar girando.
 */
export default function IndicadorCarga() {
  const estado = carga.value.estado;
  const [tarda, setTarda] = useState(false);

  useEffect(() => {
    if (estado !== 'cargando') {
      setTarda(false);
      return;
    }
    const id = window.setTimeout(() => setTarda(true), ESPERA_MS);
    return () => window.clearTimeout(id);
  }, [estado]);

  if (estado === 'error') {
    return (
      <p class="indicador-carga tema-ficha" role="alert">
        <span class="indicador-carga-rotulo tema-etiqueta">Expediente dañado</span>
        <span>No se pudo cargar la sala. Recarga la página para seguir.</span>
      </p>
    );
  }
  if (estado !== 'cargando' || !tarda) return null;
  return (
    <p class="indicador-carga tema-ficha" role="status">
      <span class="indicador-carga-reloj" aria-hidden="true">
        <span class="indicador-carga-aguja" />
      </span>
      <span class="indicador-carga-texto">
        <span class="indicador-carga-rotulo tema-etiqueta">Abriendo expediente</span>
        <span>Cargando sala…</span>
      </span>
    </p>
  );
}
