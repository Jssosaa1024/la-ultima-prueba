import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DURACION_MS,
  final,
  GRABACIONES,
  grabaciones,
  reloj,
  totalSellos,
} from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { formatoReloj } from '../hud/formato';
import { AGRADECIMIENTO, CAMEOS, FINALES_TEXTO, POSCREDITOS } from './textos';
import '../botones.css';
import './finales.css';

type Paso = 'final' | 'creditos' | 'poscreditos';

/**
 * Pantallas del cierre (T40): el final que se obtuvo, los créditos con humor y la escena
 * poscréditos. Cada paso lleva el foco a su título para que el lector de pantalla lo anuncie.
 */
export default function PantallaFinal() {
  const [paso, setPaso] = useState<Paso>('final');
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
  }, [paso]);

  const volver = (): void => enviar({ t: 'salir' });

  return (
    <main class="final" aria-labelledby="final-titulo">
      <div class="final-caja">
        {paso === 'final' && <Resumen tituloRef={titulo} alSeguir={() => setPaso('creditos')} />}
        {paso === 'creditos' && (
          <section>
            <p class="final-antetitulo">Créditos</p>
            <h1 id="final-titulo" ref={titulo} tabIndex={-1} class="final-titulo">
              La Última Prueba
            </h1>
            <h2 class="final-subtitulo">Con la participación especial de</h2>
            <ul class="final-lista">
              {CAMEOS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p class="final-agradecimiento">{AGRADECIMIENTO}</p>
            <p class="final-nota">
              Los personajes de estos créditos son ficticios. Los créditos de modelos, imágenes y
              sonidos se publicarán en la página de créditos del sitio.
            </p>
            <div class="final-acciones">
              <button
                type="button"
                class="boton boton-principal"
                onClick={() => setPaso('poscreditos')}
              >
                Continuar
              </button>
            </div>
          </section>
        )}
        {paso === 'poscreditos' && (
          <section>
            <p class="final-antetitulo">Una cosa más…</p>
            <h1 id="final-titulo" ref={titulo} tabIndex={-1} class="final-titulo">
              La fotocopiadora
            </h1>
            <p>{POSCREDITOS.escena}</p>
            <blockquote class="final-hoja">{POSCREDITOS.hoja}</blockquote>
            <div class="final-acciones">
              <button type="button" class="boton boton-principal" onClick={volver}>
                Volver al menú
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Resumen({
  tituloRef,
  alSeguir,
}: {
  tituloRef: RefObject<HTMLHeadingElement | null>;
  alSeguir: () => void;
}) {
  const id = final.value ?? 'tiempo_cumplido';
  const texto = FINALES_TEXTO[id];
  // Al terminar, el controlador deja el reloj en pausa: `restanteMs` es lo que sobró.
  const usado = DURACION_MS - reloj.value.restanteMs;

  return (
    <section>
      <p class="final-antetitulo">Final</p>
      <h1 id="final-titulo" ref={tituloRef} tabIndex={-1} class="final-titulo">
        {texto.titulo}
      </h1>
      {texto.parrafos.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <dl class="final-resumen">
        <div>
          <dt>Sellos</dt>
          <dd>{totalSellos.value} de 5</dd>
        </div>
        <div>
          <dt>Grabaciones</dt>
          <dd>
            {grabaciones.value.length} de {GRABACIONES.length}
          </dd>
        </div>
        <div>
          <dt>Tiempo usado</dt>
          <dd>{formatoReloj(usado)}</dd>
        </div>
      </dl>
      <div class="final-acciones">
        <button type="button" class="boton boton-principal" onClick={alSeguir}>
          Ver créditos
        </button>
        <button type="button" class="boton boton-secundario" onClick={() => enviar({ t: 'salir' })}>
          Volver al menú
        </button>
      </div>
    </section>
  );
}
