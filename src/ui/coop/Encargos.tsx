import { puzzleDeSala } from '../../content/puzzles';
import { nombreDeObjeto } from '../../content/salas';
import { misRoles } from '../../signals/coop';
import { sala, SALAS_CON_SELLO } from '../../signals/partida';
import './coop.css';

/**
 * La pista de cada encargo de este jugador en la sala actual (T86, `pista_por_jugador`): qué
 * objeto le toca mirar y qué hay en él. Cada quien ve solo la suya; para resolver hay que
 * contárselas.
 */
export default function Encargos({ titulo = 'Tu encargo en esta sala' }: { titulo?: string }) {
  const numero = SALAS_CON_SELLO.findIndex((s) => s === sala.value) + 1;
  const puzzle = puzzleDeSala(numero);
  const roles = misRoles.value;
  if (!puzzle || roles.length === 0) return null;
  return (
    <section class="cuaderno-seccion coop-encargo" aria-labelledby="coop-encargo-titulo">
      <h3 id="coop-encargo-titulo" class="cuaderno-subtitulo">
        {roles.length === 1 ? titulo : titulo.replace('Tu encargo', 'Tus encargos')}
      </h3>
      <ul class="coop-encargo-lista">
        {roles.map((rol) => {
          const p = puzzle.pista_por_jugador[rol];
          return (
            <li key={rol}>
              <p class="coop-encargo-rol">
                Encargo {rol} · {nombreDeObjeto(p.objeto) ?? ''}
              </p>
              <p>{p.texto}</p>
            </li>
          );
        })}
      </ul>
      <p class="cuaderno-vacio">Cuéntale al grupo lo que encuentres: los demás no lo ven.</p>
    </section>
  );
}
