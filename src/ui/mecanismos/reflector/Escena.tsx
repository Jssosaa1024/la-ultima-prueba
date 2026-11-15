import type { LecturaPoste } from '../../../game/puzzles';

/**
 * Vista de lado del gimnasio (T58): cada poste con su sombra en el piso, todo a la misma
 * escala, para que se vea que con la misma luz los triángulos tienen la misma forma.
 *
 * Es un dibujo de apoyo: lo mismo se lee en las frases del panel, así que el lector de
 * pantalla lo salta (`aria-hidden`).
 */

export interface FilaPoste {
  lectura: LecturaPoste;
  /** El poste se desliza por su riel: el sensor queda fijo al final y el poste se aleja. */
  movil: boolean;
}

interface Props {
  filas: readonly FilaPoste[];
  /** Hasta qué metro de la cinta llega la sombra del marcador; null si la etapa no lo tiene. */
  marcador: number | null;
  /** Metros que caben a lo ancho (el largo del riel o de la cinta). */
  largo: number;
}

const ANCHO = 340;
const MARGEN = 14;
/** Espacio bajo cada piso para los números de la regla. */
const PIE = 20;
/** Aire sobre lo más alto de cada fila. */
const CIELO = 8;
/** Lo que se dibuja de la pared del marcador, en metros: el resto va «cortado». */
const PARED_VISIBLE = 3.2;

export default function Escena({ filas, marcador, largo }: Props) {
  const escala = (ANCHO - 2 * MARGEN) / largo;
  const x = (m: number): number => MARGEN + m * escala;
  let y = 0;
  const bloques = filas.map((fila) => {
    const alto = fila.lectura.altura * escala + CIELO;
    const piso = y + alto;
    y = piso + PIE;
    return { fila, piso };
  });
  const pisoCinta = marcador === null ? null : y + PARED_VISIBLE * escala + CIELO;
  const total = pisoCinta === null ? y : pisoCinta + PIE;
  // Con reglas largas, un número cada dos metros para que no se monten.
  const cada = largo > 12 ? 2 : 1;
  const marcas = Array.from({ length: Math.floor(largo) + 1 }, (_, i) => i);

  const regla = (piso: number, clave: string) => (
    <g key={clave} class="reflector-regla">
      <line x1={x(0)} y1={piso} x2={x(largo)} y2={piso} />
      {marcas.map((m) => (
        <g key={m}>
          <line x1={x(m)} y1={piso} x2={x(m)} y2={piso + 4} />
          {m % cada === 0 && (
            <text x={x(m)} y={piso + 15} text-anchor="middle">
              {m}
            </text>
          )}
        </g>
      ))}
    </g>
  );

  return (
    <svg
      class="reflector-escena"
      viewBox={`0 0 ${ANCHO} ${total}`}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {bloques.map(({ fila, piso }) => {
        const { lectura: l, movil } = fila;
        // Poste fijo: en el metro 0, con su sensor a `distancia`. Poste móvil: el sensor está
        // al final del riel y el poste se aleja de él.
        const base = movil && l.distancia !== null ? largo - l.distancia : 0;
        const sensor = l.distancia === null ? null : base + l.distancia;
        const punta = Math.min(base + l.sombra, largo);
        const cima = piso - l.altura * escala;
        // Si la sombra se sale de la regla, el rayo se corta en el borde sin cambiar de inclinación.
        const visto = l.sombra > 0 ? (punta - base) / l.sombra : 1;
        const finRayo = cima + (piso - cima) * visto;
        return (
          <g key={l.id}>
            {regla(piso, `regla-${l.id}`)}
            {/* El rayo que pasa por la punta del poste y cae en la punta de la sombra. */}
            <line class="reflector-rayo" x1={x(base)} y1={cima} x2={x(punta)} y2={finRayo} />
            <line class="reflector-sombra" x1={x(base)} y1={piso} x2={x(punta)} y2={piso} />
            <line class="reflector-poste" x1={x(base)} y1={piso} x2={x(base)} y2={cima} />
            {sensor !== null && (
              <circle
                class={`reflector-sensor${l.alcance === 'toca' ? ' reflector-sensor-suena' : ''}`}
                cx={x(sensor)}
                cy={piso}
                r={6}
              />
            )}
          </g>
        );
      })}
      {marcador !== null && pisoCinta !== null && (
        <g>
          {regla(pisoCinta, 'regla-cinta')}
          {/* La pared sigue hacia arriba: el marcador cuelga mucho más alto que el dibujo. */}
          <line
            class="reflector-pared"
            x1={x(0)}
            y1={pisoCinta}
            x2={x(0)}
            y2={pisoCinta - PARED_VISIBLE * escala}
          />
          <text class="reflector-rotulo" x={x(0) + 8} y={pisoCinta - PARED_VISIBLE * escala + 10}>
            ↑ marcador
          </text>
          <line
            class="reflector-sombra"
            x1={x(0)}
            y1={pisoCinta}
            x2={x(Math.min(marcador, largo))}
            y2={pisoCinta}
          />
        </g>
      )}
    </svg>
  );
}
