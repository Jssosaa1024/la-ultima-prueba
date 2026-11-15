import { useEffect, useRef, useState } from 'preact/hooks';
import './girar.css';

/** Lo que el navegador ofrece para fijar la orientación (Chrome en Android; no Safari). */
interface OrientacionBloqueable {
  lock?: (orientacion: 'landscape') => Promise<void>;
}

function orientacion(): OrientacionBloqueable | null {
  return (screen.orientation as OrientacionBloqueable | undefined) ?? null;
}

/**
 * Intenta fijar el teléfono en horizontal. Chrome en Android solo lo permite en pantalla
 * completa o con el juego instalado; Safari en iPhone no lo permite nunca. Si no se puede,
 * no pasa nada: el aviso sigue pidiendo girar el teléfono.
 */
async function fijarHorizontal(): Promise<void> {
  try {
    await orientacion()?.lock?.('landscape');
  } catch {
    // Sin pantalla completa o sin soporte: basta el aviso.
  }
}

/** Pantalla completa y luego horizontal. Debe llamarse dentro de un toque del jugador. */
async function pantallaCompletaHorizontal(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    return;
  }
  await fijarHorizontal();
}

/** Se ofrece el botón solo donde las dos cosas existen (Android); en iPhone basta el aviso. */
const puedeFijar = (): boolean =>
  typeof orientacion()?.lock === 'function' &&
  typeof document.documentElement.requestFullscreen === 'function';

/**
 * Aviso a pantalla completa para girar el teléfono (T41b). En celular el juego se juega solo
 * en horizontal: mientras se ve, el reloj está en pausa y el motor no dibuja (lo deciden el
 * controlador y el motor con el signal `girarTelefono`). Tapa todo, también un panel abierto,
 * que sigue montado debajo y queda igual al girar.
 */
export default function GirarTelefono() {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [conBoton] = useState(puedeFijar);

  useEffect(() => {
    tituloRef.current?.focus();
    // Con el juego instalado o ya en pantalla completa, esto basta para girarlo.
    void fijarHorizontal();
  }, []);

  return (
    <div class="girar" role="dialog" aria-modal="true" aria-labelledby="girar-titulo">
      <svg class="girar-icono" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="20" y="6" width="24" height="44" rx="4" />
        <circle cx="32" cy="44" r="2" />
        <path d="M10 40 a 24 24 0 0 0 16 18" />
        <path d="M22 54 l4 4 l-5 2" />
      </svg>
      <h2 id="girar-titulo" class="girar-titulo" tabIndex={-1} ref={tituloRef}>
        Gira el teléfono
      </h2>
      <p class="girar-texto">El juego se juega con el teléfono en horizontal.</p>
      <p class="girar-texto girar-pausa">El reloj está en pausa.</p>
      {conBoton && (
        <button type="button" class="girar-boton" onClick={() => void pantallaCompletaHorizontal()}>
          Pantalla completa
        </button>
      )}
    </div>
  );
}
