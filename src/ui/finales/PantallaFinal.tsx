import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { GUION } from '../../content/guion';
import { textoResumen } from '../../content/resumenes';
import type { ResultadoSala } from '../../game/aprendizaje';
import {
  aprendizaje,
  DURACION_MS,
  final,
  type FinalId,
  GRABACIONES,
  grabaciones,
  reloj,
  totalSellos,
} from '../../signals/partida';
import { enviar } from '../../signals/puente';
import { formatoReloj } from '../hud/formato';
import Ficha from '../tema/Ficha';
import Sello, { type ColorSello } from '../tema/Sello';
import {
  AGRADECIMIENTO,
  CAMEOS,
  FINALES_TEXTO,
  POSCREDITOS,
  textoResultadoSala,
  textoTotalAprendizaje,
} from './textos';
import '../botones.css';
import '../tema.css';
import './finales.css';

/** El sello que cierra el expediente en cada final (tema del archivo, T41e). */
const SELLO_FINAL: Readonly<Record<FinalId, { texto: string; color: ColorSello }>> = {
  justo_a_tiempo: { texto: 'Salida autorizada', color: 'verde' },
  el_legado: { texto: 'Archivo restaurado', color: 'azul' },
  pedir_ayuda: { texto: 'Ayuda recibida', color: 'azul' },
  tiempo_cumplido: { texto: 'Tiempo cumplido', color: 'rojo' },
};

/** Cómo quedó cada sala, como sello en su ficha del resumen. */
const COLOR_RESULTADO: Readonly<Record<ResultadoSala, ColorSello>> = {
  sin_pistas: 'verde',
  con_pistas: 'azul',
  sin_resolver: 'rojo',
};

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
    <main class="final tema-archivo tema-fondo" aria-labelledby="final-titulo">
      <div class="final-caja">
        {paso === 'final' && <Resumen tituloRef={titulo} alSeguir={() => setPaso('creditos')} />}
        {paso === 'creditos' && (
          <Ficha como="section" variante="renglones" pestana="Créditos" entra clase="final-ficha">
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
          </Ficha>
        )}
        {paso === 'poscreditos' && (
          <Ficha como="section" pestana="Una cosa más…" entra clase="final-ficha">
            <h1 id="final-titulo" ref={titulo} tabIndex={-1} class="final-titulo">
              La fotocopiadora
            </h1>
            <p>{POSCREDITOS.escena}</p>
            <blockquote class="final-hoja">
              <Sello texto="Copia" decorativo clase="final-hoja-sello" />
              {POSCREDITOS.hoja}
            </blockquote>
            <div class="final-acciones">
              <button type="button" class="boton boton-principal" onClick={volver}>
                Volver al menú
              </button>
            </div>
          </Ficha>
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
  const voz = GUION.find((l) => l.final === id);
  // Al terminar, el controlador deja el reloj en pausa: `restanteMs` es lo que sobró.
  const usado = DURACION_MS - reloj.value.restanteMs;
  const sello = SELLO_FINAL[id];

  return (
    <Ficha como="section" pestana="Expediente cerrado · Final" entra clase="final-ficha">
      {/* El sello repite el título: es adorno y el lector de pantalla no lo lee dos veces. */}
      <Sello texto={sello.texto} color={sello.color} grande golpe decorativo clase="final-sello" />
      <h1 id="final-titulo" ref={tituloRef} tabIndex={-1} class="final-titulo">
        {texto.titulo}
      </h1>
      {texto.parrafos.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {/* Lo que dice La Voz en este final (T34), como subtítulo. */}
      {voz && (
        <p class="final-voz">
          <span class="final-voz-quien">La Voz:</span> {voz.texto}
        </p>
      )}
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
      <Aprendizaje />
      <div class="final-acciones">
        <button type="button" class="boton boton-principal" onClick={alSeguir}>
          Ver créditos
        </button>
        <button type="button" class="boton boton-secundario" onClick={() => enviar({ t: 'salir' })}>
          Volver al menú
        </button>
      </div>
    </Ficha>
  );
}

/**
 * Resumen de aprendizaje (punto 15 del hito 1): las cinco salas, resueltas o no, cuáles sin
 * pistas y cómo funcionaba cada máquina. Ningún final castiga: las que faltaron también se
 * explican.
 */
function Aprendizaje() {
  const resumen = aprendizaje.value;
  if (!resumen) return null;
  return (
    <section class="aprendizaje" aria-labelledby="aprendizaje-titulo">
      <h2 id="aprendizaje-titulo" class="final-subtitulo">
        Lo que aprendiste esta noche
      </h2>
      <p>{textoTotalAprendizaje(resumen.resueltas, resumen.resueltasSinPistas)}</p>
      <ol class="aprendizaje-salas">
        {resumen.salas.map((s) => {
          const t = textoResumen(s.sala);
          return (
            <li key={s.sala} class={`aprendizaje-sala aprendizaje-${s.resultado}`}>
              <p class="aprendizaje-cabeza">
                <span class="aprendizaje-tema">
                  Sala {s.numero} · {t.tema}
                </span>
                <Sello
                  texto={textoResultadoSala(s.resultado, s.pistasVistas)}
                  color={COLOR_RESULTADO[s.resultado]}
                  recto
                  clase="aprendizaje-estado"
                />
              </p>
              <p class="aprendizaje-maquina">
                {t.maquina}: {t.concepto}
              </p>
              <p class="aprendizaje-texto">{t.resumen}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
