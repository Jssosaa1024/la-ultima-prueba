import { useEffect, useRef, useState } from 'preact/hooks';
import {
  duracionDe,
  escenaPorId,
  planoEn,
  subtituloEn,
  TARJETAS_COMPLETAS,
  type SubtituloEscena,
} from '../../content/escenas';
import { lineaPorId } from '../../content/guion';
import { audioDesbloqueado } from '../../signals/audio';
import { escena as escenaEnCurso, terminarEscena } from '../../signals/escena';
import { mostrarLinea, ocultarLinea, sonidoVoz, COLA_SUBTITULO_MS } from '../../signals/voz';
import Tarjeta from './Tarjetas';
import '../botones.css';
import '../subtitulos/subtitulos.css';
import './escenas.css';

/** Cada cuánto se mira el reloj de la escena: basta para cambiar de plano y mover la barra. */
const MS_POR_PASO = 100;
/** Con el fundido, en qué punto del último plano empieza a oscurecer. */
const INICIO_FUNDIDO = 0.6;

const ahora = (): number => performance.now();

/**
 * Capa de una escena de la historia (Historia A): encima de la portería, que el motor mueve con
 * su cámara guiada, muestra las tarjetas de 1991, el texto, los subtítulos y el botón «Saltar»
 * (o Escape). La Voz suena con `mostrarLinea`, como los subtítulos del juego. Al terminar el
 * último plano, o al saltarla, la escena se cierra (`terminarEscena`).
 */
export default function CapaEscena() {
  const actual = escenaEnCurso.value;
  const [ms, setMs] = useState(ahora);
  const saltar = useRef<HTMLButtonElement>(null);

  // El botón «Saltar» recibe el foco: con teclado o lector de pantalla se salta con Enter.
  useEffect(() => saltar.current?.focus(), [actual?.id]);

  useEffect(() => {
    if (!actual) return;
    const intervalo = window.setInterval(() => setMs(ahora()), MS_POR_PASO);
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') terminarEscena('saltada');
    };
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [actual?.id, actual?.desde]);

  const datos = actual ? escenaPorId(actual.id) : null;
  const t = actual ? Math.max(0, (ms - actual.desde) / 1000) : 0;
  const total = datos ? duracionDe(datos) : 0;
  const en = datos ? planoEn(datos, t) : null;
  const sub = datos ? subtituloEn(datos, t, lineaPorId) : null;

  // Terminó el último plano: se cierra sola.
  useEffect(() => {
    if (actual && t >= total) terminarEscena('fin');
  }, [actual, t, total]);

  // La Voz dice la línea de su plano; sigue sonando aunque cambie el plano.
  const idVoz = sub?.quien === 'voz' ? (sub.id ?? null) : null;
  useEffect(() => {
    if (!idVoz) return;
    mostrarLinea(idVoz);
    return () => ocultarLinea(idVoz);
  }, [idVoz]);

  if (!actual || !datos) return null;
  const plano = en?.plano ?? datos.planos[datos.planos.length - 1];
  const avance = en?.avance ?? 1;
  const tarjeta = plano?.tarjeta;
  const completa = tarjeta !== undefined && TARJETAS_COMPLETAS.includes(tarjeta);
  const fundido = plano?.fundido === true && avance >= INICIO_FUNDIDO;
  const visible = sub && subtituloVisible(sub, t, ms) ? sub : null;

  return (
    <section
      class={`escena${completa ? ' escena-completa' : ''}`}
      aria-label={datos.nombre}
      data-escena={actual.id}
      data-plano={en?.indice ?? datos.planos.length - 1}
    >
      {tarjeta && (
        <div class="escena-tarjeta" key={`${en?.indice}-${tarjeta}`} data-tarjeta={tarjeta}>
          <Tarjeta id={tarjeta} avance={avance} />
        </div>
      )}
      <div class={`escena-fundido${fundido ? ' escena-fundido-activo' : ''}`} aria-hidden="true" />
      <div class="escena-abajo">
        {plano?.texto && (
          <p class="escena-texto" key={plano.texto}>
            {plano.texto}
          </p>
        )}
        <div class="escena-subtitulos" aria-live="polite" aria-atomic="true">
          {visible && (
            <p class="subtitulo" key={`${visible.desde}`}>
              <span class="subtitulo-quien">
                {visible.quien === 'voz' ? 'La Voz:' : 'Don Efraín:'}
              </span>{' '}
              {visible.texto}
            </p>
          )}
        </div>
      </div>
      <button
        ref={saltar}
        type="button"
        class="boton boton-secundario escena-saltar"
        onClick={() => terminarEscena('saltada')}
      >
        Saltar
      </button>
    </section>
  );
}

/**
 * El subtítulo se ve mientras suena su audio (más una cola corta). Sin audio (o para Don
 * Efraín, que no tiene voz grabada), el tiempo estimado de lectura.
 */
function subtituloVisible(sub: SubtituloEscena, t: number, ms: number): boolean {
  const leido = t - sub.desde < sub.estimada;
  if (sub.quien !== 'voz' || !audioDesbloqueado.value) return leido;
  const sonido = sonidoVoz.value;
  if (!sonido || sonido.id !== sub.id) return leido;
  if (sonido.estado === 'cargando') return true;
  if (sonido.estado === 'sonando') return ms < sonido.terminaEn + COLA_SUBTITULO_MS;
  return leido;
}
