import type { ResultadoMecanismo } from '../../../signals/mecanismo';
import { Indicador, Respuesta } from './Controles';

interface Props {
  condiciones: Readonly<Record<string, boolean>>;
  resultado: ResultadoMecanismo | null;
}

/**
 * Panel de relleno para las máquinas que todavía no tienen el suyo (T37). No deja cambiar
 * los ajustes; muestra las condiciones de la etapa tal como las ve el controlador, para
 * comprobar que el marco y las órdenes funcionan. Se reemplaza en el `Panel.tsx` de cada
 * mecanismo.
 */
export default function PanelPendiente({ condiciones, resultado }: Props) {
  const ids = Object.keys(condiciones);
  return (
    <>
      <p class="mecanismo-nota">
        Los controles de esta máquina todavía no están listos. Por ahora solo se ve lo que revisa.
      </p>
      {ids.length > 0 && (
        <div class="indicadores">
          {ids.map((id) => (
            <Indicador key={id} encendido={condiciones[id] === true} texto={id} />
          ))}
        </div>
      )}
      {resultado && (
        <Respuesta>
          <p>
            {resultado.resuelta
              ? 'La máquina aceptó los ajustes.'
              : 'La máquina respondió, pero no pasó lo que pedía la etapa.'}
          </p>
        </Respuesta>
      )}
    </>
  );
}
