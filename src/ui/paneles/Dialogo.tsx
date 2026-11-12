import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import '../botones.css';
import './dialogo.css';

interface Props {
  titulo: string;
  /** Texto pequeño sobre el título (p. ej. «Inspección»). */
  antetitulo?: string;
  alCerrar: () => void;
  /** Texto del botón de cerrar. */
  cerrar?: string;
  /** Botones extra junto a «Cerrar». */
  acciones?: ComponentChildren;
  children: ComponentChildren;
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panel 2D modal sobre la escena: inspección, cuaderno y finales lo usan.
 * Al abrirse lleva el foco al panel, Escape lo cierra y Tab no se sale de él.
 */
export default function Dialogo({
  titulo,
  antetitulo,
  alCerrar,
  cerrar = 'Cerrar',
  acciones,
  children,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => {
      // Devuelve el foco a donde estaba, si ese elemento sigue en la página.
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);

  const alTeclear = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      alCerrar();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const enfocables = [...ref.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (!primero || !ultimo) return;
    if (
      e.shiftKey &&
      (document.activeElement === primero || document.activeElement === ref.current)
    ) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  return (
    <div class="dialogo-fondo">
      <div
        ref={ref}
        class="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <header class="dialogo-cabecera">
          {antetitulo && <p class="dialogo-antetitulo">{antetitulo}</p>}
          <h2 id={`${id}-titulo`} class="dialogo-titulo">
            {titulo}
          </h2>
        </header>
        <div class="dialogo-cuerpo">{children}</div>
        <footer class="dialogo-pie">
          {acciones}
          <button type="button" class="boton boton-principal" onClick={alCerrar}>
            {cerrar}
          </button>
        </footer>
      </div>
    </div>
  );
}
