import type { Mecanismo } from '../../../content/esquema';

/**
 * Panel en franja (correcciones del 25 nov, sesión C): al accionar la máquina, el panel se
 * recoge a su pestaña mientras la máquina 3D se mueve y vuelve con lo que pasó. Puro: se prueba
 * sin navegador.
 *
 * Son los tiempos de las animaciones de `engine/mecanismos/` (que `ui/` no importa), con un
 * poco de aire para ver cómo queda. Los tanques no tienen tiempo fijo: su panel avisa con
 * `ocupar` mientras corre la corrida.
 */
const SEGUNDOS: Readonly<Record<Mecanismo, { accion: number; sello: number }>> = {
  // La palanca baja e imprime (0,9 s); con el sello, además se abre la registradora (0,6 s).
  etiquetadora: { accion: 1.3, sello: 0.6 },
  tanques: { accion: 0, sello: 0 },
  // La polea sube el gancho a 3 m/s, hasta 9 m.
  reflector: { accion: 2.5, sello: 0 },
  // Los carritos responden en vivo: no tienen nada que accionar.
  carritos: { accion: 0, sello: 0 },
  // La mano saca dos fichas y las muestra (2,5 s); la caja fuerte se abre a la vez (1,4 s).
  urna: { accion: 2.8, sello: 0 },
};

/** Lo mínimo que el panel se queda recogido después de accionar, en milisegundos. */
export function msRecogido(mecanismo: Mecanismo, sello: boolean): number {
  const s = SEGUNDOS[mecanismo];
  return Math.round((s.accion + (sello ? s.sello : 0)) * 1000);
}
