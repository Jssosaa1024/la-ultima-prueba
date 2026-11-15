import { useEffect, useId, useState } from 'preact/hooks';
import { fichas } from '../../signals/contenido';
import { datosEncontrados, MAX_NOTA, MAX_NOTAS, notas } from '../../signals/cuaderno';
import { PUZZLES } from '../../content/puzzles';
import { cerrarPanel } from '../../signals/interfaz';
import { pistasVistas } from '../../signals/mecanismo';
import { avance, modo, SALAS_CON_SELLO } from '../../signals/partida';
import { enviar } from '../../signals/puente';
import Encargos from '../coop/Encargos';
import GrabacionesCuaderno from '../grabaciones/GrabacionesCuaderno';
import ContenidoFicha from '../inspeccion/ContenidoFicha';
import Dialogo from '../paneles/Dialogo';
import { descubrimientos } from './descubrimientos';
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
    <Dialogo antetitulo="Cuaderno" titulo="Tu cuaderno" retorno="cuaderno" alCerrar={cerrarPanel}>
      {individual && (
        <p class="cuaderno-pausa" role="status">
          El reloj está en pausa mientras tienes el cuaderno abierto.
        </p>
      )}
      {/* En grupo (T86): la pista del encargo de este jugador en la sala actual. */}
      {!individual && <Encargos />}
      <Descubrimientos />
      <DatosEncontrados />
      <PistasAbiertas grupo={!individual} />
      <GrabacionesCuaderno />
      <Notas grupo={!individual} />
    </Dialogo>
  );
}

/**
 * Lo que el cuaderno escribe solo (T38): por cada máquina, lo que pasó en las etapas ya
 * resueltas y, con el sello, cómo se llama lo que se descubrió. La sección aparece con la
 * primera etapa resuelta.
 */
function Descubrimientos() {
  const lista = descubrimientos(avance.value, PUZZLES);
  if (lista.length === 0) return null;
  return (
    <section class="cuaderno-seccion" aria-labelledby="cuaderno-descubrimientos">
      <h3 id="cuaderno-descubrimientos" class="cuaderno-subtitulo">
        Lo que descubriste
      </h3>
      {lista.map((d) => (
        <article key={d.id} class="cuaderno-descubrimiento">
          <h4 class="cuaderno-maquina">
            Sala {d.sala} · {d.titulo}
          </h4>
          <ol class="cuaderno-etapas">
            {d.etapas.map((texto, i) => (
              <li key={i}>{texto}</li>
            ))}
          </ol>
          {d.concepto && (
            <>
              <p class="cuaderno-concepto">
                Lo que acabas de descubrir se llama: {d.concepto.nombre}
              </p>
              <p class="cuaderno-concepto-texto">{d.concepto.texto}</p>
            </>
          )}
        </article>
      ))}
    </section>
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

/**
 * Las pistas abiertas de cada máquina (T86). En grupo son las de todos: la que abre uno la
 * leen los demás aquí.
 */
function PistasAbiertas({ grupo }: { grupo: boolean }) {
  const vistas = pistasVistas.value;
  const salas = SALAS_CON_SELLO.flatMap((s, i) => {
    const n = vistas[s] ?? 0;
    const puzzle = PUZZLES.find((p) => p.sala === i + 1);
    return n > 0 && puzzle ? [{ s, puzzle, n }] : [];
  });
  if (salas.length === 0) return null;
  return (
    <section class="cuaderno-seccion" aria-labelledby="cuaderno-pistas">
      <h3 id="cuaderno-pistas" class="cuaderno-subtitulo">
        {grupo ? 'Pistas que abrió el grupo' : 'Pistas abiertas'}
      </h3>
      {salas.map(({ s, puzzle, n }) => (
        <article key={s}>
          <h4 class="cuaderno-maquina">
            Sala {puzzle.sala} · {puzzle.titulo}
          </h4>
          <ol class="cuaderno-etapas">
            {puzzle.pistas.slice(0, n).map((p) => (
              <li key={p.nivel}>{p.texto}</li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}

function Notas({ grupo }: { grupo: boolean }) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const lista = notas.value;
  const vacio = texto.trim() === '';
  // El guardado acepta hasta MAX_NOTAS notas: con el cuaderno lleno hay que borrar una.
  const lleno = lista.length >= MAX_NOTAS;

  const guardar = (e: Event): void => {
    e.preventDefault();
    if (vacio || lleno) return;
    enviar({ t: 'nota', op: 'agregar', texto });
    setTexto('');
  };

  return (
    <section class="cuaderno-seccion" aria-labelledby="cuaderno-notas">
      <h3 id="cuaderno-notas" class="cuaderno-subtitulo">
        Notas y cálculos
      </h3>
      {/* T86: las notas no viajan por la red (sin chat libre entre menores). */}
      {grupo && <p class="cuaderno-vacio">Tus notas solo las ves tú: no se envían al grupo.</p>}
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
          <button type="submit" class="boton boton-secundario" disabled={vacio || lleno}>
            Guardar nota
          </button>
        </div>
        {lleno && (
          <p class="cuaderno-vacio" role="status">
            El cuaderno está lleno ({MAX_NOTAS} notas). Borra una para escribir otra.
          </p>
        )}
      </form>
    </section>
  );
}
