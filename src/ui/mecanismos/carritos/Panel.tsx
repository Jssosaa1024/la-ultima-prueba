import { useEffect, useState } from 'preact/hooks';
import {
  librosEn,
  librosEnPila,
  moverLibro,
  vaciarCarritos,
  type LugarLibro,
} from '../../../game/puzzles';
import { Indicador } from '../marco/Controles';
import type { PropsPanel } from '../marco/tipos';
import {
  diaCorto,
  etiquetaLugar,
  LAMPARAS,
  numero,
  textoInstruccion,
  textoMovimiento,
} from './textos';
import './carritos.css';

/**
 * Sala 4 · Los carritos de préstamo (T64).
 *
 * Los libros se mueven de a uno y con dos toques: primero de dónde sale (la pila o un
 * carrito) y después a dónde va. El origen se queda elegido, así que repartir varios libros
 * es un toque por libro, con botones grandes para el pulgar. Pasar un libro de un carrito a
 * otro es un solo movimiento: la lámpara de la media no parpadea a medio camino.
 *
 * Las lámparas del resumen semanal responden en vivo y se quedan a la vista mientras se
 * mueven los libros. El panel no dice qué mira cada lámpara: eso se descubre moviendo.
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
  // Al llegar se saca de la pila, si tiene libros: repartir es lo primero que se hace.
  const [origen, setOrigen] = useState<LugarLibro | null>(pila > 0 ? 'pila' : null);
  const [ultimo, setUltimo] = useState<string | null>(null);

  // Cada etapa empieza con sus propios libros en los carritos: el origen se elige de nuevo.
  useEffect(() => {
    setOrigen(librosEnPila(etapa, estado) > 0 ? 'pila' : null);
    setUltimo(null);
  }, [numeroDeEtapa]);

  // Un lugar que se quedó sin libros deja de ser el origen.
  const sale = origen !== null && librosEn(etapa, estado, origen) > 0 ? origen : null;

  const tocar = (lugar: LugarLibro): void => {
    if (bloqueado) return;
    if (sale === null) {
      if (librosEn(etapa, estado, lugar) > 0) setOrigen(lugar);
      return;
    }
    if (sale === lugar) {
      setOrigen(null);
      return;
    }
    const nuevo = moverLibro(etapa, estado, sale, lugar);
    if (!nuevo) return;
    setUltimo(textoMovimiento(sale, lugar));
    ajustar(nuevo);
  };

  // Los números de las lámparas tapadas salen de la última etapa, donde ya están todas.
  const todas = puzzle.etapas[puzzle.etapas.length - 1]?.exito.lamparas ?? {};
  const inactivo = (cantidad: number): boolean => bloqueado || (sale === null && cantidad === 0);

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
            <span key={id} class="lampara-tapada">
              {rotulo}
              {despues !== undefined && ` ${numero(despues)}`} · tapada
            </span>
          );
        })}
      </div>

      {/* Lo que acaba de pasar se oye, pero no se escribe: los números ya cambiaron a la vista. */}
      <p class="solo-lector" role="status">
        {ultimo}
      </p>
      <p class="carritos-instruccion">
        {bloqueado ? 'Así quedaron los carritos.' : textoInstruccion(sale, pila + enCarritos > 0)}
      </p>

      <button
        type="button"
        class={`lugar pila${sale === 'pila' ? ' lugar-origen' : ''}`}
        aria-pressed={sale === 'pila'}
        aria-label={etiquetaLugar('pila', pila, sale)}
        disabled={inactivo(pila)}
        onClick={() => tocar('pila')}
      >
        <span class="pila-nombre" aria-hidden="true">
          Pila
        </span>
        <span class="pila-libros" aria-hidden="true">
          {Array.from({ length: pila }, (_, k) => (
            <span key={k} class="libro-de-pie" />
          ))}
        </span>
        <span class="lugar-cuenta" aria-hidden="true">
          {pila}
        </span>
        {sale === 'pila' && (
          <span class="lugar-marca" aria-hidden="true">
            sale de aquí
          </span>
        )}
      </button>

      <div
        class="carritos-fila"
        style={{ gridTemplateColumns: `repeat(${estado.carritos.length}, minmax(0, 1fr))` }}
      >
        {estado.carritos.map((cantidad, i) => (
          <button
            key={i}
            type="button"
            class={`lugar carrito${sale === i ? ' lugar-origen' : ''}`}
            aria-pressed={sale === i}
            aria-label={etiquetaLugar(i, cantidad, sale)}
            disabled={inactivo(cantidad)}
            onClick={() => tocar(i)}
          >
            <span class="carrito-dia" aria-hidden="true">
              {diaCorto(i)}
            </span>
            <span class="carrito-libros" aria-hidden="true">
              {Array.from({ length: cantidad }, (_, k) => (
                <span key={k} class="libro" />
              ))}
            </span>
            <span class="lugar-cuenta" aria-hidden="true">
              {cantidad}
            </span>
            <span class="lugar-marca" aria-hidden="true">
              {sale === i ? 'sale' : ' '}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        class="boton boton-secundario carritos-vaciar"
        disabled={bloqueado || enCarritos === 0}
        onClick={() => {
          setOrigen('pila');
          setUltimo('Devolviste todos los libros a la pila.');
          ajustar(vaciarCarritos(estado));
        }}
      >
        Devolver todo a la pila
      </button>
    </>
  );
}
