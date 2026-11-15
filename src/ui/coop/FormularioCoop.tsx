import { useState } from 'preact/hooks';
import {
  ALIAS,
  AVISO_SIN_SUPABASE,
  COLORES,
  esCodigo,
  soloEntrePestanas,
  type Alias,
  type Color,
} from '../../signals/coop';
import { enviar } from '../../signals/puente';
import { COLOR, NOMBRE_ALIAS } from './nombres';
import '../botones.css';
import './coop.css';

interface Props {
  /** `crear`: el jugador será el anfitrión. `unirse`: escribe el código. */
  modo: 'crear' | 'unirse';
  /** Código que llegó en `?codigo=` (ya validado). */
  codigoInicial?: string | null;
  alVolver: () => void;
}

/** Deja en el código solo letras y números del alfabeto, en mayúsculas, hasta 4. */
const limpiarCodigo = (texto: string): string =>
  texto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);

/**
 * Crear partida o unirse con código (T32). El alias y el color se eligen de una lista: no se
 * escribe ningún nombre. El código se valida con la misma regla del protocolo antes de
 * enviarlo.
 */
export default function FormularioCoop({ modo, codigoInicial = null, alVolver }: Props) {
  const [alias, setAlias] = useState<Alias>('zorro');
  const [color, setColor] = useState<Color>('ambar');
  const [codigo, setCodigo] = useState(codigoInicial ?? '');
  const [soloPestanas] = useState(() => soloEntrePestanas(location.search));
  const codigoValido = esCodigo(codigo);
  const crear = modo === 'crear';

  const continuar = (e: Event): void => {
    e.preventDefault();
    if (crear) enviar({ t: 'crear_partida', alias, color });
    else if (codigoValido) enviar({ t: 'unirse', codigo, alias, color });
  };

  return (
    <form class="coop-formulario" onSubmit={continuar}>
      <h2 class="coop-titulo">{crear ? 'Crear partida' : 'Unirse con código'}</h2>
      {!crear && (
        <label class="coop-campo">
          <span>Código de la partida (4 letras o números)</span>
          <input
            class="coop-codigo"
            value={codigo}
            inputMode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            maxLength={4}
            aria-invalid={codigo.length === 4 && !codigoValido}
            onInput={(e) => setCodigo(limpiarCodigo(e.currentTarget.value))}
          />
          {codigo.length === 4 && !codigoValido && (
            <span class="coop-error-campo">
              Ese código no existe: no lleva 0, O, 1, I ni L. Revisa con quien creó la partida.
            </span>
          )}
        </label>
      )}
      <fieldset class="coop-opciones">
        <legend>Tu alias</legend>
        <div class="coop-lista">
          {ALIAS.map((a) => (
            <label key={a} class={`coop-opcion${alias === a ? ' coop-opcion-elegida' : ''}`}>
              <input
                type="radio"
                name="alias"
                value={a}
                checked={alias === a}
                onChange={() => setAlias(a)}
              />
              {NOMBRE_ALIAS[a]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset class="coop-opciones">
        <legend>Tu color</legend>
        <div class="coop-lista">
          {COLORES.map((c) => (
            <label key={c} class={`coop-opcion${color === c ? ' coop-opcion-elegida' : ''}`}>
              <input
                type="radio"
                name="color"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
              />
              <span class="coop-punto" style={{ background: COLOR[c].css }} aria-hidden="true" />
              {COLOR[c].nombre}
            </label>
          ))}
        </div>
      </fieldset>
      {soloPestanas && <p class="menu-nota">{AVISO_SIN_SUPABASE}</p>}
      <div class="menu-acciones">
        <button type="submit" class="boton boton-principal" disabled={!crear && !codigoValido}>
          {crear ? 'Crear' : 'Unirse'}
        </button>
        <button type="button" class="boton boton-secundario" onClick={alVolver}>
          Volver
        </button>
      </div>
    </form>
  );
}
