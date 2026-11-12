import { useEffect, useState } from 'preact/hooks';
import { abrirCuaderno, enfocado, panel, type AccionObjeto } from '../../signals/interfaz';
import {
  inventario,
  reloj,
  restanteEn,
  SALAS_CON_SELLO,
  sellos,
  totalSellos,
} from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { formatoReloj, relojEnPalabras } from './formato';
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
      <div class="hud-fila hud-arriba">
        <div class="hud-grupo">
          <BotonSalir />
          <button type="button" class="hud-boton-redondo" onClick={abrirCuaderno}>
            Cuaderno
          </button>
        </div>
        <Reloj />
        <Sellos />
      </div>
      <div class="hud-fila hud-abajo">
        <Inventario />
        <BotonAccion />
      </div>
    </div>
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

function Inventario() {
  const objetos = inventario.value;
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
      onClick={() => enviar({ t: 'accion', objeto: objeto.id, accion: objeto.accion })}
    >
      <span class="hud-accion-verbo">{VERBO[objeto.accion]}</span>
      <span class="hud-accion-objeto">{objeto.nombre}</span>
    </button>
  );
}

function BotonSalir() {
  return (
    <button
      type="button"
      class="hud-boton-redondo"
      onClick={() => {
        if (window.confirm('¿Salir de la partida? Se pierde lo que llevas.')) {
          enviar({ t: 'salir' });
        }
      }}
    >
      Salir
    </button>
  );
}
