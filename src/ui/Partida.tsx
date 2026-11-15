import { panel } from '../signals/interfaz';
import { girarTelefono } from '../signals/pantalla';
import { fase } from '../signals/partida';
import EleccionFinal from './finales/EleccionFinal';
import PantallaFinal from './finales/PantallaFinal';
import Anunciador from './Anunciador';
import IndicadorCarga from './carga/IndicadorCarga';
import Controles from './controles/Controles';
import Cuaderno from './cuaderno/Cuaderno';
import PanelGrabacion from './grabaciones/PanelGrabacion';
import Hud from './hud/Hud';
import Inspeccion from './inspeccion/Inspeccion';
import PanelMecanismo from './mecanismos/PanelMecanismo';
import PedirAyuda from './paneles/PedirAyuda';
import PanelPistas from './pistas/Pistas';
import GirarTelefono from './orientacion/GirarTelefono';

/**
 * Todo lo que se dibuja encima de la escena durante la partida: el HUD y, como mucho, un
 * panel 2D a la vez; al terminar, la pantalla de final. Los paneles nuevos se agregan aquí,
 * sin tocar `IslaJuego.tsx`.
 *
 * Con el celular en vertical (T41b), el aviso de girarlo tapa todo. Lo de debajo sigue
 * montado (un panel abierto queda igual al girar) pero no se lee ni se toca.
 */
export default function Partida() {
  if (fase.value === 'final') return <PantallaFinal />;
  const abierto = panel.value;
  const girar = girarTelefono.value;
  return (
    <>
      <div class="partida-capas" inert={girar} aria-hidden={girar || undefined}>
        {/* Con un panel abierto, el HUD queda debajo y no se lee ni se toca. */}
        <div inert={abierto !== null} aria-hidden={abierto !== null || undefined}>
          <Controles />
          <Hud />
        </div>
        {abierto === 'inspeccion' && <Inspeccion />}
        {abierto === 'cuaderno' && <Cuaderno />}
        {abierto === 'salida' && <EleccionFinal />}
        {abierto === 'ayuda' && <PedirAyuda />}
        {abierto === 'mecanismo' && <PanelMecanismo />}
        {abierto === 'pistas' && <PanelPistas />}
        {abierto === 'grabacion' && <PanelGrabacion />}
        <IndicadorCarga />
        <Anunciador />
      </div>
      {girar && <GirarTelefono />}
    </>
  );
}
