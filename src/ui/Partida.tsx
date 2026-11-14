import { panel } from '../signals/interfaz';
import { fase } from '../signals/partida';
import PantallaFinal from './finales/PantallaFinal';
import Anunciador from './Anunciador';
import IndicadorCarga from './carga/IndicadorCarga';
import Controles from './controles/Controles';
import Cuaderno from './cuaderno/Cuaderno';
import Hud from './hud/Hud';
import Inspeccion from './inspeccion/Inspeccion';

/**
 * Todo lo que se dibuja encima de la escena durante la partida: el HUD y, como mucho, un
 * panel 2D a la vez; al terminar, la pantalla de final. Los paneles nuevos se agregan aquí,
 * sin tocar `IslaJuego.tsx`.
 */
export default function Partida() {
  if (fase.value === 'final') return <PantallaFinal />;
  const abierto = panel.value;
  return (
    <>
      {/* Con un panel abierto, el HUD queda debajo y no se lee ni se toca. */}
      <div inert={abierto !== null} aria-hidden={abierto !== null || undefined}>
        <Controles />
        <Hud />
      </div>
      {abierto === 'inspeccion' && <Inspeccion />}
      {abierto === 'cuaderno' && <Cuaderno />}
      <IndicadorCarga />
      <Anunciador />
    </>
  );
}
