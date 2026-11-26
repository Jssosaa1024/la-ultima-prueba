import { puzzleDeSala } from '../../content/puzzles';
import { cerrarPanel } from '../../signals/interfaz';
import { pistas } from '../../signals/mecanismo';
import { sala, SALAS_CON_SELLO } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import Dialogo from '../paneles/Dialogo';
import '../botones.css';
import './pistas.css';

/**
 * Pistas graduales del puzzle de la sala actual (T38).
 *
 * El controlador las ofrece por tiempo o por intentos (signal `pistas`), pero abrirlas es
 * decisión del jugador: cada una se abre con «Ver pista», en orden. Las pistas invitan a
 * mirar algo; nunca dan pasos de cálculo.
 */

/** Lista de pistas abiertas y botón para abrir la siguiente. Va en su panel y en el de la máquina. */
export function SeccionPistas() {
  const numero = SALAS_CON_SELLO.findIndex((s) => s === sala.value) + 1;
  const puzzle = puzzleDeSala(numero);
  const { ofrecidas, vistas } = pistas.value;
  if (!puzzle || ofrecidas === 0) return null;

  const abiertas = puzzle.pistas.slice(0, vistas);
  const hayNueva = vistas < ofrecidas;
  return (
    <section class="pistas" aria-labelledby="pistas-titulo">
      <h3 id="pistas-titulo" class="pistas-titulo">
        Pistas ({vistas} de {puzzle.pistas.length} abiertas)
      </h3>
      {abiertas.length > 0 && (
        <ol class="pistas-lista">
          {abiertas.map((p) => (
            <li key={p.nivel} class="pistas-pista">
              {p.texto}
            </li>
          ))}
        </ol>
      )}
      {hayNueva ? (
        <button
          type="button"
          class="boton boton-secundario"
          onClick={() => enviar({ t: 'ver_pista' })}
        >
          {vistas === 0 ? 'Ver pista' : 'Ver otra pista'}
        </button>
      ) : (
        <p class="pistas-nota">
          {vistas < puzzle.pistas.length
            ? 'No hay otra pista por ahora. Sigue probando: la máquina te muestra lo que pasa.'
            : 'Ya abriste las tres pistas de esta máquina.'}
        </p>
      )}
    </section>
  );
}

/** Panel de pistas, desde el botón «Pista» del HUD. */
export default function PanelPistas() {
  const numero = SALAS_CON_SELLO.findIndex((s) => s === sala.value) + 1;
  const puzzle = puzzleDeSala(numero);
  return (
    <Dialogo
      antetitulo={puzzle ? `Sala ${puzzle.sala}` : 'Pistas'}
      titulo={puzzle ? puzzle.titulo : 'Pistas'}
      retorno="pistas"
      alCerrar={cerrarPanel}
    >
      {puzzle && pistas.value.ofrecidas > 0 ? (
        <SeccionPistas />
      ) : (
        <p>Aquí todavía no hay pistas. Aparecen después de un rato o de varios intentos.</p>
      )}
    </Dialogo>
  );
}
