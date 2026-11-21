import { useEffect, useState } from 'preact/hooks';
import { cuadernoActivo } from '../../signals/cuaderno';
import {
  abrirCuaderno,
  abrirPanel,
  aviso,
  cerrarAviso,
  enfocado,
  panel,
  type AccionObjeto,
} from '../../signals/interfaz';
import { pistas } from '../../signals/mecanismo';
import {
  inventario,
  modo,
  reloj,
  restanteEn,
  SALAS_CON_SELLO,
  sellos,
  totalSellos,
} from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { frasePuertaFalsa } from '../../content/puertas-falsas';
import { duracionDeAviso, formatoReloj, relojEnPalabras, textoDeAviso } from './formato';
import '../botones.css';
import '../tema.css';
import './hud.css';

const VERBO: Record<AccionObjeto, string> = {
  usar: 'Usar',
  recoger: 'Recoger',
  examinar: 'Examinar',
};

/**
 * HUD de la partida (T33): reloj, sellos, inventario y botón contextual.
 * Todo lo que se toca mide al menos 48 px; el resto deja pasar los toques a la escena.
 */
export default function Hud() {
  return (
    <div class="hud-partida">
      {/* También recibe el foco al cerrar un panel si no hay un botón mejor (ver Dialogo). */}
      <h1 class="solo-lector" tabIndex={-1} data-foco-retorno="hud">
        Partida en curso
      </h1>
      <div class="hud-fila hud-arriba">
        <div class="hud-grupo">
          <BotonSalir />
          {/* El botón aparece al recoger el cuaderno de la portería. */}
          {cuadernoActivo.value && (
            <button
              type="button"
              class="hud-boton-redondo"
              data-foco-retorno="cuaderno"
              onClick={abrirCuaderno}
            >
              Cuaderno
            </button>
          )}
          <BotonPistas />
          <button
            type="button"
            class="hud-boton-redondo"
            data-foco-retorno="ajustes"
            onClick={() => abrirPanel('ajustes')}
          >
            Ajustes
          </button>
        </div>
        <Reloj />
        <Sellos />
      </div>
      <AvisoHud />
      <div class="hud-fila hud-abajo">
        <Inventario />
        <BotonAccion />
      </div>
    </div>
  );
}

/**
 * Botón de pistas (T38): aparece en una sala cuando su máquina ya ofreció alguna pista, y
 * avisa si hay una sin abrir. Abrirla es decisión del jugador.
 */
function BotonPistas() {
  const { ofrecidas, vistas } = pistas.value;
  if (ofrecidas === 0) return null;
  const nueva = vistas < ofrecidas;
  return (
    <button
      type="button"
      class={`hud-boton-redondo${nueva ? ' hud-boton-aviso' : ''}`}
      data-foco-retorno="pistas"
      onClick={() => abrirPanel('pistas')}
    >
      {nueva ? 'Pista nueva' : 'Pistas'}
    </button>
  );
}

/** Reloj de 40 minutos. Se redibuja una vez por segundo, no en cada cuadro. */
function Reloj() {
  const [, setTic] = useState(0);
  const r = reloj.value;
  useEffect(() => {
    if (r.pausado) return;
    const id = window.setInterval(() => setTic((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [r.pausado]);

  const restante = restanteEn(r, performance.now());
  const poco = restante <= 5 * 60 * 1000;
  return (
    <div
      class={`hud-reloj${poco ? ' hud-reloj-poco' : ''}`}
      role="timer"
      aria-label={`Tiempo restante: ${relojEnPalabras(restante)}${r.pausado ? ', en pausa' : ''}`}
    >
      <span aria-hidden="true">{formatoReloj(restante)}</span>
      {r.pausado && (
        <span class="hud-reloj-pausa" aria-hidden="true">
          en pausa
        </span>
      )}
    </div>
  );
}

/** Cinco sellos: lleno si la sala ya se resolvió. */
function Sellos() {
  const ganados = sellos.value;
  return (
    <div class="hud-sellos" role="img" aria-label={`Sellos: ${totalSellos.value} de 5`}>
      {SALAS_CON_SELLO.map((s, i) => (
        <span key={s} class={`hud-sello${ganados.includes(s) ? ' hud-sello-ganado' : ''}`}>
          {i + 1}
        </span>
      ))}
    </div>
  );
}

/**
 * Lo que el mundo le muestra al jugador sin abrir un panel (una puerta que sigue cerrada).
 * Se va solo. El lector de pantalla lo oye por el `Anunciador`.
 *
 * La frase de una puerta falsa del pasillo sale en una tirita de papel del archivo, con el
 * rótulo de la puerta en máquina de escribir; si la dice La Voz, ya está en el subtítulo y
 * aquí no se repite.
 */
function AvisoHud() {
  const actual = aviso.value;
  useEffect(() => {
    if (!actual) return;
    const id = window.setTimeout(cerrarAviso, duracionDeAviso(actual));
    return () => window.clearTimeout(id);
  }, [actual]);
  if (!actual) return null;
  if (actual.t === 'puerta_falsa') {
    if (actual.hablada) return null;
    const rotulo = frasePuertaFalsa(actual.frase)?.rotulo;
    return (
      <div class="hud-aviso hud-aviso-archivo" aria-hidden="true">
        {rotulo && <span class="hud-aviso-rotulo">{rotulo}</span>}
        <span class="hud-aviso-frase">{textoDeAviso(actual)}</span>
      </div>
    );
  }
  return <p class="hud-aviso">{textoDeAviso(actual)}</p>;
}

function Inventario() {
  // El cuaderno tiene su propio botón: no se repite en la lista.
  const objetos = inventario.value.filter((o) => !o.conBoton);
  return (
    <ul class="hud-inventario" aria-label="Inventario">
      {objetos.map((o) => (
        <li key={o.id} class="hud-objeto">
          {o.nombre}
        </li>
      ))}
    </ul>
  );
}

/** Botón contextual: aparece solo cuando hay un objeto enfocado y ningún panel abierto. */
function BotonAccion() {
  const objeto = enfocado.value;
  if (!objeto || panel.value !== null) return null;
  return (
    <button
      type="button"
      class="hud-accion"
      data-foco-retorno="accion"
      onClick={() => enviar({ t: 'accion', objeto: objeto.id, accion: objeto.accion })}
    >
      <span class="hud-accion-verbo">{VERBO[objeto.accion]}</span>
      <span class="hud-accion-objeto">{objeto.nombre}</span>
    </button>
  );
}

/**
 * Pausa (ola 6, T41d): abre la ficha de pausa, con los ajustes y la confirmación para salir.
 * En grupo el reloj no se detiene por uno solo (se vota en la barra del grupo), así que el
 * botón se llama «Salir» y abre directamente la confirmación.
 */
function BotonSalir() {
  return (
    <button
      type="button"
      class="hud-boton-redondo"
      data-foco-retorno="pausa"
      onClick={() => abrirPanel('pausa')}
    >
      {modo.value === 'individual' ? 'Pausa' : 'Salir'}
    </button>
  );
}
