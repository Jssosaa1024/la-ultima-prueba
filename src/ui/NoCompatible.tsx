import './NoCompatible.css';

/**
 * Pantalla para equipos sin WebGL2: explica qué pasa y qué puede intentar el estudiante.
 * No usa WebGL ni canvas, así que funciona en cualquier navegador.
 */
export default function NoCompatible() {
  return (
    <main class="no-compatible" aria-labelledby="no-compatible-titulo">
      <div class="no-compatible-caja">
        <h1 id="no-compatible-titulo">Este equipo no puede abrir el juego</h1>
        <p>
          La Última Prueba dibuja el colegio en 3D con WebGL2, y este navegador no lo tiene activo.
        </p>
        <p>Puedes intentar esto:</p>
        <ul>
          <li>Actualiza Chrome, Edge, Firefox o Safari a la última versión.</li>
          <li>
            En computador, revisa que la «aceleración por hardware» esté activada en la
            configuración del navegador.
          </li>
          <li>Prueba con otro navegador o con otro celular o computador.</li>
        </ul>
        <a class="no-compatible-boton" href="/">
          Volver al inicio
        </a>
      </div>
    </main>
  );
}
