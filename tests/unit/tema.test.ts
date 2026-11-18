import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Ola 6 · tema «Archivo del colegio de noche» (T41c). Lee los colores de `src/ui/tema.css`
// (así no se desactualizan) y revisa el contraste AA de cada par de texto y fondo, y que las
// pantallas con el tema no tengan letra menor de 14 px.

const raiz = path.join(import.meta.dirname, '..', '..');
const leer = (ruta: string): string => readFileSync(path.join(raiz, ruta), 'utf8');

const TEMA = leer('src/ui/tema.css');

/** Valor `#rrggbb` de una variable `--tema-*` de tema.css. */
function color(nombre: string): string {
  const m = new RegExp(`--tema-${nombre}:\\s*(#[0-9a-f]{6});`, 'i').exec(TEMA);
  if (!m?.[1]) throw new Error(`--tema-${nombre} no está en tema.css o no es #rrggbb`);
  return m[1];
}

function luminancia(hex: string): number {
  const canal = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [qué es, color del texto, color del fondo] */
const PARES: [string, string, string][] = [
  ['texto sobre la noche', 'claro', 'noche'],
  ['texto suave sobre la noche', 'claro-suave', 'noche'],
  ['texto suave sobre la noche del panel', 'claro-suave', 'noche-2'],
  ['títulos y reloj ámbar', 'ambar', 'noche'],
  ['tinta sobre papel', 'tinta', 'papel'],
  ['tinta sobre papel viejo', 'tinta', 'papel-2'],
  ['tinta suave sobre papel', 'tinta-suave', 'papel'],
  ['tinta suave sobre papel viejo', 'tinta-suave', 'papel-2'],
  ['botón principal', 'tinta', 'ambar'],
  ['carpeta de cartón', 'tinta', 'carton'],
  ['sello rojo', 'sello-rojo', 'papel'],
  ['sello azul', 'sello-azul', 'papel'],
  ['sello verde', 'sello-verde', 'papel'],
  ['sello verde sobre papel viejo', 'sello-verde', 'papel-2'],
  // Paneles de carpeta de noche (máquinas, cuaderno, pistas): cajas elevadas y textareas.
  ['texto sobre la caja elevada', 'claro', 'noche-3'],
  ['texto suave sobre la caja elevada', 'claro-suave', 'noche-3'],
  ['ámbar sobre la carpeta de noche', 'ambar', 'noche-2'],
  ['texto sobre la tinta (campos para escribir)', 'claro', 'tinta'],
];

describe('tema del archivo: bordes de botones y casillas (3:1)', () => {
  for (const fondo of ['noche-2', 'noche-3']) {
    it(`borde sobre ${fondo}`, () => {
      expect(contraste(color('noche-linea'), color(fondo))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('tema del archivo: contraste AA', () => {
  for (const [nombre, texto, fondo] of PARES) {
    it(`${nombre}: al menos 4,5:1`, () => {
      expect(contraste(color(texto), color(fondo))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

/** Las hojas de estilo de las pantallas con el tema. */
const HOJAS = [
  'src/ui/tema.css',
  'src/ui/menus/menus.css',
  'src/ui/carga/carga.css',
  'src/ui/paneles/pausa.css',
  'src/ui/finales/finales.css',
  // Paneles (T41f). Quedan fuera tanques.css y reflector.css: sus px son de texto dentro de un
  // SVG que se escala con el panel.
  'src/ui/paneles/dialogo.css',
  'src/ui/mecanismos/mecanismos.css',
  'src/ui/mecanismos/etiquetadora/etiquetadora.css',
  'src/ui/mecanismos/carritos/carritos.css',
  'src/ui/mecanismos/urna/urna.css',
  'src/ui/cuaderno/cuaderno.css',
  'src/ui/inspeccion/inspeccion.css',
  'src/ui/pistas/pistas.css',
  'src/ui/grabaciones/grabaciones.css',
];

describe('tema del archivo: texto de 14 px o más', () => {
  for (const hoja of HOJAS) {
    it(hoja, () => {
      const tamanos = [...leer(hoja).matchAll(/font-size:\s*([\d.]+)(rem|px)/g)].map(
        ([, n = '0', unidad]) => (unidad === 'rem' ? Number(n) * 16 : Number(n)),
      );
      expect(tamanos.filter((px) => px < 14)).toEqual([]);
    });
  }
});
