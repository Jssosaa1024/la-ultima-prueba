import { effect } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { joystick, punteroBloqueado } from '../../signals/controles';
import { controlesActivos } from '../../signals/interfaz';
import './controles.css';

/**
 * Lo que se ve de los controles encima de la escena (T15b):
 *
 * - **Joystick.** En pantallas táctiles, un anillo tenue marca dónde poner el pulgar; al tocar
 *   la mitad izquierda, el anillo salta al dedo y la perilla lo sigue (signal `joystick`).
 * - **Mira y aviso.** Con el ratón bloqueado en la escena (signal `punteroBloqueado`), una
 *   mira en el centro y el aviso «Esc para soltar el ratón».
 *
 * Nada de esto recibe toques: es solo dibujo, y los toques pasan a la escena.
 */
export default function Controles() {
  const baseRef = useRef<HTMLDivElement>(null);
  const perillaRef = useRef<HTMLDivElement>(null);

  // El joystick cambia en cada cuadro mientras el dedo se mueve: se escribe directo en el
  // estilo de los dos elementos, sin redibujar el componente.
  useEffect(
    () =>
      effect(() => {
        const base = baseRef.current;
        const perilla = perillaRef.current;
        if (!base || !perilla) return;
        const j = joystick.value;
        base.classList.toggle('joystick-activo', j !== null);
        if (!j) {
          base.removeAttribute('style');
          perilla.removeAttribute('style');
          return;
        }
        const lado = `${j.radio * 2}px`;
        base.style.width = lado;
        base.style.height = lado;
        base.style.transform = `translate(${j.baseX - j.radio}px, ${j.baseY - j.radio}px)`;
        perilla.style.transform = `translate(${j.perillaX}px, ${j.perillaY}px)`;
      }),
    [],
  );

  return (
    <div class="controles" hidden={!controlesActivos.value}>
      <div ref={baseRef} class="joystick" aria-hidden="true">
        <div ref={perillaRef} class="joystick-perilla" />
      </div>
      {punteroBloqueado.value && (
        <>
          <div class="mira" aria-hidden="true" />
          <p class="aviso-raton">Esc para soltar el ratón</p>
        </>
      )}
    </div>
  );
}
