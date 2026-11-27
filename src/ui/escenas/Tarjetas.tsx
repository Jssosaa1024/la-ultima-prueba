import type { ComponentChildren } from 'preact';
import type { TarjetaId } from '../../content/escenas';
import Ficha from '../tema/Ficha';
import Sello from '../tema/Sello';

/**
 * Las tarjetas 2D de las escenas (Historia A): las fotos y los documentos de 1991 y lo que
 * muestra la pantalla de la portería. Son texto real y dibujos SVG hechos aquí: no se descarga
 * ninguna imagen. El nombre del estudiante es «E. C., 10-B», salvo en «El legado».
 */

interface Props {
  id: TarjetaId;
  /** Cuánto lleva el plano (0 a 1): mueve la barra de la copia y el reloj. */
  avance: number;
}

export default function Tarjeta({ id, avance }: Props) {
  switch (id) {
    case 'titulo':
      return (
        <div class="tarjeta-titulo">
          <p class="tarjeta-titulo-lugar">Institución Educativa Los Almendros</p>
          <p class="tarjeta-titulo-hora">Miércoles, 23:58</p>
        </div>
      );
    case 'feria':
      return (
        <Ficha clase="tarjeta-cartel">
          <p class="tarjeta-cartel-titulo">Feria de ciencias</p>
          <p class="tarjeta-cartel-hora">Mañana, 7:00 a. m.</p>
        </Ficha>
      );
    case 'foto-1991':
      return <Foto cartel="Filtro de agua · 10-B" pie="Feria de ciencias, 1991" />;
    case 'foto-legado':
      return <Foto cartel="Efraín Cárdenas, 10-B" pie="Feria de ciencias, 1991" />;
    case 'foto-vieja':
      return <Foto cartel="Filtro de agua · 10-B" vieja />;
    case 'datos':
      return <HojasDeDatos />;
    case 'acta':
      return (
        <Ficha clase="tarjeta-acta" como="article" etiquetadaPor="tarjeta-acta-titulo">
          <p class="tarjeta-acta-titulo" id="tarjeta-acta-titulo">
            Acta de la feria de ciencias · 1991
          </p>
          <dl class="tarjeta-acta-datos">
            <dt>Estudiante</dt>
            <dd>E. C., 10-B</dd>
            <dt>Acusación</dt>
            <dd>Copiar el proyecto de otro colegio</dd>
            <dt>Votación del jurado</dt>
            <dd>4 a 1</dd>
          </dl>
          <Sello texto="Sancionado" golpe clase="tarjeta-acta-sello" />
        </Ficha>
      );
    case 'carpeta':
      return (
        <Pantalla>
          <p class="tarjeta-pantalla-carpeta">
            <span class="tarjeta-pantalla-icono" aria-hidden="true" />
            ULTIMA_PRUEBA
          </p>
          <p>Migración automática: la carpeta se borra a las 00:40.</p>
        </Pantalla>
      );
    case 'copiando': {
      const porcentaje = Math.min(100, Math.round((avance / 0.8) * 100));
      return (
        <Pantalla>
          <p>Copiando ULTIMA_PRUEBA…</p>
          <div
            class="tarjeta-pantalla-barra"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentaje}
            aria-label="Copia del archivo"
          >
            <span style={{ width: `${porcentaje}%` }} />
          </div>
          <p>{porcentaje === 100 ? '100 %. La copia quedó en el pendrive.' : `${porcentaje} %`}</p>
        </Pantalla>
      );
    }
    case 'reloj': {
      const hora = avance < 0.33 ? '00:39:58' : avance < 0.66 ? '00:39:59' : '00:40:00';
      return (
        <p class="tarjeta-reloj" role="timer">
          {hora}
        </p>
      );
    }
    case 'migracion':
      return (
        <Pantalla>
          <p>Migración completa.</p>
          <p class="tarjeta-pantalla-carpeta">
            <span class="tarjeta-pantalla-icono" aria-hidden="true" />
            ULTIMA_PRUEBA: 0 archivos
          </p>
        </Pantalla>
      );
  }
}

function Pantalla({ children }: { children: ComponentChildren }) {
  return <div class="tarjeta-pantalla">{children}</div>;
}

/**
 * La foto de la feria de 1991 en blanco y negro: el puesto con el filtro de agua que gotea y,
 * al lado, el poste con su sombra (la misma foto de la prueba de la sala 3).
 */
function Foto({ cartel, pie, vieja = false }: { cartel: string; pie?: string; vieja?: boolean }) {
  return (
    <figure class={vieja ? 'tarjeta-foto tarjeta-foto-vieja' : 'tarjeta-foto'}>
      <div class="tarjeta-foto-marco">
        <svg
          viewBox="0 0 320 200"
          role="img"
          aria-label={`Foto en blanco y negro de un puesto de feria con un filtro de agua. Cartel: ${cartel}.`}
        >
          <rect width="320" height="200" fill="#a8a49c" />
          <rect width="320" height="120" fill="#7d7a73" />
          <rect y="150" width="320" height="50" fill="#bdb9b0" />
          {/* El poste y su sombra en el piso. */}
          <rect x="34" y="28" width="6" height="124" fill="#3a3834" />
          <polygon points="37,151 104,158 104,161 37,154" fill="#55524c" />
          {/* La mesa con su mantel. */}
          <rect x="110" y="108" width="170" height="10" fill="#e4e0d6" />
          <rect x="116" y="118" width="158" height="34" fill="#d3cec3" />
          {/* El filtro: botella con capas de grava, arena y carbón. */}
          <rect x="150" y="30" width="34" height="78" rx="5" fill="#d9d6cf" stroke="#4a4842" />
          <rect x="152" y="40" width="30" height="16" fill="#8a867e" />
          <rect x="152" y="56" width="30" height="18" fill="#b8b3a8" />
          <rect x="152" y="74" width="30" height="16" fill="#3e3c38" />
          <rect x="163" y="22" width="8" height="9" fill="#4a4842" />
          {/* La llave, las gotas y el frasco del agua limpia, sobre la mesa. */}
          <rect x="184" y="80" width="12" height="3" fill="#4a4842" />
          <circle cx="194" cy="87" r="1.8" fill="#5f6a74" />
          <circle cx="194" cy="93" r="1.4" fill="#5f6a74" />
          <rect x="186" y="96" width="24" height="12" rx="2" fill="#cfd5d9" stroke="#4a4842" />
          <rect x="188" y="101" width="20" height="6" fill="#a9b6bf" />
        </svg>
        {/* El cartel escrito a mano va en HTML, encima del mantel: así se lee (14 px o más). */}
        <span class="tarjeta-foto-letrero" aria-hidden="true">
          {cartel}
        </span>
      </div>
      {pie && <figcaption>{pie}</figcaption>}
    </figure>
  );
}

/**
 * Dos hojas de datos: la del filtro de 10-B y la del otro colegio. Coinciden en un solo dato,
 * a los 10 minutos (dos rectas distintas que se cruzan en un punto), y el jurado lo encerró.
 */
const MINUTOS = [0, 5, 10, 15, 20];
const HOJAS = [
  { titulo: 'Filtro de 10-B', valores: [80, 68, 56, 44, 32] },
  { titulo: 'Filtro del otro colegio', valores: [62, 59, 56, 53, 50] },
];

function HojasDeDatos() {
  return (
    <div class="tarjeta-hojas">
      {HOJAS.map((h) => (
        <Ficha key={h.titulo} variante="renglones" clase="tarjeta-hoja">
          <table>
            <caption>{h.titulo}</caption>
            <thead>
              <tr>
                <th scope="col">Minuto</th>
                <th scope="col">Turbidez</th>
              </tr>
            </thead>
            <tbody>
              {MINUTOS.map((m, i) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td>
                    {m === 10 ? (
                      <span class="tarjeta-dato-marcado">{h.valores[i]}</span>
                    ) : (
                      h.valores[i]
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Ficha>
      ))}
    </div>
  );
}
