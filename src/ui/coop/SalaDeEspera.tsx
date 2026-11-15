import { useEffect, useRef } from 'preact/hooks';
import { coop, puedeIniciar, type ErrorCoop, type JugadorCoop } from '../../signals/coop';
import { enviar } from '../../signals/puente';
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

/**
 * Sala de espera (T81): el código para dictarlo, quiénes están, «listo» e «Iniciar». Solo el
 * anfitrión inicia, y solo cuando todos los demás están listos.
 */
export default function SalaDeEspera() {
  const c = coop.value;
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
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => enviar({ t: 'salir' })}
          >
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
          <button
            type="button"
            class="boton boton-secundario"
            onClick={() => enviar({ t: 'salir' })}
          >
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
              class="coop-punto"
              style={{ background: COLOR[j.color].css }}
              aria-hidden="true"
            />
            <span class="coop-jugador-nombre">{nombreJugador(j)}</span>
            <span class="coop-jugador-estado">
              {!j.conectado
                ? 'desconectado'
                : j.anfitrion
                  ? 'crea la partida'
                  : j.listo
                    ? 'listo'
                    : 'todavía no'}
            </span>
          </li>
        ))}
      </ul>
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
            onClick={() => enviar({ t: 'listo', listo: !(yo?.listo ?? false) })}
          >
            {yo?.listo ? 'Ya no estoy listo' : 'Estoy listo'}
          </button>
        )}
        <button type="button" class="boton boton-secundario" onClick={() => enviar({ t: 'salir' })}>
          Salir
        </button>
      </div>
      {c.soyAnfitrion && !iniciar && conectados >= 2 && (
        <p class="menu-nota">«Iniciar» se activa cuando todos estén listos.</p>
      )}
    </div>
  );
}
