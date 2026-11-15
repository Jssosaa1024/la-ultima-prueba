import { ultimoEstable } from './ciclo';
import { NOMBRES_EJE } from './ejes';
import { corriendo, estres, ordenEstres } from './estado';
import type { FaseEstres } from './estado';
import { EJES } from './marca';
import type { EstadoEscalon } from '../informe';

const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

const TEXTO_FASE: Record<FaseEstres, string> = {
  inactiva: 'Elige un eje',
  preparando: 'subiendo la carga',
  calentando: 'calentando 1 s',
  midiendo: 'midiendo 5 s',
  terminada: 'terminada',
  calor: 'prueba de calor',
  liberando: 'liberando',
};

const TEXTO_ESTADO: Record<EstadoEscalon, string> = {
  estable: 'estable',
  lento: 'lento',
  'recarga-por-memoria': 'recarga por memoria',
  'contexto-perdido': 'contexto perdido',
};

const TEXTO_MOTIVO = {
  limite: 'Dos escalones seguidos pasaron de 33 ms.',
  'sin-escalones': 'Llegó al último escalón sin pasarse.',
  'contexto-perdido': 'El navegador quitó el contexto de WebGL.',
  detenida: 'Detenida a mano.',
  error: 'No se pudo subir la carga.',
  recarga: 'La pestaña se recargó durante la prueba (casi siempre, por memoria).',
} as const;

/**
 * Prueba de estrés en el panel `?debug=1` (T11o–T11r): un botón por eje, el escalón en curso,
 * los últimos resultados, la memoria al terminar y la prueba de calor.
 */
export default function VistaEstres() {
  const e = estres.value;
  const ocupada = corriendo(e);
  const estable = ultimoEstable(e.escalones);
  const pedir = (orden: typeof ordenEstres.value): void => {
    ordenEstres.value = orden;
  };

  return (
    <div class="depuracion-estres" data-fase={e.fase} data-motivo={e.motivo ?? undefined}>
      <p class="depuracion-estado">
        {e.eje ? `${NOMBRES_EJE[e.eje]} · ` : ''}
        {e.escalon > 0 && `escalón ${e.escalon}: ${e.carga} · `}
        {e.fase === 'calor' ? `calor, faltan ${e.calorRestanteS ?? 0} s` : TEXTO_FASE[e.fase]}
      </p>
      {e.motivo && <p class="depuracion-estado">{TEXTO_MOTIVO[e.motivo]}</p>}
      {e.fase === 'terminada' && e.eje && (
        <p class="depuracion-estado">
          Último estable: {estable === null ? 'ninguno' : `escalón ${estable}`}
        </p>
      )}
      {e.memoria && (
        <p class="depuracion-estado" data-memoria={e.memoria.liberada ? 'liberada' : 'retenida'}>
          Memoria: {e.memoria.antes.geometrias} → {e.memoria.despues.geometrias} geometrías,{' '}
          {e.memoria.antes.texturas} → {e.memoria.despues.texturas} texturas ·{' '}
          {e.memoria.liberada ? 'liberada' : 'falta liberar'}
        </p>
      )}
      {e.calor && (
        <p class="depuracion-estado">
          Calor ({e.calor.carga}): p95 {decimal.format(e.calor.p95_primer_minuto_ms)} ms →{' '}
          {decimal.format(e.calor.p95_ultimo_minuto_ms)} ms
        </p>
      )}
      <ol class="depuracion-escalones">
        {e.escalones.slice(-3).map((x) => (
          <li key={x.escalon}>
            {x.escalon}. {x.carga}
            {x.p95_ms !== undefined && ` · p95 ${decimal.format(x.p95_ms)} ms`} ·{' '}
            {TEXTO_ESTADO[x.estado]}
          </li>
        ))}
      </ol>
      {!ocupada && <p class="depuracion-estado">No camines ni abras paneles mientras corre.</p>}
      <div class="depuracion-botones">
        {ocupada ? (
          <button type="button" class="depuracion-boton" onClick={() => pedir({ t: 'detener' })}>
            Detener prueba
          </button>
        ) : (
          <>
            {EJES.map((eje) => (
              <button
                key={eje}
                type="button"
                class="depuracion-boton"
                onClick={() => pedir({ t: 'iniciar', eje })}
              >
                {NOMBRES_EJE[eje]}
              </button>
            ))}
            {e.fase === 'terminada' && e.motivo !== 'recarga' && estable !== null && (
              <button type="button" class="depuracion-boton" onClick={() => pedir({ t: 'calor' })}>
                Calor 3 min
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
