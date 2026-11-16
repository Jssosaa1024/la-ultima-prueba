import { ALIAS, COLORES, type Alias, type Color } from '../../signals/coop';
import { COLOR, NOMBRE_ALIAS } from './nombres';

interface Props {
  alias: Alias;
  color: Color;
  alAlias: (a: Alias) => void;
  alColor: (c: Color) => void;
  /** T81b: lo que ya tienen otros jugadores de la partida. Se ve, pero no se puede elegir. */
  ocupados?: { alias: readonly Alias[]; colores: readonly Color[] };
  /** Prefijo de los grupos de opciones, para que no choquen dos listas en la misma página. */
  nombre?: string;
}

/**
 * Las listas de alias y de colores del cooperativo (T32, T81b). Lo ocupado queda marcado y
 * deshabilitado; si lo que tenías elegido se ocupa mientras miras, sigue marcado para que se
 * vea qué pasó.
 */
export default function ListasApariencia({
  alias,
  color,
  alAlias,
  alColor,
  ocupados = { alias: [], colores: [] },
  nombre = 'coop',
}: Props) {
  return (
    <>
      <fieldset class="coop-opciones">
        <legend>Tu alias</legend>
        <div class="coop-lista">
          {ALIAS.map((a) => {
            const ocupado = ocupados.alias.includes(a);
            return (
              <label key={a} class={clase(alias === a, ocupado)}>
                <input
                  type="radio"
                  name={`${nombre}-alias`}
                  value={a}
                  checked={alias === a}
                  disabled={ocupado}
                  onChange={() => alAlias(a)}
                />
                {NOMBRE_ALIAS[a]}
                {ocupado && <span class="coop-ocupado">ocupado</span>}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset class="coop-opciones">
        <legend>Tu color</legend>
        <div class="coop-lista">
          {COLORES.map((c) => {
            const ocupado = ocupados.colores.includes(c);
            return (
              <label key={c} class={clase(color === c, ocupado)}>
                <input
                  type="radio"
                  name={`${nombre}-color`}
                  value={c}
                  checked={color === c}
                  disabled={ocupado}
                  onChange={() => alColor(c)}
                />
                <span class="coop-punto" style={{ background: COLOR[c].css }} aria-hidden="true" />
                {COLOR[c].nombre}
                {ocupado && <span class="coop-ocupado">ocupado</span>}
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}

function clase(elegida: boolean, ocupada: boolean): string {
  return `coop-opcion${elegida ? ' coop-opcion-elegida' : ''}${ocupada ? ' coop-opcion-ocupada' : ''}`;
}

/** El primero de la lista que nadie más tiene (con 4 jugadores siempre queda alguno). */
export function primeroLibre<T extends string>(
  lista: readonly T[],
  ocupados: readonly T[],
  preferido: T,
): T {
  if (!ocupados.includes(preferido)) return preferido;
  return lista.find((x) => !ocupados.includes(x)) ?? preferido;
}
