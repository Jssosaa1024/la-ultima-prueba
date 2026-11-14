import { useEffect, useRef } from 'preact/hooks';
import { precioImpreso } from '../../../game/puzzles';
import { Opciones, Respuesta } from '../marco/Controles';
import type { PropsPanel } from '../marco/tipos';
import { pesos, textoImpresion, textoRodillo, tituloEtiqueta } from './textos';
import './etiquetadora.css';

/**
 * Sala 1 · La etiquetadora (T45).
 *
 * Arriba, la etiqueta que tiene el producto y el precio de la pizarra. En medio, la caja de
 * rodillos: se ponen hasta dos en las ranuras. Al bajar la palanca (el botón lo pone el marco),
 * la máquina imprime y aquí se ve la etiqueta nueva y cuántos pesos cambió. Nunca dice si
 * estuvo bien: el jugador la compara con la pizarra.
 */
export default function PanelEtiquetadora({
  etapa,
  estado,
  resultado,
  bloqueado,
  ajustar,
}: PropsPanel<'etiquetadora'>) {
  const { rodillos, max_rodillos: ranuras } = etapa.controles;
  const pizarra = etapa.exito.precio;

  // En un celular la respuesta queda al final del panel: al imprimir, se trae a la vista.
  const impresion = useRef<HTMLDivElement>(null);
  const numero = resultado?.n;
  useEffect(() => {
    if (numero !== undefined) impresion.current?.scrollIntoView({ block: 'nearest' });
  }, [numero]);

  return (
    <>
      <dl class="etiquetas">
        <div class="etiqueta">
          <dt>{tituloEtiqueta(estado.producto)}</dt>
          <dd>{pesos(estado.precio)}</dd>
        </div>
        <div class="etiqueta etiqueta-pizarra">
          <dt>Precio en la pizarra</dt>
          <dd>{pesos(pizarra)}</dd>
        </div>
      </dl>

      <Opciones
        etiqueta={`Caja de rodillos: pon hasta ${ranuras} en la máquina`}
        opciones={rodillos.map((p) => ({ valor: p, texto: textoRodillo(p) }))}
        elegidas={estado.rodillos}
        max={ranuras}
        bloqueado={bloqueado}
        alCambiar={(puestos) => ajustar({ ...estado, rodillos: puestos })}
      />
      {/* Las ranuras, en el orden en que se pusieron los rodillos. */}
      <ol class="ranuras" aria-label="Ranuras de la máquina">
        {Array.from({ length: ranuras }, (_, i) => {
          const puesto = estado.rodillos[i];
          return (
            <li key={i} class={`ranura${puesto === undefined ? ' ranura-vacia' : ''}`}>
              <span class="ranura-nombre">Ranura {i + 1}</span>
              {puesto === undefined ? 'vacía' : textoRodillo(puesto)}
            </li>
          );
        })}
      </ol>

      {resultado && (
        <div ref={impresion}>
          <Respuesta titulo="La máquina imprimió">
            <Impresion
              antes={resultado.estado.precio}
              rodillos={resultado.estado.rodillos}
              pizarra={pizarra}
              resuelta={resultado.resuelta}
              sello={resultado.sello}
            />
          </Respuesta>
        </div>
      )}
    </>
  );
}

interface PropsImpresion {
  antes: number;
  rodillos: readonly number[];
  pizarra: number;
  resuelta: boolean;
  sello: boolean;
}

/** La etiqueta que salió de la máquina, con lo que pasó en una frase. */
function Impresion({ antes, rodillos, pizarra, resuelta, sello }: PropsImpresion) {
  const impreso = precioImpreso(antes, rodillos);
  return (
    <>
      <p class="etiqueta-impresa">{pesos(impreso)}</p>
      <p>{textoImpresion(antes, rodillos, impreso)}</p>
      <p>
        {resuelta
          ? 'Es el precio de la pizarra.'
          : `La pizarra dice ${pesos(pizarra)}. Puedes cambiar los rodillos y probar otra vez.`}
      </p>
      {sello && <p>Los tres productos tienen su precio. La registradora se abrió.</p>}
    </>
  );
}
