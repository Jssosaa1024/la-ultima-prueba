import { fichas, type BloqueFicha } from '../../signals/contenido';
import { cerrarPanel, inspeccionando } from '../../signals/interfaz';
import Dialogo from '../paneles/Dialogo';
import './inspeccion.css';

/**
 * Vista de inspección 2D (T35): muestra en texto nítido los datos de un objeto (facturas,
 * fichas, gráficas), en lugar de ponerlos como textura en la escena. Así se leen bien en
 * pantallas pequeñas y con lector de pantalla.
 */
export default function Inspeccion() {
  const id = inspeccionando.value;
  if (!id) return null;
  const ficha = fichas.value[id];

  return (
    <Dialogo antetitulo="Inspección" titulo={ficha?.titulo ?? 'Objeto'} alCerrar={cerrarPanel}>
      {ficha?.descripcion && <p class="ficha-descripcion">{ficha.descripcion}</p>}
      {ficha ? (
        <div class="ficha">
          {ficha.bloques.map((b, i) => (
            <Bloque key={i} bloque={b} />
          ))}
        </div>
      ) : (
        <p>No hay nada escrito en este objeto.</p>
      )}
    </Dialogo>
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
