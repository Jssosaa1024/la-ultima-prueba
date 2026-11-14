import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Mecanismo, Puzzle } from '../../content/esquema';
import { PUZZLES, puzzleDeSala } from '../../content/puzzles';
import { esEstadoValido } from '../../game/puzzles';
import { cerrarPanel, resultadoVisto } from '../../signals/interfaz';
import { condiciones, etapa, mecanismo, resultado } from '../../signals/mecanismo';
import { sala, SALAS_CON_SELLO } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { anotacionDeEtapa } from '../cuaderno/descubrimientos';
import Dialogo from '../paneles/Dialogo';
import { SeccionPistas } from '../pistas/Pistas';
import type { PropsPanel } from './marco/tipos';
import { vistaDelPanel } from './marco/vista';
import { PANELES } from './paneles';
import { TEXTO_ACCIONAR, TEXTO_TERMINADA, textoEtapa, textoReposo, textoResuelta } from './textos';
import './mecanismos.css';

/**
 * Panel de mecanismo (T37): el marco común de las cinco máquinas. Se abre al usar un objeto
 * de la máquina en su sala; el objeto 3D solo anima.
 *
 * El marco decide qué etapa se muestra, pone la situación, el botón de accionar y el paso a
 * la etapa siguiente, y le entrega al panel de la sala (`paneles.ts`) los ajustes ya
 * revisados. Los ajustes viajan por el puente: `ajustar` y `accionar`.
 */
export default function PanelMecanismo() {
  const [ocupado, setOcupado] = useState(false);
  const numeroDeSala = SALAS_CON_SELLO.findIndex((s) => s === sala.value) + 1;
  const puzzle = puzzleDeSala(numeroDeSala);

  // Sin máquina en este lugar (la portería), el panel no tiene nada que mostrar.
  useEffect(() => {
    if (!puzzle) cerrarPanel();
  }, [puzzle]);
  if (!puzzle) return null;

  const vista = vistaDelPanel({
    puzzle,
    etapa: etapa.value,
    estado: mecanismo.value,
    condiciones: condiciones.value,
    resultado: resultado.value,
    visto: resultadoVisto.value,
  });

  if (vista.tipo === 'terminada') {
    return (
      <Dialogo antetitulo={`Sala ${puzzle.sala}`} titulo={puzzle.titulo} alCerrar={cerrarPanel}>
        <p>{TEXTO_TERMINADA}</p>
      </Dialogo>
    );
  }

  const datos = puzzle.etapas[vista.numero];
  // Los ajustes llegan de un signal sin tipo: solo se dibujan si valen para esta etapa.
  if (!datos || !esEstadoValido(puzzle, vista.numero, vista.estado)) return null;

  const resuelta = vista.tipo === 'resuelta';
  const regla = datos.intento;
  const seguir = (): void => {
    if (vista.tipo !== 'resuelta') return;
    resultadoVisto.value = vista.resultado.n;
    // Con el sello ya no queda etapa que mostrar: se vuelve a la sala.
    if (vista.sello) cerrarPanel();
  };

  // El panel de cada sala recibe los tipos de su mecanismo; aquí se tratan todos igual.
  const Panel = PANELES[puzzle.mecanismo] as ComponentType<PropsPanel<Mecanismo>>;
  const props = {
    puzzle,
    etapa: datos,
    numero: vista.numero,
    estado: vista.estado,
    condiciones: vista.condiciones,
    resultado: vista.resultado,
    bloqueado: resuelta,
    ajustar: (estado: unknown) => enviar({ t: 'ajustar', estado }),
    ocupar: setOcupado,
  } as PropsPanel<Mecanismo>;

  return (
    <Dialogo
      antetitulo={textoEtapa(puzzle.sala, vista.numero, puzzle.etapas.length)}
      titulo={puzzle.titulo}
      cerrarSecundario
      alCerrar={cerrarPanel}
      acciones={
        !ocupado &&
        (resuelta ? (
          <button type="button" class="boton boton-principal" onClick={seguir}>
            {vista.sello ? 'Volver a la sala' : 'Seguir'}
          </button>
        ) : (
          regla.tipo === 'accionar' && (
            <button
              type="button"
              class="boton boton-principal"
              onClick={() => enviar({ t: 'accionar', objeto: regla.objeto })}
            >
              {TEXTO_ACCIONAR[puzzle.mecanismo]}
            </button>
          )
        ))
      }
    >
      <p class="mecanismo-situacion">{datos.situacion}</p>
      <Panel {...props} />
      {!resuelta && regla.tipo === 'reposo' && (
        <p class="mecanismo-nota">{textoReposo(regla.segundos)}</p>
      )}
      {resuelta && !ocupado && (
        <>
          <p class="mecanismo-resuelta" role="status">
            {textoResuelta(vista.sello, puzzle.sala, PUZZLES.length)}
          </p>
          <Anotacion puzzle={puzzle} etapa={vista.numero} sello={vista.sello} />
        </>
      )}
      {!resuelta && <SeccionPistas />}
    </Dialogo>
  );
}

/**
 * Lo que el cuaderno anota al resolver una etapa (T38): lo que pasó y, solo con el sello, el
 * nombre de lo descubierto. El concepto nunca se nombra antes de resolver.
 */
function Anotacion({ puzzle, etapa, sello }: { puzzle: Puzzle; etapa: number; sello: boolean }) {
  const anotacion = anotacionDeEtapa(puzzle, etapa, sello);
  if (!anotacion) return null;
  return (
    <div class="anotacion">
      <p class="anotacion-titulo">Tu cuaderno anotó</p>
      <p>{anotacion.paso}</p>
      {anotacion.concepto && (
        <>
          <p class="anotacion-concepto">
            Lo que acabas de descubrir se llama: {anotacion.concepto.nombre}
          </p>
          <p>{anotacion.concepto.texto}</p>
        </>
      )}
    </div>
  );
}
