import { useEffect, useState } from 'preact/hooks';
import { librosEnPila, moverLibro, vaciarCarritos } from '../../../game/puzzles';
import { Indicador } from '../marco/Controles';
import type { PropsPanel } from '../marco/tipos';
import {
  diaCorto,
  etiquetaPoner,
  etiquetaQuitar,
  INSTRUCCION,
  LAMPARAS,
  numero,
  textoCarrito,
  textoMovimiento,
  textoPila,
} from './textos';
import './carritos.css';

/**
 * Sala 4 · Los carritos de préstamo (T64; correcciones del 25 nov).
 *
 * Cada carrito tiene un «+» y un «−»: el «+» pone un libro de la pila en ese carrito y el «−»
 * lo devuelve a la pila. Un toque, un libro, sin elegir antes de dónde sale: así se quita un
 * solo libro sin vaciar todo. «Devolver todo a la pila» sigue para empezar de nuevo.
 *
 * Las lámparas del resumen semanal responden en vivo y se quedan a la vista mientras se
 * mueven los libros; los montones se ven en los carritos 3D. El panel no dice qué mira cada
 * lámpara: eso se descubre moviendo.
 */
export default function PanelCarritos({
  puzzle,
  etapa,
  numero: numeroDeEtapa,
  estado,
  condiciones,
  bloqueado,
  ajustar,
}: PropsPanel<'carritos'>) {
  const pila = librosEnPila(etapa, estado);
  const enCarritos = etapa.controles.libros - pila;
  const [ultimo, setUltimo] = useState<string | null>(null);

  // Cada etapa empieza con sus propios libros en los carritos.
  useEffect(() => setUltimo(null), [numeroDeEtapa]);

  const mover = (de: 'pila' | number, a: 'pila' | number): void => {
    if (bloqueado) return;
    const nuevo = moverLibro(etapa, estado, de, a);
    if (!nuevo) return;
    setUltimo(textoMovimiento(de, a));
    ajustar(nuevo);
  };

  // Los números de las lámparas tapadas salen de la última etapa, donde ya están todas.
  const todas = puzzle.etapas[puzzle.etapas.length - 1]?.exito.lamparas ?? {};

  return (
    <>
      <div class="carritos-lamparas" role="group" aria-label="Lámparas del resumen semanal">
        {LAMPARAS.map(({ id, rotulo }) => {
          const valor = etapa.exito.lamparas[id];
          if (valor !== undefined) {
            return (
              <Indicador
                key={id}
                encendido={condiciones[id] === true}
                texto={`${rotulo} ${numero(valor)}`}
              />
            );
          }
          const despues = todas[id];
          return (
            <span key={id} class="carritos-tapada">
              {rotulo}
              {despues !== undefined && ` ${numero(despues)}`}
              {/* En la franja basta el borde punteado: «tapada» lo sigue leyendo el lector. */}
              <span class="carritos-largo"> · tapada</span>
            </span>
          );
        })}
      </div>

      {/* Lo que acaba de pasar se oye, pero no se escribe: los números ya cambiaron a la vista. */}
      <p class="solo-lector" role="status">
        {ultimo}
      </p>
      <p class="carritos-instruccion">{bloqueado ? 'Así quedaron los carritos.' : INSTRUCCION}</p>

      <div
        class="carritos-fila"
        style={{ gridTemplateColumns: `repeat(${estado.carritos.length}, minmax(0, 1fr))` }}
      >
        {estado.carritos.map((cantidad, i) => (
          <div key={i} class="carritos-carrito" role="group" aria-label={textoCarrito(i, cantidad)}>
            <button
              type="button"
              class="carritos-boton"
              aria-label={etiquetaPoner(i)}
              disabled={bloqueado || pila === 0}
              onClick={() => mover('pila', i)}
            >
              +
            </button>
            <span class="carritos-monton" aria-hidden="true">
              {Array.from({ length: cantidad }, (_, k) => (
                <span key={k} class="carritos-libro" />
              ))}
            </span>
            <span class="carritos-cuenta" aria-hidden="true">
              <span class="carritos-dia">{diaCorto(i)}</span> {cantidad}
            </span>
            <button
              type="button"
              class="carritos-boton"
              aria-label={etiquetaQuitar(i)}
              disabled={bloqueado || cantidad === 0}
              onClick={() => mover(i, 'pila')}
            >
              −
            </button>
          </div>
        ))}
      </div>

      <div class="carritos-pie">
        <p class="carritos-pila">
          <span class="carritos-largo">{textoPila(pila)}</span>
          {/* En la franja, solo el número: los libros de la pila se ven en la biblioteca 3D. */}
          <span class="carritos-corto" aria-hidden="true">
            Pila: {pila}
          </span>
          <span class="carritos-pila-libros" aria-hidden="true">
            {Array.from({ length: pila }, (_, k) => (
              <span key={k} class="carritos-libro-de-pie" />
            ))}
          </span>
        </p>
        <button
          type="button"
          class="boton boton-secundario carritos-vaciar"
          aria-label="Devolver todo a la pila"
          disabled={bloqueado || enCarritos === 0}
          onClick={() => {
            setUltimo('Devolviste todos los libros a la pila.');
            ajustar(vaciarCarritos(estado));
          }}
        >
          Devolver todo<span class="carritos-largo"> a la pila</span>
        </button>
      </div>
    </>
  );
}
