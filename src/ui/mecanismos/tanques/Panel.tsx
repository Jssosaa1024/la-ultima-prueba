import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EstadoDe } from '../../../content/esquema';
import { duracionCorridaS, nivelEn } from '../../../game/puzzles';
import { inventario } from '../../../signals/partida';
import { Pasos, Respuesta } from '../marco/Controles';
import type { PropsPanel } from '../marco/tipos';
import { lineasDeResultado, PAUSA_MS, textoCaudal, textoNivel, textoRitmo } from './corrida';
import Graficador from './Graficador';
import './tanques.css';

type Estado = EstadoDe<'tanques'>;

/** La hoja del graficador de ayer: con ella en el inventario, sus marcas salen en el papel. */
const HOJA_DE_AYER = 's2-hoja-ayer';
/** Cada cuánto se redibuja el graficador durante la corrida, en segundos (unas 15 veces por segundo). */
const PASO_DIBUJO_S = 0.066;

interface Corrida {
  estado: Estado;
  /** `campana`: ya sonó y los niveles se quedan quietos un momento antes de vaciarse. */
  fase: 'corriendo' | 'campana';
}

/**
 * Sala 2 · Los tanques y el graficador (T52).
 *
 * La perilla verde cambia el caudal del tanque A. Al bajar la palanca (el botón lo pone el
 * marco), el controlador responde de una vez, pero aquí la corrida se ve en tiempo real: dura
 * `duracionCorridaS(etapa)` segundos, el graficador dibuja mientras tanto y lo que pasó se
 * dice cuando suena la campana. Después los tanques vuelven a como estaban y el trazo queda
 * en el papel, más tenue, hasta la corrida siguiente.
 */
export default function PanelTanques({
  etapa,
  numero,
  estado,
  resultado,
  bloqueado,
  ajustar,
  ocupar,
}: PropsPanel<'tanques'>) {
  const duracion = duracionCorridaS(etapa);
  const alto = etapa.controles.altura_cm;
  const { objetivo } = etapa.exito;

  const [corrida, setCorrida] = useState<Corrida | null>(null);
  const [segundo, setSegundo] = useState(0);
  // El resultado que ya estaba al abrir el panel no se corre otra vez: se muestra quieto.
  const visto = useRef(resultado?.n ?? 0);
  /** La última corrida completa: su trazo queda en el papel. */
  const ultima = useRef<Estado | null>(resultado ? resultado.estado : null);
  /** La corrida anterior a la que se está dibujando. */
  const anterior = useRef<Estado | null>(null);
  // Etapa nueva, papel nuevo.
  const etapaDelPapel = useRef(numero);
  if (etapaDelPapel.current !== numero) {
    etapaDelPapel.current = numero;
    ultima.current = resultado ? resultado.estado : null;
    anterior.current = null;
  }

  const respuesta = useRef<HTMLDivElement>(null);
  const n = resultado?.n;
  // La máquina ya respondió, pero la corrida aún no ha empezado a dibujarse: lo que pasó no se
  // dice todavía.
  const porCorrer = resultado !== null && resultado.n !== visto.current;
  // Antes de pintar, para que los botones del marco no alcancen a verse con el resultado nuevo.
  useLayoutEffect(() => {
    if (!resultado || resultado.n === visto.current) return;
    visto.current = resultado.n;
    const corrio = resultado.estado;
    anterior.current = ultima.current;
    setCorrida({ estado: corrio, fase: 'corriendo' });
    setSegundo(0);
    // Mientras corre, el marco esconde sus botones.
    ocupar(true);

    const inicio = performance.now();
    let dibujado = 0;
    let pausa: number | undefined;
    let cuadro = requestAnimationFrame(function paso(ahora: number) {
      const s = Math.min(duracion, (ahora - inicio) / 1000);
      if (s >= duracion) {
        // Suena la campana: los niveles se quedan quietos un momento y luego se vacían.
        setSegundo(duracion);
        setCorrida({ estado: corrio, fase: 'campana' });
        pausa = window.setTimeout(() => {
          ultima.current = corrio;
          setCorrida(null);
          ocupar(false);
        }, PAUSA_MS);
        return;
      }
      if (s - dibujado >= PASO_DIBUJO_S) {
        dibujado = s;
        setSegundo(s);
      }
      cuadro = requestAnimationFrame(paso);
    });
    return () => {
      cancelAnimationFrame(cuadro);
      window.clearTimeout(pausa);
      ocupar(false);
    };
  }, [n]);

  const corriendo = porCorrer || corrida?.fase === 'corriendo';
  // En un celular la respuesta queda al final del panel: al sonar la campana se trae a la vista.
  useEffect(() => {
    if (corrida?.fase === 'campana') respuesta.current?.scrollIntoView({ block: 'nearest' });
  }, [corrida?.fase]);

  // Lo que hay en los tanques: durante la corrida, los ajustes con los que arrancó.
  const enTanques = corrida?.estado ?? estado;
  const s = corrida ? segundo : 0;
  const b = enTanques.b;
  const tieneHoja = inventario.value.some((o) => o.id === HOJA_DE_AYER);
  const ayer = tieneHoja ? (estado.b?.registro ?? null) : null;

  return (
    <>
      <div class="tanques">
        <Tanque
          nombre="A"
          clase="tanque-a"
          nivel={nivelEn(enTanques.a, s, alto)}
          alto={alto}
          meta={objetivo.tipo === 'linea' ? objetivo.nivel : null}
        />
        {b &&
          (b.visible ? (
            <Tanque
              nombre="B"
              clase="tanque-b"
              nivel={nivelEn(b, s, alto)}
              alto={alto}
              meta={null}
            />
          ) : (
            <div class="tanque tanque-tapado">
              <div class="tanque-vidrio" aria-hidden="true" />
              <p class="tanque-nombre">Tanque B</p>
              <p class="tanque-nivel">tapado</p>
            </div>
          ))}
        <Graficador
          etapa={etapa}
          corrida={corrida ? { estado: corrida.estado, hastaS: s } : null}
          anterior={corrida ? anterior.current : ultima.current}
          ayer={ayer}
        />
      </div>

      <p class="corrida-reloj">
        {corrida
          ? corriendo
            ? `Corriendo: ${Math.floor(s)} de ${duracion} segundos.`
            : '¡Suena la campana!'
          : `La campana suena a los ${duracion} segundos.`}
      </p>

      {etapa.controles.perillas.includes('a') && (
        <Pasos
          etiqueta="Perilla verde: caudal del tanque A"
          valor={estado.a.caudal}
          min={etapa.controles.caudal_min}
          max={etapa.controles.caudal_max}
          texto={textoCaudal(estado.a.caudal)}
          bloqueado={bloqueado || porCorrer || corrida !== null}
          alCambiar={(caudal) => ajustar({ ...estado, a: { ...estado.a, caudal } })}
        />
      )}
      <ul class="tanques-datos">
        <li>
          El tanque A empieza en {textoNivel(estado.a.nivel)} y {textoRitmo(estado.a.caudal)}.
        </li>
        {estado.b &&
          (estado.b.visible ? (
            <li>
              El tanque B empieza en {textoNivel(estado.b.nivel)} y {textoRitmo(estado.b.caudal)}.
              Su perilla está bloqueada.
            </li>
          ) : (
            <li>
              El tanque B está tapado con cinta: no se ve su nivel y el graficador no lo dibuja. Su
              perilla está bloqueada.
            </li>
          ))}
        {ayer && <li>Las marcas «ayer» del graficador son las de la hoja que recogiste.</li>}
      </ul>

      {resultado && !corriendo && (
        <div ref={respuesta}>
          <Respuesta titulo="Lo que pasó">
            {lineasDeResultado(etapa, resultado.estado, resultado.resuelta, resultado.sello).map(
              (linea) => (
                <p key={linea}>{linea}</p>
              ),
            )}
          </Respuesta>
        </div>
      )}
    </>
  );
}

interface PropsTanque {
  nombre: string;
  clase: string;
  nivel: number;
  alto: number;
  /** Altura de la línea roja pintada en el vidrio, si la hay. */
  meta: number | null;
}

/** Un cilindro visto de lado: el líquido sube y baja con el nivel. */
function Tanque({ nombre, clase, nivel, alto, meta }: PropsTanque) {
  return (
    <div class={`tanque ${clase}`}>
      <div class="tanque-vidrio" aria-hidden="true">
        <div class="tanque-liquido" style={{ height: `${(nivel / alto) * 100}%` }} />
        {meta !== null && <div class="tanque-meta" style={{ bottom: `${(meta / alto) * 100}%` }} />}
      </div>
      <p class="tanque-nombre">Tanque {nombre}</p>
      <p class="tanque-nivel">{textoNivel(nivel)}</p>
    </div>
  );
}
