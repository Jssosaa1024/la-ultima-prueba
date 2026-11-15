import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { crearDetectorToques, pideDepuracion } from './apertura';
import { depuracionAbierta } from './metricas';

/**
 * Punto de entrada del panel de depuración (T11n). Pesa poco: decide si el panel se abre
 * (`?debug=1` o 3 toques en la esquina superior izquierda) y solo entonces descarga el panel
 * con `import()`. En producción el panel existe, pero nadie lo ve si no lo pide.
 */
export default function Depuracion() {
  const [Panel, setPanel] = useState<ComponentType | null>(null);
  const abierta = depuracionAbierta.value;

  useEffect(() => {
    if (pideDepuracion(window.location.search)) depuracionAbierta.value = true;
    const detector = crearDetectorToques();
    // En captura: el toque sigue llegando al juego. Los toques sobre un botón no cuentan: en la
    // esquina está «Salir», que pide confirmación.
    const alTocar = (e: PointerEvent): void => {
      if (e.target instanceof Element && e.target.closest('button, a, input, textarea, select'))
        return;
      if (detector.tocar(e.clientX, e.clientY, e.timeStamp)) depuracionAbierta.value = true;
    };
    window.addEventListener('pointerdown', alTocar, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', alTocar, { capture: true });
      depuracionAbierta.value = false;
    };
  }, []);

  useEffect(() => {
    if (!abierta || Panel) return;
    let cancelado = false;
    void import('./PanelDebug').then((m) => {
      if (!cancelado) setPanel(() => m.default);
    });
    return () => {
      cancelado = true;
    };
  }, [abierta, Panel]);

  return abierta && Panel ? <Panel /> : null;
}
