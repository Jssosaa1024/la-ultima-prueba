import type { PruebaExpediente as Prueba } from '../../content/expediente';
import ContenidoFicha from '../inspeccion/ContenidoFicha';
import FotoFeria from '../tema/FotoFeria';
import Sello from '../tema/Sello';
import { type PuntoBitacora, seriesBitacora } from './bitacora';

/**
 * Una ficha de evidencia del expediente de 1991 en el cuaderno (Historia · sesión C). Cada
 * prueba se ve como su documento: el recibo de la cooperativa, la bitácora en papel
 * cuadriculado (con sus dos rectas), la foto de la feria, las fichas de préstamo y el acta. El
 * texto es el mismo de `src/content/expediente.json`; aquí solo cambia el papel.
 */
export default function PruebaExpediente({ prueba: p }: { prueba: Prueba }) {
  return (
    <details class={`cuaderno-dato cuaderno-prueba cuaderno-prueba-${p.id}`}>
      <summary>
        Prueba {p.numero} · {p.titulo}
      </summary>
      <p class="cuaderno-acusacion">
        {/* El sello resume lo que ya dice la prueba abajo: es adorno. */}
        <Sello texto="No se sostiene" recto decorativo clase="cuaderno-acusacion-sello" />
        Lo que dijo el jurado: {p.acusacion}
      </p>
      <div class="cuaderno-documento">
        {p.id === 's3-gimnasio' && (
          <FotoFeria
            pequena
            pie="Gimnasio, feria de ciencias de 1991."
            descripcion="Foto en blanco y negro del gimnasio el día de la feria: el puesto armado, el filtro que gotea, el poste de la canasta y su sombra larga en el piso."
            clase="cuaderno-foto"
          />
        )}
        {p.id === 's2-laboratorio' && <GraficaBitacora prueba={p} />}
        <ContenidoFicha ficha={{ titulo: p.titulo, bloques: p.bloques }} />
      </div>
      <p class="cuaderno-lo-que-prueba">{p.prueba}</p>
    </details>
  );
}

/** Ancho y alto del dibujo, en unidades del viewBox. */
const ANCHO = 240;
const ALTO = 130;
const MARGEN = 14;

/**
 * Las dos rectas de la bitácora en papel cuadriculado: la de E. C. continua y la del otro
 * colegio punteada (no solo el color las distingue), con el único punto donde se cruzan. Los
 * datos ya están en la tabla de la ficha: el dibujo es adorno y el pie dice lo que muestra.
 */
function GraficaBitacora({ prueba }: { prueba: Prueba }) {
  const series = seriesBitacora(prueba);
  if (!series) return null;
  const todos = [...series.propio, ...series.otro];
  const maxX = Math.max(...todos.map((q) => q.minuto)) || 1;
  const maxY = Math.max(...todos.map((q) => q.litros)) || 1;
  const x = (q: PuntoBitacora): number => MARGEN + (q.minuto / maxX) * (ANCHO - 2 * MARGEN);
  const y = (q: PuntoBitacora): number => ALTO - MARGEN - (q.litros / maxY) * (ALTO - 2 * MARGEN);
  const linea = (qs: PuntoBitacora[]): string => qs.map((q) => `${x(q)},${y(q)}`).join(' ');
  return (
    <figure class="cuaderno-grafica">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true" class="cuaderno-grafica-dibujo">
        <line
          x1={MARGEN}
          y1={ALTO - MARGEN}
          x2={ANCHO - MARGEN}
          y2={ALTO - MARGEN}
          class="cuaderno-grafica-eje"
        />
        <line x1={MARGEN} y1={MARGEN} x2={MARGEN} y2={ALTO - MARGEN} class="cuaderno-grafica-eje" />
        <polyline points={linea(series.otro)} class="cuaderno-grafica-otro" />
        <polyline points={linea(series.propio)} class="cuaderno-grafica-propio" />
        {series.cruces.map((q) => (
          <circle key={q.minuto} cx={x(q)} cy={y(q)} r={7} class="cuaderno-grafica-cruce" />
        ))}
      </svg>
      <figcaption class="cuaderno-grafica-pie">
        <span class="cuaderno-grafica-clave cuaderno-grafica-clave-propio">Filtro de E. C.</span>
        <span class="cuaderno-grafica-clave cuaderno-grafica-clave-otro">Otro colegio</span>
        {series.cruces.length === 1 && (
          <span class="cuaderno-grafica-frase">
            Se cruzan una sola vez, en el minuto {series.cruces[0]?.minuto}.
          </span>
        )}
      </figcaption>
    </figure>
  );
}
