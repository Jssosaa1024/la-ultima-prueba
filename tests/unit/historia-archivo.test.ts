import { describe, expect, it } from 'vitest';
import { EXPEDIENTE } from '../../src/content/expediente';
import { FINALES } from '../../src/signals/partida';
import { seriesBitacora } from '../../src/ui/cuaderno/bitacora';
import { estadoFolio, FOTO_FINAL, horaDeCierre } from '../../src/ui/finales/textos';

// Historia · sesión C: el cierre como expediente y las fichas de evidencia del cuaderno.

describe('acta de la noche', () => {
  it('se cierra a las 23:59 más el tiempo usado', () => {
    expect(horaDeCierre('el_legado', 0)).toBe('23:59');
    expect(horaDeCierre('el_legado', 60_000)).toBe('00:00');
    expect(horaDeCierre('justo_a_tiempo', 32 * 60_000 + 59_000)).toBe('00:31');
    expect(horaDeCierre('pedir_ayuda', 5 * 60_000)).toBe('00:04');
  });

  it('con el tiempo cumplido es la hora del borrado', () => {
    expect(horaDeCierre('tiempo_cumplido', 40 * 60_000)).toBe('00:40');
  });
});

describe('foto de la feria en los finales', () => {
  it('solo «El legado» muestra el nombre en el cartel', () => {
    for (const id of FINALES) {
      const foto = FOTO_FINAL[id];
      const texto = foto ? `${foto.cartel ?? ''} ${foto.pie} ${foto.descripcion}` : '';
      if (id === 'el_legado') expect(texto).toMatch(/Efraín Cárdenas, 10-B/);
      else expect(texto).not.toMatch(/Cárdenas/);
    }
  });

  it('«Pedir ayuda» es la salida sin giro: no tiene foto', () => {
    expect(FOTO_FINAL.pedir_ayuda).toBeNull();
  });
});

describe('folios de los créditos', () => {
  it('dice si cada prueba se revisó y adónde fue', () => {
    expect(estadoFolio(false, true)).toBe('Sin revisar');
    expect(estadoFolio(true, true)).toMatch(/pendrive/);
    expect(estadoFolio(true, false)).toMatch(/00:40/);
  });
});

describe('bitácora del cuaderno', () => {
  const bitacora = EXPEDIENTE.find((p) => p.id === 's2-laboratorio');

  it('lee las dos rectas de la tabla y su único cruce', () => {
    const series = bitacora ? seriesBitacora(bitacora) : null;
    expect(series?.propio).toHaveLength(5);
    expect(series?.otro).toHaveLength(5);
    // Dos rectas distintas se cruzan en un solo punto (docs/historia.md, sala 2).
    expect(series?.cruces).toEqual([{ minuto: 15, litros: 6 }]);
  });

  it('sin tabla de tres columnas no hay dibujo', () => {
    const recibo = EXPEDIENTE.find((p) => p.id === 's1-cooperativa');
    expect(recibo && seriesBitacora(recibo)).toBeNull();
  });
});
