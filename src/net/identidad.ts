import { crearJugador, esJugador } from './protocolo';

/**
 * El id de jugador se guarda en el navegador para volver a la partida con el mismo (T89):
 * así el anfitrión le devuelve su rol y sus objetos. Es un id al azar, sin datos personales.
 * `localStorage` es dato no confiable: se valida al leerlo y todo va en try/catch (pestaña
 * privada, almacenamiento bloqueado).
 */

const CLAVE = 'la-ultima-prueba:jugador';

/** El id guardado, o uno nuevo (que se intenta guardar). */
export function jugadorDelNavegador(almacen: Storage | null = almacenSeguro()): string {
  try {
    const guardado = almacen?.getItem(CLAVE);
    if (esJugador(guardado)) return guardado;
  } catch {
    // Sin almacenamiento: se usa un id nuevo en cada carga.
  }
  const nuevo = crearJugador();
  try {
    almacen?.setItem(CLAVE, nuevo);
  } catch {
    // Igual se puede jugar; solo no se podrá reconectar tras recargar.
  }
  return nuevo;
}

function almacenSeguro(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
