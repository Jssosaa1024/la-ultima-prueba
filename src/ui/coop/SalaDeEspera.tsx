import { useEffect, useRef, useState } from 'preact/hooks';
import {
  ALIAS,
  COLORES,
  coop,
  puedeIniciar,
  type Coop,
  type ErrorCoop,
  type JugadorCoop,
} from '../../signals/coop';
import { enviar } from '../../signals/puente';
import ListasApariencia, { primeroLibre } from './ListasApariencia';
import { COLOR, NOMBRE_ALIAS } from './nombres';
import '../botones.css';
import './coop.css';

const TEXTO_ERROR: Readonly<Record<ErrorCoop, string>> = {
  llena: 'Esa partida ya tiene 4 jugadores.',
  version:
    'Tu versión del juego es distinta a la de la partida. Actualiza la página y vuelve a intentarlo.',
  empezada: 'Esa partida ya empezó sin ti.',
  no_encontrada:
    'No encontramos esa partida. Revisa el código y que quien la creó tenga el juego abierto.',
  conexion: 'No se pudo conectar. Revisa tu conexión a internet y vuelve a intentarlo.',
};

/** Nombre del jugador como se muestra: «Zorro (tú)». */
export function nombreJugador(j: Pick<JugadorCoop, 'alias' | 'yo'>): string {
  return `${NOMBRE_ALIAS[j.alias]}${j.yo ? ' (tú)' : ''}`;
}

/** T81b: qué se le dice a quien pidió algo que ya tenía otro. */
export function textoOcupado(o: NonNullable<Coop['eleccion']['ocupado']>): string {
  const partes = [
    o.alias && `el alias ${NOMBRE_ALIAS[o.alias]}`,
    o.color && `el color ${COLOR[o.color].nombre}`,
  ].filter(Boolean);
  const que = o.alias && o.color ? 'otros' : 'otro';
  return `Otro jugador eligió ${partes.join(' y ')} antes que tú. Elige ${que}.`;
}

/**
 * T81b: el alias y el color propios en la sala de espera. Lo que ya tienen los demás aparece
 * «ocupado». Se abre solo si el anfitrión pide elegir de nuevo.
 */
function MiApariencia({ c, yo }: { c: Coop; yo: JugadorCoop }) {
  const { eleccion, ocupados } = c;
  const debeElegir = eleccion.estado === 'elige';
  const [abierto, setAbierto] = useState(debeElegir || eleccion.ocupado !== null);
  const [alias, setAlias] = useState(yo.alias);
  const [color, setColor] = useState(yo.color);

  // Si el anfitrión pide elegir de nuevo, el selector se abre con algo libre ya marcado. Solo
  // cuando llega la respuesta: no se cambia lo marcado mientras el jugador mira la lista.
  useEffect(() => {
    if (!debeElegir && eleccion.ocupado === null) return;
    setAbierto(true);
    setAlias((a) => primeroLibre(ALIAS, ocupados.alias, a));
    setColor((x) => primeroLibre(COLORES, ocupados.colores, x));
  }, [debeElegir, eleccion.ocupado]);

  // Aceptado: se cierra solo.
  useEffect(() => {
    if (eleccion.estado === 'ok' && eleccion.ocupado === null) setAbierto(false);
  }, [eleccion.estado, eleccion.ocupado]);

  const abrir = (): void => {
    setAlias(primeroLibre(ALIAS, ocupados.alias, yo.alias));
    setColor(primeroLibre(COLORES, ocupados.colores, yo.color));
    setAbierto(true);
  };
  const usar = (e: Event): void => {
    e.preventDefault();
    enviar({ t: 'elegir', alias, color });
  };

  if (!abierto) {
    return (
      <div class="menu-acciones">
        <button type="button" class="boton boton-secundario" onClick={abrir}>
          Cambiar alias o color
        </button>
      </div>
    );
  }
  return (
    <form class="coop-cambiar" onSubmit={usar} aria-label="Tu alias y color">
      <p class="coop-aviso-eleccion" role="alert">
        {eleccion.ocupado
          ? textoOcupado(eleccion.ocupado)
          : debeElegir
            ? 'Elige un alias y un color que nadie más tenga.'
            : ''}
      </p>
      <ListasApariencia
        alias={alias}
        color={color}
        alAlias={setAlias}
        alColor={setColor}
        ocupados={ocupados}
        nombre="espera"
      />
      <div class="menu-acciones">
        <button
          type="submit"
          class="boton boton-principal"
          disabled={eleccion.estado === 'esperando'}
        >
          {eleccion.estado === 'esperando' ? 'Guardando…' : 'Usar este alias y color'}
        </button>
        {!debeElegir && (
          <button type="button" class="boton boton-secundario" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Sala de espera (T81): el código para dictarlo, quiénes están, «listo» e «Iniciar». Solo el
 * anfitrión inicia, y solo cuando todos los demás están listos.
 */
export default function SalaDeEspera({ alSalir }: { alSalir: () => void }) {
  const c = coop.value;
  const salir = (): void => {
    enviar({ t: 'salir' });
    alSalir();
  };
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => tituloRef.current?.focus(), [c.estado]);

  if (c.estado === 'error') {
    return (
      <div class="coop-espera">
        <h2 class="coop-titulo" tabIndex={-1} ref={tituloRef}>
          No se pudo entrar
        </h2>
        <p role="alert">{c.error ? TEXTO_ERROR[c.error] : TEXTO_ERROR.conexion}</p>
        <div class="menu-acciones">
          <button type="button" class="boton boton-principal" onClick={salir}>
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

  if (c.estado === 'conectando') {
    return (
      <div class="coop-espera">
        <h2 class="coop-titulo" tabIndex={-1} ref={tituloRef}>
          Conectando…
        </h2>
        {c.codigo && <p>Partida {c.codigo}</p>}
        <div class="menu-acciones">
          <button type="button" class="boton boton-secundario" onClick={salir}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  const yo = c.jugadores.find((j) => j.yo);
  const listos = c.jugadores.filter((j) => j.conectado && (j.listo || j.anfitrion)).length;
  const conectados = c.jugadores.filter((j) => j.conectado).length;
  const iniciar = puedeIniciar(c.jugadores);
  return (
    <div class="coop-espera">
      <h2 class="coop-titulo" tabIndex={-1} ref={tituloRef}>
        Sala de espera
      </h2>
      <p class="coop-codigo-grande">
        <span>Código</span>
        <strong aria-label={c.codigo ? [...c.codigo].join(' ') : ''}>{c.codigo}</strong>
      </p>
      <p class="menu-nota">
        Tus compañeros tocan «Unirse con código» y escriben este código. Pueden jugar de 2 a 4.
      </p>
      <ul class="coop-jugadores" aria-label="Jugadores">
        {c.jugadores.map((j) => (
          <li key={j.jugador} class="coop-jugador">
            <span
              class={`coop-punto${j.eligiendo ? ' coop-punto-vacio' : ''}`}
              style={j.eligiendo ? undefined : { background: COLOR[j.color].css }}
              aria-hidden="true"
            />
            <span class="coop-jugador-nombre">
              {j.eligiendo ? (j.yo ? 'Tú' : 'Sin alias') : nombreJugador(j)}
            </span>
            <span class="coop-jugador-estado">
              {!j.conectado
                ? 'desconectado'
                : j.eligiendo
                  ? 'eligiendo alias y color'
                  : j.anfitrion
                    ? 'crea la partida'
                    : j.listo
                      ? 'listo'
                      : 'todavía no'}
            </span>
          </li>
        ))}
      </ul>
      {yo && <MiApariencia key={c.codigo} c={c} yo={yo} />}
      <p class="coop-cuenta" role="status">
        {conectados < 2
          ? 'Esperando a que se una alguien más…'
          : `${listos} de ${conectados} listos`}
      </p>
      <div class="menu-acciones">
        {c.soyAnfitrion ? (
          <button
            type="button"
            class="boton boton-principal"
            disabled={!iniciar}
            onClick={() => enviar({ t: 'listo', listo: true })}
          >
            Iniciar
          </button>
        ) : (
          <button
            type="button"
            class={`boton ${yo?.listo ? 'boton-secundario' : 'boton-principal'}`}
            aria-pressed={yo?.listo ?? false}
            disabled={yo?.eligiendo ?? false}
            onClick={() => enviar({ t: 'listo', listo: !(yo?.listo ?? false) })}
          >
            {yo?.listo ? 'Ya no estoy listo' : 'Estoy listo'}
          </button>
        )}
        <button type="button" class="boton boton-secundario" onClick={salir}>
          Salir
        </button>
      </div>
      {c.soyAnfitrion && !iniciar && conectados >= 2 && (
        <p class="menu-nota">
          «Iniciar» se activa cuando todos estén listos y tengan su alias y su color.
        </p>
      )}
    </div>
  );
}
