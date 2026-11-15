import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { armarInforme, contextoDelEquipo, exportarInforme } from './informe';
import { LIMITES_PANEL, colorContra, depuracionAbierta, metricas } from './metricas';
import type { Color } from './metricas';
import './panel-debug.css';

const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

const NOMBRE_COLOR: Record<Color, string> = {
  verde: 'dentro del presupuesto',
  ambar: 'cerca del límite',
  rojo: 'sobre el límite',
};

function Fila(props: { nombre: string; color?: Color | undefined; children: ComponentChildren }) {
  return (
    <div class="depuracion-fila" data-color={props.color}>
      <dt>{props.nombre}</dt>
      <dd>
        {props.color && <span class="depuracion-punto" aria-hidden="true" />}
        {props.children}
        {props.color && <span class="depuracion-oculto"> ({NOMBRE_COLOR[props.color]})</span>}
      </dd>
    </div>
  );
}

/**
 * Panel `?debug=1` (T11n): las métricas del motor contra el presupuesto de AGENTS.md, en
 * verde, ámbar (más del 85 % del límite) o rojo, y el botón «Exportar JSON».
 *
 * Va sobre el canvas y solo captura toques en sus botones: el resto deja pasar el dedo al
 * juego. Se redibuja cuando cambia el signal `metricas` (cada 500 ms como máximo).
 */
export default function PanelDebug() {
  const m = metricas.value;
  const [aviso, setAviso] = useState('');
  const l = LIMITES_PANEL;

  const exportar = async (): Promise<void> => {
    const informe = armarInforme(metricas.peek(), contextoDelEquipo(), new Date());
    const salio = await exportarInforme(informe);
    setAviso(salio === 'cancelado' ? 'No se exportó.' : 'JSON exportado.');
  };

  return (
    <section class="depuracion" aria-label="Métricas de rendimiento" data-lista={m.lista}>
      <dl class="depuracion-lista">
        <Fila nombre="Sala">{m.sala ?? '—'}</Fila>
        <Fila
          nombre="Cuadro p95"
          color={m.lista ? colorContra(m.cuadro.p95Ms, l.p95Ms) : undefined}
        >
          {decimal.format(m.cuadro.p95Ms)} ms · mediana {decimal.format(m.cuadro.medianaMs)} · 1 %{' '}
          {decimal.format(m.cuadro.p1Ms)}
        </Fila>
        <Fila nombre="Triángulos" color={colorContra(m.triangulos, l.triangulos)}>
          {entero.format(m.triangulos)} / {entero.format(l.triangulos)}
        </Fila>
        <Fila nombre="Draw calls" color={colorContra(m.drawCalls, l.drawCalls)}>
          {entero.format(m.drawCalls)} / {l.drawCalls}
        </Fila>
        <Fila nombre="Texturas" color={colorContra(m.mbTexturas, l.mbTexturas)}>
          {decimal.format(m.mbTexturas)} MB / {l.mbTexturas}
        </Fila>
        <Fila nombre="En GPU">
          {m.geometrias} geometrías · {m.texturas} texturas
        </Fila>
        <Fila nombre="Descarga" color={colorContra(m.mbDescargados, l.mbDescargados)}>
          {decimal.format(m.mbDescargados)} MB / {decimal.format(l.mbDescargados)}
          {m.archivosDeCache > 0 && ` · ${m.archivosDeCache} de caché`}
        </Fila>
        <Fila
          nombre="Carga"
          color={m.cargaMs === null ? undefined : colorContra(m.cargaMs, l.cargaMs)}
        >
          {m.cargaMs === null ? '—' : `${entero.format(m.cargaMs)} ms`}
        </Fila>
        <Fila nombre="Pixel ratio">
          {decimal.format(m.devicePixelRatio)} → {decimal.format(m.pixelRatioUsado)} · perfil{' '}
          {m.perfil ?? '—'}
        </Fila>
      </dl>
      <div class="depuracion-botones">
        <button type="button" class="depuracion-boton" onClick={() => void exportar()}>
          Exportar JSON
        </button>
        <button
          type="button"
          class="depuracion-boton"
          onClick={() => {
            depuracionAbierta.value = false;
          }}
        >
          Cerrar métricas
        </button>
      </div>
      <p class="depuracion-aviso" role="status">
        {aviso}
      </p>
    </section>
  );
}
