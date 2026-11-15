/**
 * El guion de La Voz como CSV (T34a), para revisarlo en una hoja de cálculo y grabarlo.
 *
 * Separador coma y todo el texto entre comillas (RFC 4180), con BOM para que Excel lea las
 * tildes. GitHub lo muestra como tabla y Google Sheets lo abre tal cual. Las duraciones van
 * con coma decimal, como se escribe en Colombia.
 */
import {
  contarPalabras,
  type LineaGuion,
  type SalaGuion,
} from '../../src/content/esquema-guion.ts';

/** Dónde queda el CSV, para leerlo desde GitHub. */
export const CSV_POR_DEFECTO = 'docs/guion-la-voz.csv';

export const COLUMNAS = [
  'id',
  'quien',
  'sala',
  'momento',
  'final',
  'texto',
  'palabras',
  'duracion_s',
  'origen',
  'archivo_audio',
] as const;

/** Carpeta del audio de una línea: la de su sala, o `comun` si suena en cualquiera. */
const carpeta = (sala: SalaGuion): string => (sala === 'cualquiera' ? 'comun' : sala);

/** Dónde quedará el audio de la línea cuando se grabe (la salida de `optimize-audio`). */
export const archivoAudio = (l: LineaGuion): string =>
  `public/assets/audio/es-CO/${carpeta(l.sala)}/${l.id}.m4a`;

/** Quién habla y cómo suena: La Voz sale por los parlantes; las grabaciones, no. */
const quien = (l: LineaGuion): string =>
  l.momento === 'grabacion' ? 'Tobías (grabación, sin parlante)' : 'La Voz (parlantes)';

/** Marca de orden de bytes: Excel la necesita para leer el UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** Un campo entre comillas, con las comillas internas dobladas. */
const campo = (valor: string): string => `"${valor.replace(/"/g, '""')}"`;

/** `4.5` → `4,5`. */
const decimal = (n: number): string => String(n).replace('.', ',');

export function guionACsv(lineas: readonly LineaGuion[]): string {
  const filas = lineas.map((l) =>
    [
      l.id,
      quien(l),
      l.sala,
      l.momento,
      l.final ?? '',
      l.texto,
      String(contarPalabras(l.texto)),
      decimal(l.duracion_s),
      l.origen,
      archivoAudio(l),
    ]
      .map(campo)
      .join(','),
  );
  return `${BOM}${[COLUMNAS.join(','), ...filas].join('\n')}\n`;
}
