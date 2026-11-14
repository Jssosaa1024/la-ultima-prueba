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
  /**
   * A qué elemento vuelve el foco al cerrar: el valor de su atributo `data-foco-retorno`
   * (por ejemplo, `cuaderno` para el botón que abre el cuaderno).
   */
  retorno?: string;
  children: ComponentChildren;
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A dónde vuelve el foco al cerrar un panel. El elemento que lo tenía antes de abrir casi
 * nunca sirve: el botón contextual desaparece mientras hay un panel abierto y el resto del
 * HUD queda inerte, así que al abrir el foco ya estaba en `body`. Por eso se busca, en orden:
 * 1. el elemento que tenía el foco, si sigue en la página y no es `body`;
 * 2. el que pide el panel con `retorno` (el botón «Cuaderno»);
 * 3. el botón contextual del HUD (`accion`): al cerrar una ficha, el «Examinar» del objeto;
 * 4. el encabezado del HUD (`hud`), para que el lector de pantalla siga en la partida y no
 *    vuelva al principio de la página.
 */
function destinoDelFoco(anterior: HTMLElement | null, retorno?: string): HTMLElement | null {
  if (
    anterior &&
    anterior !== document.body &&
    anterior.isConnected &&
    !anterior.closest('[inert]')
  ) {
    return anterior;
  }
  // `retorno` lo escribe el propio código; aun así solo se aceptan letras y guiones.
  const claves = [retorno, 'accion', 'hud'].filter((c): c is string => !!c && /^[a-z-]+$/.test(c));
  for (const clave of claves) {
    const destino = document.querySelector<HTMLElement>(`[data-foco-retorno="${clave}"]`);
    if (destino && !destino.closest('[inert]')) return destino;
  }
  return null;
}

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
  retorno,
  children,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => {
      // Al cerrar, el foco vuelve a un lugar útil. Se espera a que la interfaz termine de
      // redibujarse: en este instante el HUD todavía está inerte y el botón contextual, que
      // desaparece mientras hay un panel abierto, aún no ha vuelto.
      window.setTimeout(() => {
        // Si otra pantalla ya tomó el foco (otro panel, el final), no se le quita.
        const activo = document.activeElement;
        if (activo && activo !== document.body) return;
        destinoDelFoco(anterior, retorno)?.focus();
      }, 0);
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
