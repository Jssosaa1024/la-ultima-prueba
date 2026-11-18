import { signal } from '@preact/signals';
import type { Almacen } from '../game/guardado';

/**
 * Ajustes del jugador (T39): sensibilidad de la mirada, modo zurdo, tamaño del texto,
 * volumen de la voz y del ambiente, desde T19k brillo de la imagen y desde T42c volumen de
 * los efectos. Se guardan en `localStorage` de este equipo, aparte de la
 * partida: sobreviven a un final y a «Jugar solo».
 *
 * Lo guardado es texto no confiable (lo puede cambiar cualquiera): cada campo se revisa contra
 * una lista cerrada y, si no cumple, vuelve a su valor inicial sin tocar los demás.
 */

export const CLAVE_AJUSTES = 'la-ultima-prueba:ajustes';
/** Lo guardado nunca pasa de unos 150 caracteres: algo más largo no se lee. */
const MAX_TEXTO = 512;

/** Multiplicadores de la sensibilidad de la mirada, de la más lenta a la más rápida. */
export const SENSIBILIDADES = [0.5, 0.75, 1, 1.5, 2] as const;
export type Sensibilidad = (typeof SENSIBILIDADES)[number];

/**
 * Multiplicadores de la exposición (T19k), del más oscuro al más claro. Las salas de noche se
 * ven en penumbra: en una pantalla barata, con sol o con el brillo bajo, el jugador las aclara.
 */
export const BRILLOS = [0.85, 1, 1.2] as const;
export type Brillo = (typeof BRILLOS)[number];

export const TAMANOS_TEXTO = ['normal', 'grande', 'muy-grande'] as const;
export type TamanoTexto = (typeof TAMANOS_TEXTO)[number];

/** El volumen va de 0 a 100 en pasos de 10. */
export const PASO_VOLUMEN = 10;

export interface Ajustes {
  /** Multiplica la sensibilidad de la mirada (táctil y ratón). */
  sensibilidad: Sensibilidad;
  /** Joystick en la mitad derecha y mirada en la izquierda. */
  zurdo: boolean;
  texto: TamanoTexto;
  /** De 0 a 100. Lo aplicará la mezcla de audio (T43). */
  volumenVoz: number;
  /** De 0 a 100. Lo aplicará la mezcla de audio (T43). */
  volumenAmbiente: number;
  /** De 0 a 100: máquinas, puertas, objetos y sellos (T42c). */
  volumenEfectos: number;
  /** Multiplica la exposición de la escena (T19k). */
  brillo: Brillo;
}

export const AJUSTES_INICIALES: Readonly<Ajustes> = {
  sensibilidad: 1,
  zurdo: false,
  texto: 'normal',
  volumenVoz: 100,
  volumenAmbiente: 70,
  volumenEfectos: 100,
  brillo: 1,
};

const esVolumen = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 && v % PASO_VOLUMEN === 0;

/**
 * Revisa unos ajustes que vienen de fuera, campo por campo. Lo que no cumple toma el valor
 * inicial; los campos de más se ignoran.
 */
export function validarAjustes(dato: unknown): Ajustes {
  const objeto = typeof dato === 'object' && dato !== null && !Array.isArray(dato) ? dato : {};
  // Solo campos propios: nada heredado del prototipo.
  const campo = (k: keyof Ajustes): unknown =>
    Object.hasOwn(objeto, k) ? (objeto as Record<string, unknown>)[k] : undefined;
  const sensibilidad = SENSIBILIDADES.find((s) => s === campo('sensibilidad'));
  const texto = TAMANOS_TEXTO.find((t) => t === campo('texto'));
  const brillo = BRILLOS.find((b) => b === campo('brillo'));
  const zurdo = campo('zurdo');
  const voz = campo('volumenVoz');
  const ambiente = campo('volumenAmbiente');
  const efectos = campo('volumenEfectos');
  return {
    sensibilidad: sensibilidad ?? AJUSTES_INICIALES.sensibilidad,
    zurdo: typeof zurdo === 'boolean' ? zurdo : AJUSTES_INICIALES.zurdo,
    texto: texto ?? AJUSTES_INICIALES.texto,
    volumenVoz: esVolumen(voz) ? voz : AJUSTES_INICIALES.volumenVoz,
    volumenAmbiente: esVolumen(ambiente) ? ambiente : AJUSTES_INICIALES.volumenAmbiente,
    volumenEfectos: esVolumen(efectos) ? efectos : AJUSTES_INICIALES.volumenEfectos,
    brillo: brillo ?? AJUSTES_INICIALES.brillo,
  };
}

/** Lee los ajustes guardados; sin almacén o con algo ilegible, los iniciales. */
export function leerAjustes(almacen: Pick<Almacen, 'getItem'> | null): Ajustes {
  try {
    const texto = almacen?.getItem(CLAVE_AJUSTES);
    if (!texto || texto.length > MAX_TEXTO) return { ...AJUSTES_INICIALES };
    return validarAjustes(JSON.parse(texto));
  } catch {
    return { ...AJUSTES_INICIALES };
  }
}

/** Guarda los ajustes. En una pestaña privada o sin espacio, sigue sin guardar. */
export function guardarAjustes(almacen: Pick<Almacen, 'setItem'> | null, a: Ajustes): boolean {
  if (!almacen) return false;
  try {
    almacen.setItem(CLAVE_AJUSTES, JSON.stringify(validarAjustes(a)));
    return true;
  } catch {
    return false;
  }
}

/** `localStorage`, o `null` si no existe o el navegador no deja usarlo. */
function almacenDelNavegador(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Ajustes en uso. Lo escribe ui/; lo leen ui/ y engine/ (con `peek`, en cada cuadro). */
export const ajustes = signal<Ajustes>({ ...AJUSTES_INICIALES });

/** Carga los ajustes guardados en este equipo. Se llama una vez, al montar el juego. */
export function cargarAjustes(almacen: Almacen | null = almacenDelNavegador()): void {
  ajustes.value = leerAjustes(almacen);
}

/** Cambia uno o varios ajustes y los guarda. */
export function cambiarAjustes(
  cambios: Partial<Ajustes>,
  almacen: Almacen | null = almacenDelNavegador(),
): void {
  const nuevos = validarAjustes({ ...ajustes.value, ...cambios });
  ajustes.value = nuevos;
  guardarAjustes(almacen, nuevos);
}
