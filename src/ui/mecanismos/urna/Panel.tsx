import { useEffect, useState } from 'preact/hooks';
import { Pasos, Respuesta } from '../marco/Controles';
import type { PropsPanel } from '../marco/tipos';
import { listaDeParejas, simular, type Pareja, type ResultadoSimulacion } from './simulador';
import { textoRespuesta, textoSimulacion, textoUrna } from './textos';
import './urna.css';

/**
 * Sala 5 · La urna (T70). El jugador pone fichas azules y amarillas con los dispensadores;
 * La Voz saca dos sin devolver y, si son del mismo color, gana el jugador. Cada etapa pide
 * una urna distinta en la placa de la caja fuerte.
 *
 * Dos herramientas para mirar lo que pasa, que no cuentan como intento: el simulador de 100
 * extracciones y «ver parejas». La manija de la caja fuerte (el botón de accionar, que pone
 * el marco) es lo único que confirma la etapa.
 *
 * Las azules son redondas y las amarillas cuadradas: no se distinguen solo por el color.
 */
export default function PanelUrna({
  etapa,
  estado,
  resultado,
  bloqueado,
  ajustar,
}: PropsPanel<'urna'>) {
  const { azules, amarillas } = estado;
  const max = etapa.controles.max_por_color;
  const [simulacion, setSimulacion] = useState<ResultadoSimulacion | null | undefined>(undefined);
  const [verParejas, setVerParejas] = useState(false);

  // Lo que dijo el simulador vale solo para la urna con la que se hizo.
  useEffect(() => setSimulacion(undefined), [azules, amarillas]);

  return (
    <div class={`urna-panel${verParejas ? ' urna-con-parejas' : ''}`}>
      <div class="urna" role="img" aria-label={textoUrna(estado)}>
        {azules + amarillas === 0 ? (
          <span class="urna-vacia">Urna vacía</span>
        ) : (
          <>
            {Array.from({ length: azules }, (_, i) => (
              <Ficha key={`a${i}`} color="a" />
            ))}
            {Array.from({ length: amarillas }, (_, i) => (
              <Ficha key={`m${i}`} color="m" />
            ))}
          </>
        )}
      </div>

      <div class="urna-dispensadores">
        <Pasos
          etiqueta="Fichas azules (redondas)"
          valor={azules}
          min={0}
          max={max}
          bloqueado={bloqueado}
          alCambiar={(n) => ajustar({ azules: n, amarillas })}
        />
        <Pasos
          etiqueta="Fichas amarillas (cuadradas)"
          valor={amarillas}
          min={0}
          max={max}
          bloqueado={bloqueado}
          alCambiar={(n) => ajustar({ azules, amarillas: n })}
        />
      </div>

      <div class="urna-herramientas">
        <button
          type="button"
          class="boton boton-secundario"
          aria-label="Simular 100 extracciones"
          onClick={() => setSimulacion(simular(azules, amarillas))}
        >
          Simular 100<span class="urna-largo"> extracciones</span>
        </button>
        <button
          type="button"
          class="boton boton-secundario"
          aria-expanded={verParejas}
          onClick={() => setVerParejas((v) => !v)}
        >
          {verParejas ? 'Ocultar parejas' : 'Ver parejas'}
        </button>
      </div>

      {simulacion !== undefined && (
        <Respuesta titulo="Simulador">
          <p>{textoSimulacion(simulacion)}</p>
        </Respuesta>
      )}
      {verParejas && <Parejas azules={azules} amarillas={amarillas} />}

      {resultado && (
        <Respuesta titulo="Lo que hizo la caja fuerte">
          {textoRespuesta(resultado.estado, etapa.exito, resultado.resuelta).map((frase) => (
            <p key={frase}>{frase}</p>
          ))}
        </Respuesta>
      )}
    </div>
  );
}

function Ficha({ color }: { color: 'a' | 'm' }) {
  return <span class={`urna-ficha ${color === 'a' ? 'urna-ficha-azul' : 'urna-ficha-amarilla'}`} />;
}

/** Todas las formas de sacar dos fichas: cada pareja, una vez. */
function Parejas({ azules, amarillas }: { azules: number; amarillas: number }) {
  const { iguales, distintas } = listaDeParejas(azules, amarillas);
  if (iguales.length + distintas.length === 0) {
    return <p class="mecanismo-nota">Con menos de dos fichas no hay parejas.</p>;
  }
  return (
    <div class="parejas">
      <GrupoDeParejas titulo="Del mismo color (ganas tú)" lista={iguales} />
      <GrupoDeParejas titulo="De distinto color (gana La Voz)" lista={distintas} />
    </div>
  );
}

function GrupoDeParejas({ titulo, lista }: { titulo: string; lista: readonly Pareja[] }) {
  return (
    <section class="parejas-grupo">
      <h4 class="parejas-titulo">
        {titulo}: {lista.length}
      </h4>
      {/* Las fichas son un dibujo: el número de arriba ya dice cuántas parejas hay. */}
      <div class="parejas-lista" aria-hidden="true">
        {lista.map((pareja, i) => (
          <span key={i} class="pareja">
            <Ficha color={pareja[0]} />
            <Ficha color={pareja[1]} />
          </span>
        ))}
      </div>
    </section>
  );
}
