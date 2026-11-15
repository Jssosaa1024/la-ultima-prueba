import type { EstadoDe, EtapaDe } from '../../../content/esquema';
import { EJE_S, trazo, type Punto } from './corrida';

type Etapa = EtapaDe<'tanques'>;
type Estado = EstadoDe<'tanques'>;

interface Props {
  etapa: Etapa;
  /** La corrida que se está dibujando y hasta qué segundo va; `null` si no hay ninguna. */
  corrida: { estado: Estado; hastaS: number } | null;
  /** La corrida anterior completa: queda dibujada, más tenue, hasta la siguiente. */
  anterior: Estado | null;
  /** Marcas de la hoja de ayer (tanque B), si el jugador la tiene. */
  ayer: readonly { t: number; nivel: number }[] | null;
}

// Medidas del dibujo, en unidades del viewBox.
const ANCHO = 320;
const ALTO = 210;
const IZQ = 34;
const DER = 10;
const ARRIBA = 12;
const ABAJO = 26;

/**
 * El graficador de tinta (T52): altura de cada tanque contra el tiempo. A es verde y de
 * trazo continuo; B, morado y de trazo cortado, para que el color no sea el único dato. Un
 * tanque tapado no se dibuja.
 */
export default function Graficador({ etapa, corrida, anterior, ayer }: Props) {
  const alto = etapa.controles.altura_cm;
  const { campana_s: campana, objetivo } = etapa.exito;
  const x = (s: number): number => IZQ + (s / EJE_S) * (ANCHO - IZQ - DER);
  const y = (cm: number): number => ARRIBA + (1 - cm / alto) * (ALTO - ARRIBA - ABAJO);
  const linea = (puntos: readonly Punto[]): string =>
    puntos.map(([s, cm]) => `${x(s).toFixed(1)},${y(cm).toFixed(1)}`).join(' ');

  /** Los trazos de una corrida: A siempre; B solo si existe y se ve. */
  const trazos = (estado: Estado, hastaS: number, clase: string) => (
    <g class={clase}>
      <polyline class="trazo trazo-a" points={linea(trazo(estado.a, hastaS, alto))} />
      {estado.b?.visible && (
        <polyline class="trazo trazo-b" points={linea(trazo(estado.b, hastaS, alto))} />
      )}
    </g>
  );

  const segundos = Array.from({ length: EJE_S / 5 + 1 }, (_, i) => i * 5);
  const alturas = Array.from({ length: Math.floor(alto / 20) + 1 }, (_, i) => i * 20);

  return (
    <svg
      class="graficador"
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      role="img"
      aria-label="Graficador: altura de cada tanque, en centímetros, contra el tiempo, en segundos"
    >
      <rect
        class="graficador-papel"
        x={IZQ}
        y={ARRIBA}
        width={ANCHO - IZQ - DER}
        height={ALTO - ARRIBA - ABAJO}
      />
      {alturas.map((cm) => (
        <g key={`h${cm}`}>
          <line class="graficador-guia" x1={IZQ} x2={ANCHO - DER} y1={y(cm)} y2={y(cm)} />
          <text class="graficador-numero" x={IZQ - 5} y={y(cm) + 4} text-anchor="end">
            {cm}
          </text>
        </g>
      ))}
      {segundos.map((s) => (
        <g key={`s${s}`}>
          <line class="graficador-guia" x1={x(s)} x2={x(s)} y1={ARRIBA} y2={ALTO - ABAJO} />
          <text class="graficador-numero" x={x(s)} y={ALTO - ABAJO + 14} text-anchor="middle">
            {s} s
          </text>
        </g>
      ))}
      <text class="graficador-numero" x={4} y={ARRIBA + 2}>
        cm
      </text>

      {/* La campana: el segundo en que se revisan los niveles. */}
      <line
        class="graficador-campana"
        x1={x(campana)}
        x2={x(campana)}
        y1={ARRIBA}
        y2={ALTO - ABAJO}
      />
      <text class="graficador-rotulo" x={x(campana) + 4} y={ARRIBA + 11}>
        campana
      </text>
      {objetivo.tipo === 'linea' && (
        <>
          <line
            class="graficador-meta"
            x1={IZQ}
            x2={ANCHO - DER}
            y1={y(objetivo.nivel)}
            y2={y(objetivo.nivel)}
          />
          <text
            class="graficador-rotulo graficador-rotulo-meta"
            x={IZQ + 4}
            y={y(objetivo.nivel) - 4}
          >
            línea roja
          </text>
        </>
      )}

      {anterior && trazos(anterior, campana, 'trazos-anteriores')}
      {corrida && trazos(corrida.estado, corrida.hastaS, 'trazos-actuales')}

      {ayer?.map((m) => (
        <g key={`ayer${m.t}`} class="marca-ayer">
          <rect x={x(m.t) - 4} y={y(m.nivel) - 4} width={8} height={8} />
          <text class="graficador-rotulo" x={x(m.t) + 7} y={y(m.nivel) - 5}>
            ayer
          </text>
        </g>
      ))}
    </svg>
  );
}
