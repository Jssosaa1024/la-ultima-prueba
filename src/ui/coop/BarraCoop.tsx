import { useEffect, useState } from 'preact/hooks';
import {
  coop,
  esperaD,
  misRoles,
  propuestaCoop,
  votosCoop,
  type EsperaD,
  type VotoCoop,
} from '../../signals/coop';
import { abrirPanel, panel } from '../../signals/interfaz';
import { reloj } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { aliasDe, textoCuenta, textoEncargos, textoEsperaD, textoVoto } from './textos';
import '../botones.css';
import './coop.css';

/** Milisegundos que le quedan a la espera de D, redibujando una vez por segundo. */
export function useRestanteEspera(espera: EsperaD | null): number {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!espera) return;
    const id = window.setInterval(() => setTic((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [espera]);
  if (!espera) return 0;
  return Math.max(0, espera.faltanMs - (performance.now() - espera.desde));
}

/**
 * Lo que el grupo tiene abierto, encima de la escena (T85, T87): los encargos de este
 * jugador, a quién se espera, la propuesta de la máquina y los votos. Cada voto se acepta o se
 * retira desde aquí; la máquina se acepta o rechaza en su panel.
 */
export default function BarraCoop() {
  const jugadores = coop.value.jugadores;
  const yo = jugadores.find((j) => j.yo)?.jugador ?? '';
  const espera = esperaD.value;
  const restante = useRestanteEspera(espera);
  const propuesta = propuestaCoop.value;
  const votos = votosCoop.value;
  const pausado = reloj.value.pausado;
  const roles = misRoles.value;
  const hayVoto = (asunto: VotoCoop['asunto']) => votos.some((v) => v.asunto === asunto);

  return (
    <section class="coop-barra" aria-label="Grupo">
      <div class="coop-barra-fila">
        {roles.length > 0 && <p class="coop-encargos">{textoEncargos(roles)}</p>}
        {!pausado && !hayVoto('pausa') && (
          <button
            type="button"
            class="hud-boton-redondo"
            onClick={() => enviar({ t: 'votar', asunto: 'pausa', opcion: null, acepta: true })}
          >
            Pausar
          </button>
        )}
      </div>
      {espera && (
        <p class="coop-aviso" role="status">
          {textoEsperaD(aliasDe(jugadores, espera.jugador), restante)}
        </p>
      )}
      {pausado && !hayVoto('reanudar') && (
        <div class="coop-aviso">
          <p>El reloj está en pausa.</p>
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => enviar({ t: 'votar', asunto: 'reanudar', opcion: null, acepta: true })}
          >
            Reanudar
          </button>
        </div>
      )}
      {propuesta && !propuesta.aceptan.includes(yo) && panel.value !== 'mecanismo' && (
        <div class="coop-aviso">
          <p>{aliasDe(jugadores, propuesta.por)} propone unos ajustes en la máquina.</p>
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => abrirPanel('mecanismo')}
          >
            Ver propuesta
          </button>
        </div>
      )}
      {votos.map((v) => {
        const vote = v.votos.includes(yo);
        return (
          <div key={v.asunto} class="coop-aviso" role="group" aria-label="Votación">
            <p>
              {textoVoto(v, jugadores)} {textoCuenta(v.votos, jugadores)}
            </p>
            {vote ? (
              <button
                type="button"
                class="boton boton-secundario"
                onClick={() =>
                  enviar({ t: 'votar', asunto: v.asunto, opcion: v.opcion, acepta: false })
                }
              >
                Retirar mi voto
              </button>
            ) : (
              <button
                type="button"
                class="boton boton-principal"
                onClick={() =>
                  enviar({ t: 'votar', asunto: v.asunto, opcion: v.opcion, acepta: true })
                }
              >
                Aceptar
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
