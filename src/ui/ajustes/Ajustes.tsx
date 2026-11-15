import { useEffect } from 'preact/hooks';
import {
  AJUSTES_INICIALES,
  ajustes,
  cambiarAjustes,
  PASO_VOLUMEN,
  SENSIBILIDADES,
  type TamanoTexto,
} from '../../signals/ajustes';
import { enviar } from '../../signals/puente';
import { Opciones, Pasos } from '../mecanismos/marco/Controles';
import Dialogo from '../paneles/Dialogo';
import '../mecanismos/mecanismos.css';
import './ajustes.css';

/** Nombre de cada sensibilidad, en el orden de `SENSIBILIDADES`. */
const NOMBRES_SENSIBILIDAD = ['Muy lenta', 'Lenta', 'Normal', 'Rápida', 'Muy rápida'];

const OPCIONES_TEXTO: readonly { valor: TamanoTexto; texto: string }[] = [
  { valor: 'normal', texto: 'Normal' },
  { valor: 'grande', texto: 'Grande' },
  { valor: 'muy-grande', texto: 'Muy grande' },
];

const OPCIONES_MANO: readonly { valor: 'izquierda' | 'derecha'; texto: string }[] = [
  { valor: 'izquierda', texto: 'A la izquierda' },
  { valor: 'derecha', texto: 'A la derecha (zurdo)' },
];

/** Los controles de los ajustes, iguales en el menú y en la partida. */
function ControlesAjustes() {
  const a = ajustes.value;
  const nivel = SENSIBILIDADES.indexOf(a.sensibilidad);
  return (
    <div class="ajustes">
      <Pasos
        etiqueta="Sensibilidad de la mirada"
        valor={nivel}
        min={0}
        max={SENSIBILIDADES.length - 1}
        texto={NOMBRES_SENSIBILIDAD[nivel] ?? 'Normal'}
        alCambiar={(n) => {
          const s = SENSIBILIDADES[n];
          if (s !== undefined) cambiarAjustes({ sensibilidad: s });
        }}
      />
      <Opciones
        etiqueta="Joystick para caminar"
        opciones={OPCIONES_MANO}
        elegidas={[a.zurdo ? 'derecha' : 'izquierda']}
        alCambiar={([lado]) => {
          // Tocar la opción ya puesta la «quita»: se ignora, siempre hay un lado.
          if (lado) cambiarAjustes({ zurdo: lado === 'derecha' });
        }}
      />
      <p class="ajustes-nota">
        {a.zurdo
          ? 'Caminas con el pulgar derecho y miras arrastrando en la mitad izquierda.'
          : 'Caminas con el pulgar izquierdo y miras arrastrando en la mitad derecha.'}
      </p>
      <Opciones
        etiqueta="Tamaño del texto"
        opciones={OPCIONES_TEXTO}
        elegidas={[a.texto]}
        alCambiar={([texto]) => {
          if (texto) cambiarAjustes({ texto });
        }}
      />
      <Pasos
        etiqueta="Volumen de la voz"
        valor={a.volumenVoz}
        min={0}
        max={100}
        paso={PASO_VOLUMEN}
        texto={`${a.volumenVoz} %`}
        alCambiar={(v) => cambiarAjustes({ volumenVoz: v })}
      />
      <Pasos
        etiqueta="Volumen del ambiente"
        valor={a.volumenAmbiente}
        min={0}
        max={100}
        paso={PASO_VOLUMEN}
        texto={`${a.volumenAmbiente} %`}
        alCambiar={(v) => cambiarAjustes({ volumenAmbiente: v })}
      />
    </div>
  );
}

interface Props {
  alCerrar: () => void;
  /** En la partida individual, el reloj se detiene mientras los ajustes están abiertos. */
  pausarReloj?: boolean;
}

/**
 * Panel de ajustes (T39), desde el menú de inicio y desde el HUD. Cada cambio se aplica y se
 * guarda en el acto: no hay botón «Guardar».
 */
export default function PanelAjustes({ alCerrar, pausarReloj = false }: Props) {
  useEffect(() => {
    if (!pausarReloj) return;
    enviar({ t: 'pausar' });
    return () => enviar({ t: 'reanudar' });
  }, [pausarReloj]);

  return (
    <Dialogo
      antetitulo="Ajustes"
      titulo="Ajustes del juego"
      // Al cerrar, el foco vuelve al botón «Ajustes» del menú o del HUD.
      retorno="ajustes"
      alCerrar={alCerrar}
      acciones={
        <button
          type="button"
          class="boton boton-secundario"
          onClick={() => cambiarAjustes({ ...AJUSTES_INICIALES })}
        >
          Restablecer
        </button>
      }
    >
      {pausarReloj && (
        <p class="ajustes-pausa" role="status">
          El reloj está en pausa mientras tienes los ajustes abiertos.
        </p>
      )}
      <ControlesAjustes />
    </Dialogo>
  );
}
