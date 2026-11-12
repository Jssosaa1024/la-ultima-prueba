import { fichas } from '../../signals/contenido';
import { cerrarPanel, inspeccionando } from '../../signals/interfaz';
import Dialogo from '../paneles/Dialogo';
import ContenidoFicha from './ContenidoFicha';

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
      {ficha ? <ContenidoFicha ficha={ficha} /> : <p>No hay nada escrito en este objeto.</p>}
    </Dialogo>
  );
}
