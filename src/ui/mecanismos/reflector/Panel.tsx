import {
  conDistancia,
  conMuesca,
  conPolea,
  lecturaPolea,
  lecturaPostes,
  sombraMarcador,
} from '../../../game/puzzles';
import { Indicador, Opciones, Pasos, Respuesta } from '../marco/Controles';
import type { PropsPanel } from '../marco/tipos';
import Escena from './Escena';
import { metros, nombrePoste, nombreSensor, textoMarcador, textoPolea, textoPoste } from './textos';
import './reflector.css';

/** Largo de la cinta métrica pintada en el piso del gimnasio, en metros. */
const LARGO_CINTA = 16;

/**
 * Sala 3 · El reflector (T58). Tres controles discretos: la muesca del reflector, la
 * distancia del poste que se desliza y la cuerda de la polea. Las sombras responden en vivo:
 * el dibujo y las frases cambian con cada toque, y los sensores se encienden cuando la punta
 * de la sombra los toca. La polea solo responde al soltarla (el botón lo pone el marco).
 */
export default function PanelReflector({
  etapa,
  estado,
  condiciones,
  resultado,
  bloqueado,
  ajustar,
}: PropsPanel<'reflector'>) {
  const c = etapa.controles;
  const lecturas = lecturaPostes(estado);
  const marcador = sombraMarcador(etapa, estado.muesca);
  const moviles = lecturas.filter((l) => c.postes_moviles.includes(l.id));
  const polea = estado.polea;
  const respuestaPolea = resultado ? lecturaPolea(etapa, resultado.estado.polea) : null;

  return (
    <>
      <Escena
        filas={lecturas.map((l) => ({ lectura: l, movil: c.postes_moviles.includes(l.id) }))}
        marcador={marcador}
        largo={marcador === null ? c.distancia_max : LARGO_CINTA}
      />

      {/* Las cinco muescas caben en una fila, también en un celular angosto. */}
      <div class="reflector-muescas">
        <Opciones
          etiqueta="Inclinación del reflector"
          opciones={c.muescas.map((m) => ({ valor: m, texto: `${m}°` }))}
          elegidas={[estado.muesca]}
          bloqueado={bloqueado || !c.girar}
          alCambiar={(elegidas) => {
            // Tocar la muesca puesta no la quita: el reflector siempre está en alguna.
            const muesca = elegidas[0];
            if (muesca !== undefined) ajustar(conMuesca(estado, muesca));
          }}
        />
      </div>

      {moviles.map(
        (l) =>
          l.distancia !== null && (
            <Pasos
              key={l.id}
              etiqueta={`${nombrePoste(l.altura)}: distancia a su sensor`}
              valor={l.distancia}
              min={c.distancia_min}
              max={c.distancia_max}
              texto={metros(l.distancia)}
              bloqueado={bloqueado}
              alCambiar={(d) => ajustar(conDistancia(estado, l.id, d))}
            />
          ),
      )}

      {c.polea && polea !== null && (
        <div class="reflector-polea">
          <Pasos
            etiqueta="Cuerda de la polea"
            valor={polea}
            min={c.polea.min}
            max={c.polea.max}
            texto={metros(polea)}
            bloqueado={bloqueado}
            alCambiar={(n) => ajustar(conPolea(estado, n))}
          />
        </div>
      )}

      <Respuesta titulo="Lo que se ve ahora">
        <ul class="reflector-lecturas">
          {lecturas.map((l) => (
            <li key={l.id}>{textoPoste(l)}</li>
          ))}
          {marcador !== null && <li>{textoMarcador(marcador)}</li>}
        </ul>
      </Respuesta>

      {etapa.exito.sensores.length > 0 && (
        <div class="indicadores">
          {lecturas
            .filter((l) => etapa.exito.sensores.includes(l.id))
            .map((l) => (
              <Indicador
                key={l.id}
                encendido={condiciones[l.id] === true}
                texto={nombreSensor(l.altura)}
              />
            ))}
        </div>
      )}

      {resultado && respuestaPolea && resultado.estado.polea !== null && (
        <div class="mecanismo-respuesta reflector-respuesta-polea">
          <Respuesta titulo="Lo que pasó al soltar la polea">
            <p>{textoPolea(resultado.estado.polea, respuestaPolea)}</p>
          </Respuesta>
        </div>
      )}
    </>
  );
}
