import { describe, expect, it } from 'vitest';

/**
 * Contraste de los pares de color de texto y fondo de la interfaz (T41). Si cambia un color
 * en el CSS, actualízalo aquí: WCAG AA pide 4,5:1 para texto normal y 3:1 para texto grande.
 */
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

const PARES: [string, string, string][] = [
  ['texto general', '#f2f2f2', '#111418'],
  ['texto secundario', '#b8c2cc', '#111418'],
  ['texto secundario en panel', '#b8c2cc', '#1c2229'],
  ['títulos naranja', '#e8a33d', '#111418'],
  ['títulos naranja en panel', '#e8a33d', '#1c2229'],
  ['botón principal', '#111418', '#e8a33d'],
  ['reloj, últimos minutos', '#ffb4a8', '#111418'],
  ['ficha de inspección', '#1d1d1d', '#f4efe3'],
  ['encabezados de tabla', '#4a4438', '#f4efe3'],
  ['nota al margen', '#1b3f86', '#e6ecf7'],
  ['aviso de pausa', '#f2f2f2', '#2a3340'],
];

describe('contraste de la interfaz', () => {
  for (const [nombre, texto, fondo] of PARES) {
    it(`${nombre}: al menos 4,5:1`, () => {
      expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('el borde de foco blanco contrasta con el fondo oscuro', () => {
    expect(contraste('#ffffff', '#111418')).toBeGreaterThanOrEqual(3);
  });
});
