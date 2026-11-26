import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import '../botones.css';
import '../tema.css';
import './dialogo.css';

interface Props {
  titulo: string;
  /** Texto pequeño sobre el título (p. ej. «Inspección»). */
  antetitulo?: ComponentChildren;
  alCerrar: () => void;
  /** Texto del botón de cerrar. */
  cerrar?: string;
  /** El botón de cerrar deja de ser el principal (lo es alguno de `acciones`). */
  cerrarSecundario?: boolean;
  /** Botones extra junto a «Cerrar». */
  acciones?: ComponentChildren;
  /**
   * A qué elemento vuelve el foco al cerrar: el valor de su atributo `data-foco-retorno`
   * (por ejemplo, `cuaderno` para el botón que abre el cuaderno).
   */
  retorno?: string;
  /**
   * Todos los paneles llevan el tema «Archivo del colegio de noche» (ola 6): sin `tema` son una
   * carpeta oscura (máquinas, cuaderno, inspección, pistas); con `archivo`, una ficha de papel
   * (pausa, ajustes, elección de final). Los dos entran deslizándose.
   */
  tema?: 'archivo';
  /**
   * Panel en franja (correcciones del 25 nov): en horizontal es una columna a la derecha y la
   * escena se ve a su izquierda; en vertical, el panel de siempre. El botón de cerrar va
   * arriba, junto a `cabecera`.
   */
  franja?: {
    /** Botones extra en la cabecera, junto a cerrar (el «Ver» de las máquinas). */
    cabecera?: ComponentChildren;
    /** El panel se esconde y queda solo `pestana`, para ver la escena entera. */
    recogido: boolean;
    /** El botón que devuelve el panel. Se muestra solo con el panel recogido. */
    pestana: ComponentChildren;
    /**
     * Fracción del ancho de la pantalla (0 a 1) que tapa la columna a la derecha; 0 si el
     * panel no está en franja (en vertical). Se avisa al abrir y al cambiar de tamaño.
     */
    alMedir: (derecha: number) => void;
  };
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
  cerrarSecundario = false,
  acciones,
  retorno,
  tema,
  franja,
  children,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const recogido = franja?.recogido === true;
  const alMedir = franja?.alMedir;

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

  // En franja: cuánto del ancho tapa la columna. Se mide con el diseño, sin la animación de
  // entrada (que mueve el panel con `transform`).
  useEffect(() => {
    if (!alMedir) return;
    const medir = (): void => {
      const caja = fondo.current;
      const panel = ref.current;
      if (!caja || !panel || caja.clientWidth === 0) return;
      const izquierda = panel.offsetLeft;
      const enColumna = izquierda > caja.clientWidth * 0.4;
      alMedir(enColumna ? (caja.clientWidth - izquierda) / caja.clientWidth : 0);
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (fondo.current) observador.observe(fondo.current);
    if (ref.current) observador.observe(ref.current);
    return () => observador.disconnect();
  }, [alMedir]);

  // Al recoger el panel, el foco pasa a la pestaña; al volver, al panel.
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    if (recogido) fondo.current?.querySelector<HTMLElement>('.dialogo-pestana button')?.focus();
    else ref.current?.focus();
  }, [recogido]);

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

  const botonCerrar = franja ? (
    <button
      type="button"
      class="boton boton-secundario dialogo-cerrar-icono"
      aria-label={cerrar}
      onClick={alCerrar}
    >
      <span aria-hidden="true">✕</span>
    </button>
  ) : (
    <button
      type="button"
      class={`boton ${cerrarSecundario ? 'boton-secundario' : 'boton-principal'}`}
      onClick={alCerrar}
    >
      {cerrar}
    </button>
  );

  const clases = [
    'dialogo-fondo',
    'tema-archivo',
    tema ? 'dialogo-papel' : '',
    franja ? 'dialogo-fondo-franja' : '',
    recogido ? 'dialogo-recogido' : '',
  ].filter(Boolean);

  return (
    <div ref={fondo} class={clases.join(' ')}>
      <div
        ref={ref}
        class="dialogo dialogo-entra"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        inert={recogido}
        onKeyDown={alTeclear}
      >
        <header class="dialogo-cabecera">
          <div class="dialogo-titulos">
            {antetitulo && <p class="dialogo-antetitulo">{antetitulo}</p>}
            <h2 id={`${id}-titulo`} class="dialogo-titulo">
              {titulo}
            </h2>
          </div>
          {franja && (
            <div class="dialogo-cabecera-botones">
              {franja.cabecera}
              {botonCerrar}
            </div>
          )}
        </header>
        <div class="dialogo-cuerpo">{children}</div>
        {(!franja || acciones) && (
          <footer class="dialogo-pie">
            {acciones}
            {!franja && botonCerrar}
          </footer>
        )}
      </div>
      {recogido && (
        <div class="dialogo-pestana" onKeyDown={(e) => e.key === 'Escape' && alCerrar()}>
          {franja.pestana}
        </div>
      )}
    </div>
  );
}
