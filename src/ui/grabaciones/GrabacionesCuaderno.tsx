import { grabacionPorId } from '../../content/grabaciones';
import { grabaciones } from '../../signals/partida';
import { tituloGrabacion } from './textos';
import './grabaciones.css';

/**
 * Sección del cuaderno con las grabaciones recogidas (T75), en el orden en que se
 * encontraron. No aparece hasta tener la primera.
 */
export default function GrabacionesCuaderno() {
  const recogidas = grabaciones.value.flatMap((id) => grabacionPorId(id) ?? []);
  if (recogidas.length === 0) return null;
  return (
    <section class="cuaderno-seccion" aria-labelledby="cuaderno-grabaciones">
      <h3 id="cuaderno-grabaciones" class="cuaderno-subtitulo">
        Grabaciones
      </h3>
      {recogidas.map((g) => (
        <article key={g.id} class="grabacion-nota">
          <h4 class="grabacion-titulo">{tituloGrabacion(g.numero)}</h4>
          <p class="grabacion-lugar">{g.lugar}.</p>
          <blockquote class="grabacion-texto">{g.texto}</blockquote>
        </article>
      ))}
    </section>
  );
}
