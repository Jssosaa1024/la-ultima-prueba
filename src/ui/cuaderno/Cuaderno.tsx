import { useEffect, useId, useState } from 'preact/hooks';
import { fichas } from '../../signals/contenido';
import { datosEncontrados, MAX_NOTA, notas } from '../../signals/cuaderno';
import { cerrarPanel } from '../../signals/interfaz';
import { modo } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import ContenidoFicha from '../inspeccion/ContenidoFicha';
import Dialogo from '../paneles/Dialogo';
import './cuaderno.css';

/**
 * Cuaderno (T36): datos encontrados, notas propias y, en modo individual, el reloj en pausa
 * mientras está abierto (diseño: «Consultarlo pausa el reloj»).
 */
export default function Cuaderno() {
  const individual = modo.value === 'individual';

  useEffect(() => {
    if (!individual) return;
    enviar({ t: 'pausar' });
    return () => enviar({ t: 'reanudar' });
  }, [individual]);

  return (
    <Dialogo antetitulo="Cuaderno" titulo="Tu cuaderno" alCerrar={cerrarPanel}>
      {individual && (
        <p class="cuaderno-pausa" role="status">
          El reloj está en pausa mientras tienes el cuaderno abierto.
        </p>
      )}
      <DatosEncontrados />
      <Notas />
    </Dialogo>
  );
}

function DatosEncontrados() {
  const todas = fichas.value;
  const encontrados = datosEncontrados.value.filter((id) => todas[id]);
  return (
    <section class="cuaderno-seccion" aria-labelledby="cuaderno-datos">
      <h3 id="cuaderno-datos" class="cuaderno-subtitulo">
        Datos encontrados
      </h3>
      {encontrados.length === 0 ? (
        <p class="cuaderno-vacio">
          Todavía no hay datos. Examina los objetos de la sala y aparecerán aquí.
        </p>
      ) : (
        <div class="cuaderno-datos">
          {encontrados.map((id) => {
            const ficha = todas[id];
            if (!ficha) return null;
            return (
              <details key={id} class="cuaderno-dato">
                <summary>{ficha.titulo}</summary>
                <ContenidoFicha ficha={ficha} />
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Notas() {
  const id = useId();
  const [texto, setTexto] = useState('');
  const lista = notas.value;
  const vacio = texto.trim() === '';

  const guardar = (e: Event): void => {
    e.preventDefault();
    if (vacio) return;
    enviar({ t: 'nota', op: 'agregar', texto });
    setTexto('');
  };

  return (
    <section class="cuaderno-seccion" aria-labelledby="cuaderno-notas">
      <h3 id="cuaderno-notas" class="cuaderno-subtitulo">
        Notas y cálculos
      </h3>
      {lista.length > 0 && (
        <ul class="cuaderno-notas">
          {lista.map((n) => (
            <li key={n.id} class="cuaderno-nota">
              <p class="cuaderno-nota-texto">{n.texto}</p>
              <button
                type="button"
                class="boton boton-secundario cuaderno-borrar"
                aria-label={`Borrar nota: ${n.texto}`}
                onClick={() => enviar({ t: 'nota', op: 'borrar', id: n.id })}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form class="cuaderno-form" onSubmit={guardar}>
        <label for={`${id}-nota`} class="cuaderno-etiqueta">
          Nueva nota
        </label>
        <textarea
          id={`${id}-nota`}
          class="cuaderno-texto"
          rows={3}
          maxLength={MAX_NOTA}
          value={texto}
          placeholder="Ej.: 4 × $5.000 = $20.000"
          aria-describedby={`${id}-cuenta`}
          onInput={(e) => setTexto(e.currentTarget.value)}
        />
        <div class="cuaderno-form-pie">
          <span id={`${id}-cuenta`} class="cuaderno-cuenta">
            {[...texto].length} de {MAX_NOTA} caracteres
          </span>
          <button type="submit" class="boton boton-secundario" disabled={vacio}>
            Guardar nota
          </button>
        </div>
      </form>
    </section>
  );
}
