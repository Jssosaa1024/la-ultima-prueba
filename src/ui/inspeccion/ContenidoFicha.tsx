import type { BloqueFicha, Ficha } from '../../signals/contenido';
import './inspeccion.css';

/** Contenido de una ficha en papel claro. Lo usan la inspección y el cuaderno. */
export default function ContenidoFicha({ ficha }: { ficha: Ficha }) {
  return (
    <div class="ficha">
      {ficha.bloques.map((b, i) => (
        <Bloque key={i} bloque={b} />
      ))}
    </div>
  );
}

function Bloque({ bloque }: { bloque: BloqueFicha }) {
  switch (bloque.tipo) {
    case 'texto':
      return <p>{bloque.texto}</p>;
    case 'nota':
      return <p class="ficha-nota">{bloque.texto}</p>;
    case 'lista':
      return (
        <ul class="ficha-lista">
          {bloque.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'tabla':
      return (
        <div class="ficha-tabla-caja">
          <table class="ficha-tabla">
            <caption>{bloque.titulo}</caption>
            <thead>
              <tr>
                {bloque.columnas.map((c, i) => (
                  <th key={i} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloque.filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => (
                    <td key={j}>{celda}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
