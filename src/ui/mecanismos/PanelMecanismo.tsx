import type { ComponentChildren, ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Mecanismo, Puzzle } from '../../content/esquema';
import { PUZZLES, puzzleDeSala } from '../../content/puzzles';
import { esEstadoValido, evaluar } from '../../game/puzzles';
import { cerrarPanel, franja, panelRecogido, resultadoVisto } from '../../signals/interfaz';
import {
  condiciones,
  etapa,
  maquinaResuelta,
  mecanismo,
  pistas,
  resultado,
} from '../../signals/mecanismo';
import { coop, esperaD, misRoles, propuestaCoop, reparto } from '../../signals/coop';
import { modo, sala, SALAS_CON_SELLO } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { useRestanteEspera } from '../coop/BarraCoop';
import { aliasDe, textoCuenta, textoEsperaD } from '../coop/textos';
import { anotacionDeEtapa } from '../cuaderno/descubrimientos';
import Dialogo from '../paneles/Dialogo';
import { SeccionPistas } from '../pistas/Pistas';
import { msRecogido } from './marco/recoger';
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
 *
 * En franja (correcciones del 25 nov): en horizontal, los controles van en una columna a la
 * derecha y la máquina 3D se ve a la izquierda. Al accionar, el panel se recoge a una pestaña
 * mientras la máquina se mueve y vuelve con lo que pasó; «Ver» lo recoge cuando el jugador
 * quiera. Las pistas se abren en el mismo lugar, con su botón.
 */
export default function PanelMecanismo() {
  const [ocupado, setOcupado] = useState(false);
  /** El jugador tocó «Ver»: el panel se recoge hasta que toque la pestaña. */
  const [verEscena, setVerEscena] = useState(false);
  /** La máquina se mueve tras accionarla: el panel vuelve solo cuando termina. */
  const [trabajando, setTrabajando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [verPistas, setVerPistas] = useState(false);
  /** Fracción del ancho que tapa la columna (0 en vertical). */
  const [ancho, setAncho] = useState(0);
  const recogido = verEscena || trabajando;

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

  // Cada respuesta nueva a un accionar (palanca, polea, manija) recoge el panel mientras la
  // máquina 3D se mueve. El resultado que ya estaba al abrir no lo recoge.
  const r = resultado.value;
  const ultimo = useRef(r?.n ?? 0);
  const reloj = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!r || !puzzle || r.n <= ultimo.current || r.puzzle !== puzzle.id) return;
    ultimo.current = r.n;
    if (puzzle.etapas[r.etapa]?.intento.tipo !== 'accionar') return;
    setVerEscena(false);
    setVerPistas(false);
    setTrabajando(true);
    setEsperando(true);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(
      () => setEsperando(false),
      msRecogido(puzzle.mecanismo, r.sello),
    );
  }, [r?.n]);
  useEffect(() => () => window.clearTimeout(reloj.current), []);
  // Vuelve cuando pasó el tiempo de la animación y el panel de la sala ya no está ocupado.
  useEffect(() => {
    if (trabajando && !esperando && !ocupado) setTrabajando(false);
  }, [trabajando, esperando, ocupado]);

  // El motor encuadra la máquina en lo que la columna deja libre (sesión A).
  useEffect(() => {
    franja.value = { derecha: recogido ? 0 : ancho };
    panelRecogido.value = recogido;
  }, [recogido, ancho]);
  useEffect(
    () => () => {
      franja.value = { derecha: 0 };
      panelRecogido.value = false;
    },
    [],
  );

  if (!puzzle) return null;

  const volver = (): void => {
    setVerEscena(false);
    setTrabajando(false);
  };
  const enFranja = (
    titulo: string,
    antetitulo: string,
    cuerpo: ComponentChildren,
    acciones?: ComponentChildren,
  ) => (
    <Dialogo
      antetitulo={antetitulo}
      titulo={titulo}
      cerrarSecundario
      alCerrar={cerrarPanel}
      acciones={acciones}
      franja={{
        recogido,
        alMedir: setAncho,
        cabecera: (
          <button
            type="button"
            class="boton boton-secundario"
            aria-label="Ver la máquina"
            onClick={() => setVerEscena(true)}
          >
            Ver
          </button>
        ),
        pestana: (
          <button
            type="button"
            class="boton boton-principal"
            aria-label="Mostrar los controles"
            onClick={volver}
          >
            <span aria-hidden="true">◀ </span>
            {trabajando ? 'Mirando…' : 'Controles'}
          </button>
        ),
      }}
    >
      {cuerpo}
    </Dialogo>
  );

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
    // En franja basta el aviso: la máquina se ve en 3D a la izquierda.
    const ultima = puzzle.etapas.length - 1;
    const final = maquinaResuelta.value;
    const datosFinales = puzzle.etapas[ultima];
    const evaluacion = evaluar(puzzle, ultima, final);
    return enFranja(
      puzzle.titulo,
      `Sala ${puzzle.sala}`,
      <>
        <p class="mecanismo-resuelta">{TEXTO_TERMINADA}</p>
        {datosFinales && evaluacion && (
          <div class="mecanismo-maquina mecanismo-maquina-quieta">
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
          </div>
        )}
      </>,
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
  // Lo que respondió la máquina al accionarla reemplaza a la situación, que ya se leyó.
  const conRespuesta = resuelta || (vista.resultado !== null && regla.tipo === 'accionar');
  const { ofrecidas, vistas } = pistas.value;
  const hayPistas = !resuelta && ofrecidas > 0;
  const mostrarPistas = verPistas && hayPistas;

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

  const acciones =
    !ocupado &&
    !mostrarPistas &&
    (resuelta ? (
      <button type="button" class="boton boton-principal" onClick={seguir}>
        {vista.sello ? 'Volver a la sala' : 'Seguir'}
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
    ));

  return enFranja(
    puzzle.titulo,
    textoEtapa(puzzle.sala, vista.numero, puzzle.etapas.length),
    <>
      {mostrarPistas && (
        <div class="mecanismo-pistas">
          <SeccionPistas />
          <button type="button" class="boton boton-secundario" onClick={() => setVerPistas(false)}>
            Volver a la máquina
          </button>
        </div>
      )}
      {/* La máquina sigue montada con las pistas abiertas: la corrida de los tanques sigue. */}
      <div class={`mecanismo-contenido${mostrarPistas ? ' mecanismo-oculto' : ''}`}>
        <Situacion key={datos.situacion} texto={datos.situacion} leida={conRespuesta} />
        {enGrupo && !resuelta && <EstadoGrupo soyD={soyD} />}
        <div class={`mecanismo-maquina${resuelta ? ' mecanismo-maquina-quieta' : ''}`}>
          <Panel {...props} />
        </div>
        {!enGrupo && !resuelta && regla.tipo === 'reposo' && (
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
        {hayPistas && (
          <button
            type="button"
            class="boton boton-secundario mecanismo-boton-pistas"
            onClick={() => setVerPistas(true)}
          >
            {vistas < ofrecidas ? 'Pista nueva' : 'Pistas'}
          </button>
        )}
      </div>
    </>,
    acciones,
  );
}

/**
 * La situación de la etapa. En la franja ocupa hasta dos renglones; si no cabe, tocarla la
 * muestra completa (y el panel se desplaza solo entonces) y otro toque la vuelve a recoger.
 * Con lo que respondió la máquina a la vista, se esconde: ya se leyó.
 */
function Situacion({ texto, leida }: { texto: string; leida: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [cortada, setCortada] = useState(false);
  useLayoutEffect(() => {
    const medir = (): void => {
      const p = ref.current;
      if (p && !abierta) setCortada(p.scrollHeight > p.clientHeight + 1);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [abierta]);
  const clases = ['mecanismo-situacion'];
  if (leida) clases.push('mecanismo-situacion-leida');
  if (abierta) clases.push('mecanismo-situacion-abierta');
  const tocable = !leida && (cortada || abierta);
  if (tocable) clases.push('mecanismo-situacion-tocable');
  const alternar = (): void => setAbierta((a) => !a);
  return (
    <p
      class={clases.join(' ')}
      role={tocable ? 'button' : undefined}
      tabIndex={tocable ? 0 : undefined}
      aria-expanded={tocable ? abierta : undefined}
      onClick={tocable ? alternar : undefined}
      onKeyDown={
        tocable
          ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              alternar();
            }
          : undefined
      }
    >
      <span ref={ref} class="mecanismo-situacion-texto">
        {texto}
      </span>
      {tocable && (
        <span class="mecanismo-situacion-mas" aria-hidden="true">
          {abierta ? ' ▴ menos' : '… más ▾'}
        </span>
      )}
    </p>
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
