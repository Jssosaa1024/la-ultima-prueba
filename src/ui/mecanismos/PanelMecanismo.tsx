import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Mecanismo, Puzzle } from '../../content/esquema';
import { PUZZLES, puzzleDeSala } from '../../content/puzzles';
import { esEstadoValido, evaluar } from '../../game/puzzles';
import { cerrarPanel, resultadoVisto } from '../../signals/interfaz';
import { condiciones, etapa, maquinaResuelta, mecanismo, resultado } from '../../signals/mecanismo';
import { coop, esperaD, misRoles, propuestaCoop, reparto } from '../../signals/coop';
import { modo, sala, SALAS_CON_SELLO } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { useRestanteEspera } from '../coop/BarraCoop';
import { aliasDe, textoCuenta, textoEsperaD } from '../coop/textos';
import { anotacionDeEtapa } from '../cuaderno/descubrimientos';
import Dialogo from '../paneles/Dialogo';
import { BotonPistaNueva, SeccionPistas } from '../pistas/Pistas';
import type { PropsPanel } from './marco/tipos';
import { vistaDelPanel } from './marco/vista';
import { PANELES } from './paneles';
import {
  TEXTO_ACCIONAR,
  TEXTO_TERMINADA,
  textoEstacionResuelta,
  textoEtapa,
  textoReposo,
  textoResuelta,
} from './textos';
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
  // En grupo (T85) solo quien tiene D mueve los controles y propone; nadie mientras se le espera.
  const enGrupo = modo.value === 'cooperativo';
  const espera = esperaD.value;
  const soyD = !enGrupo || (misRoles.value.includes('D') && espera === null);
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

  // El panel de cada sala recibe los tipos de su mecanismo; aquí se tratan todos igual.
  const Panel = PANELES[puzzle.mecanismo] as ComponentType<PropsPanel<Mecanismo>>;

  if (vista.tipo === 'terminada') {
    // La sala ya tiene sello: la máquina se muestra como quedó, sin dejar cambiar nada (T76).
    const ultima = puzzle.etapas.length - 1;
    const final = maquinaResuelta.value;
    const datosFinales = puzzle.etapas[ultima];
    const evaluacion = evaluar(puzzle, ultima, final);
    return (
      <Dialogo antetitulo={`Sala ${puzzle.sala}`} titulo={puzzle.titulo} alCerrar={cerrarPanel}>
        <p class="mecanismo-resuelta">{TEXTO_TERMINADA}</p>
        {datosFinales && evaluacion && (
          <Panel
            {...({
              puzzle,
              etapa: datosFinales,
              numero: ultima,
              estado: final,
              condiciones: evaluacion.condiciones,
              resultado: null,
              bloqueado: true,
              ajustar: () => undefined,
              ocupar: () => undefined,
            } as PropsPanel<Mecanismo>)}
          />
        )}
      </Dialogo>
    );
  }

  const datos = puzzle.etapas[vista.numero];
  // Los ajustes llegan de un signal sin tipo: solo se dibujan si valen para esta etapa.
  if (!datos || !esEstadoValido(puzzle, vista.numero, vista.estado)) return null;

  const resuelta = vista.tipo === 'resuelta';
  const regla = datos.intento;
  // Sala 2: la etapa siguiente está en otra estación (corrección del 25 de noviembre).
  const porEstaciones = puzzle.mecanismo === 'tanques';
  const volverALaSala = resuelta && (vista.sello || porEstaciones);
  const seguir = (): void => {
    if (vista.tipo !== 'resuelta') return;
    resultadoVisto.value = vista.resultado.n;
    // Con el sello ya no queda etapa que mostrar, y en la sala 2 la siguiente se juega en su
    // propia estación: se vuelve a la sala.
    if (volverALaSala) cerrarPanel();
  };

  const props = {
    puzzle,
    etapa: datos,
    numero: vista.numero,
    estado: vista.estado,
    condiciones: vista.condiciones,
    resultado: vista.resultado,
    bloqueado: resuelta || !soyD,
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
        !ocupado && (
          <>
            {!resuelta && <BotonPistaNueva />}
            {resuelta ? (
              <button type="button" class="boton boton-principal" onClick={seguir}>
                {volverALaSala ? 'Volver a la sala' : 'Seguir'}
              </button>
            ) : enGrupo ? (
              <AccionesGrupo soyD={soyD} accionar={regla.tipo === 'accionar' ? regla.objeto : null}>
                {regla.tipo === 'accionar' ? TEXTO_ACCIONAR[puzzle.mecanismo] : 'Proponer al grupo'}
              </AccionesGrupo>
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
            )}
          </>
        )
      }
    >
      <p class="mecanismo-situacion">{datos.situacion}</p>
      {enGrupo && !resuelta && <EstadoGrupo soyD={soyD} />}
      <Panel {...props} />
      {!enGrupo && !resuelta && regla.tipo === 'reposo' && (
        <p class="mecanismo-nota">{textoReposo(regla.segundos)}</p>
      )}
      {resuelta && !ocupado && (
        <>
          <p class="mecanismo-resuelta" role="status">
            {porEstaciones && !vista.sello
              ? textoEstacionResuelta(vista.numero)
              : textoResuelta(vista.sello, puzzle.sala, PUZZLES.length)}
          </p>
          <Anotacion puzzle={puzzle} etapa={vista.numero} sello={vista.sello} />
        </>
      )}
      {!resuelta && <SeccionPistas />}
    </Dialogo>
  );
}

/**
 * Botones de la máquina en grupo (T85): quien tiene D propone (con la palanca, si la máquina
 * la tiene); los demás aceptan o rechazan la propuesta abierta.
 */
function AccionesGrupo({
  soyD,
  accionar,
  children,
}: {
  soyD: boolean;
  accionar: string | null;
  children: string;
}) {
  const propuesta = propuestaCoop.value;
  const yo = coop.value.jugadores.find((j) => j.yo)?.jugador ?? '';
  if (esperaD.value) return null;
  if (soyD) {
    return (
      <button
        type="button"
        class="boton boton-principal"
        onClick={() =>
          enviar(accionar === null ? { t: 'proponer' } : { t: 'accionar', objeto: accionar })
        }
      >
        {children}
      </button>
    );
  }
  if (!propuesta || propuesta.aceptan.includes(yo)) return null;
  return (
    <>
      <button
        type="button"
        class="boton boton-principal"
        onClick={() => enviar({ t: 'confirmar', acepta: true })}
      >
        Aceptar
      </button>
      <button
        type="button"
        class="boton boton-secundario"
        onClick={() => enviar({ t: 'confirmar', acepta: false })}
      >
        Rechazar
      </button>
    </>
  );
}

/** Quién acciona la máquina, qué se propuso y quién falta por aceptar (T85, T89). */
function EstadoGrupo({ soyD }: { soyD: boolean }) {
  const jugadores = coop.value.jugadores;
  const espera = esperaD.value;
  const restante = useRestanteEspera(espera);
  const propuesta = propuestaCoop.value;
  const yo = jugadores.find((j) => j.yo)?.jugador ?? '';
  let texto: string;
  if (espera) {
    texto = `${textoEsperaD(aliasDe(jugadores, espera.jugador), restante)} Mientras tanto nadie acciona la máquina.`;
  } else if (propuesta) {
    const quien = aliasDe(jugadores, propuesta.por);
    const inicio =
      quien === 'tú'
        ? 'Propusiste estos ajustes.'
        : `${quien} propone estos ajustes.${propuesta.aceptan.includes(yo) ? ' Ya aceptaste.' : ''}`;
    texto = `${inicio} ${textoCuenta(propuesta.aceptan, jugadores)} La máquina responde cuando todos acepten.`;
  } else if (soyD) {
    texto =
      'Tienes el encargo D: prueba los ajustes y propónselos al grupo. La máquina responde cuando todos acepten.';
  } else {
    const d = reparto.value?.D;
    const quien = d ? aliasDe(jugadores, d) : 'Quien tiene el encargo D';
    texto = `${quien} tiene el encargo D: prueba los ajustes y los propone. Cuando lo haga, aquí podrás aceptarlos o rechazarlos.`;
  }
  return (
    <p class="coop-propuesta" role="status">
      {texto}
    </p>
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
