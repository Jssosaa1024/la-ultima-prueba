import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { crearDetectorToques, pideDepuracion } from './apertura';
import { describirCarga } from './estres/ejes';
import { ESTRES_INACTIVO, estres } from './estres/estado';
import { almacenDelNavegador, revisarRecarga } from './estres/marca';
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
    // T11r: si la pestaña se recargó a mitad de la prueba de estrés, la marca lo dice. El
    // escalón queda como «recarga por memoria» y el panel se abre para mostrarlo.
    const dpr = window.devicePixelRatio || 1;
    const recarga = revisarRecarga(almacenDelNavegador(), (eje, escalon) =>
      describirCarga(eje, escalon, dpr),
    );
    if (recarga) {
      estres.value = {
        ...ESTRES_INACTIVO,
        fase: 'terminada',
        eje: recarga.eje,
        escalon: recarga.escalon,
        carga: describirCarga(recarga.eje, recarga.escalon, dpr),
        escalones: recarga.escalones,
        motivo: 'recarga',
      };
      depuracionAbierta.value = true;
    }
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
