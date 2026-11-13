import { useEffect, useRef, useState } from 'preact/hooks';
import { inventario, totalSellos } from '../signals/partida';

/**
 * Región `aria-live` para el lector de pantalla (T41): anuncia lo que cambia en el HUD sin
 * que el jugador tenga que ir a buscarlo. Los textos salen del propio bundle.
 * No usa `role="status"` para no confundirse con los avisos de cada panel.
 */
export default function Anunciador() {
  const [mensaje, setMensaje] = useState('');
  const sellosAntes = useRef(totalSellos.value);
  const objetosAntes = useRef(inventario.value.map((o) => o.id));

  const sellos = totalSellos.value;
  const objetos = inventario.value;

  useEffect(() => {
    if (sellos > sellosAntes.current) setMensaje(`Sello obtenido. Llevas ${sellos} de 5.`);
    sellosAntes.current = sellos;
  }, [sellos]);

  useEffect(() => {
    const nuevos = objetos.filter((o) => !objetosAntes.current.includes(o.id));
    const ultimo = nuevos[nuevos.length - 1];
    if (ultimo) setMensaje(`Recogiste: ${ultimo.nombre}.`);
    objetosAntes.current = objetos.map((o) => o.id);
  }, [objetos]);

  return (
    <div class="solo-lector" aria-live="polite" aria-atomic="true">
      {mensaje}
    </div>
  );
}
