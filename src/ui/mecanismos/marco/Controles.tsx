import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

/**
 * Piezas comunes de los paneles de mecanismo (T37). Todos los controles son discretos (de a
 * un paso, de una lista) y cada botón mide al menos 48 px, para usarlos con el pulgar.
 */

interface PropsPasos {
  /** Qué se ajusta: «Fichas azules», «Caudal del tanque A». */
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  /** Cuánto cambia con cada toque. Por defecto, 1. */
  paso?: number;
  /** Texto del valor: «3 cm/s». Por defecto, el número. */
  texto?: string;
  bloqueado?: boolean;
  alCambiar: (valor: number) => void;
}

/** Un número que sube y baja de a un paso, con botones «menos» y «más». */
export function Pasos({
  etiqueta,
  valor,
  min,
  max,
  paso = 1,
  texto,
  bloqueado = false,
  alCambiar,
}: PropsPasos) {
  const id = useId();
  return (
    <div class="control" role="group" aria-labelledby={`${id}-etiqueta`}>
      <span id={`${id}-etiqueta`} class="control-etiqueta">
        {etiqueta}
      </span>
      <div class="pasos">
        <button
          type="button"
          class="pasos-boton"
          aria-label={`Menos: ${etiqueta}`}
          disabled={bloqueado || valor - paso < min}
          onClick={() => alCambiar(valor - paso)}
        >
          −
        </button>
        {/* `output` se anuncia solo al cambiar, sin mover el foco del botón. */}
        <output class="pasos-valor">{texto ?? String(valor)}</output>
        <button
          type="button"
          class="pasos-boton"
          aria-label={`Más: ${etiqueta}`}
          disabled={bloqueado || valor + paso > max}
          onClick={() => alCambiar(valor + paso)}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface Opcion<T> {
  valor: T;
  texto: string;
}

interface PropsOpciones<T> {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  /** Las opciones puestas, en el orden en que se eligieron. */
  elegidas: readonly T[];
  /** Cuántas se pueden poner a la vez. Con 1, elegir otra reemplaza a la anterior. */
  max?: number;
  bloqueado?: boolean;
  alCambiar: (elegidas: T[]) => void;
}

/** Elegir de una lista corta: una muesca, uno o dos rodillos. Cada opción es un botón. */
export function Opciones<T extends string | number>({
  etiqueta,
  opciones,
  elegidas,
  max = 1,
  bloqueado = false,
  alCambiar,
}: PropsOpciones<T>) {
  const id = useId();
  const alTocar = (valor: T): void => {
    if (elegidas.includes(valor)) alCambiar(elegidas.filter((v) => v !== valor));
    else if (max === 1) alCambiar([valor]);
    else if (elegidas.length < max) alCambiar([...elegidas, valor]);
  };
  return (
    <div class="control" role="group" aria-labelledby={`${id}-etiqueta`}>
      <span id={`${id}-etiqueta`} class="control-etiqueta">
        {etiqueta}
      </span>
      <div class="opciones">
        {opciones.map((o) => {
          const puesta = elegidas.includes(o.valor);
          return (
            <button
              key={o.valor}
              type="button"
              class={`opcion${puesta ? ' opcion-puesta' : ''}`}
              aria-pressed={puesta}
              // Con el cupo lleno solo se pueden quitar las puestas.
              disabled={bloqueado || (!puesta && max > 1 && elegidas.length >= max)}
              onClick={() => alTocar(o.valor)}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Lo que hizo la máquina. El lector de pantalla lo lee cuando cambia. */
export function Respuesta({ titulo, children }: { titulo?: string; children: ComponentChildren }) {
  return (
    <div class="respuesta" role="status">
      <p class="respuesta-titulo">{titulo ?? 'Lo que hizo la máquina'}</p>
      {children}
    </div>
  );
}

/** Una lámpara o un sensor: encendido o apagado, con su nombre. No depende solo del color. */
export function Indicador({ encendido, texto }: { encendido: boolean; texto: string }) {
  return (
    <span class={`indicador${encendido ? ' indicador-encendido' : ''}`}>
      <span class="indicador-luz" aria-hidden="true" />
      {texto}
      <span class="solo-lector">{encendido ? ': encendido' : ': apagado'}</span>
    </span>
  );
}
