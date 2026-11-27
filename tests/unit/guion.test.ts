import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import datos from '../../src/content/guion.json';
import {
  contarPalabras,
  duracionEstimada,
  esquemaLineaGuion,
  esquemaLineaGuionValidada,
  FINALES_GUION,
  problemasDeLinea,
  problemasDelGuion,
  SALAS_CON_MAQUINA,
  SALAS_GUION,
  type LineaGuion,
} from '../../src/content/esquema-guion';
import { GRABACIONES_ESCONDIDAS } from '../../src/content/grabaciones';
import { GUION, lineaPorId, lineasDe } from '../../src/content/guion';
import { LUGARES } from '../../src/content/esquema-salas';
import { FINALES, SALAS } from '../../src/game/partida';
import { archivoAudio, CSV_POR_DEFECTO, guionACsv } from '../../scripts/guion/csv.ts';

/**
 * T34a · El guion de La Voz como contenido: cada línea con id, texto, sala, momento y duración.
 */

const raiz = path.join(import.meta.dirname, '..', '..');
const leer = (archivo: string): string => readFileSync(path.join(raiz, archivo), 'utf8');

/** Una línea del guion que tiene que existir. */
function linea(id: string): LineaGuion {
  const l = lineaPorId(id);
  if (!l) throw new Error(`no existe ${id}`);
  return l;
}

const base: LineaGuion = {
  id: 'voz-prueba',
  sala: 's1-cooperativa',
  momento: 'entrar_sala',
  texto: 'Una línea corta de prueba.',
  duracion_s: 2.5,
  origen: 'propuesta',
};

describe('guion.json', () => {
  it('cada línea cumple el esquema y sus reglas', () => {
    for (const linea of datos) {
      const r = esquemaLineaGuionValidada.safeParse(linea);
      expect(r.success, `${linea.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it('el guion completo no tiene problemas', () => {
    expect(problemasDelGuion(esquemaLineaGuion.array().parse(datos))).toEqual([]);
  });

  it('tiene la portería, la entrada y el sello de cada sala, las grabaciones y los finales', () => {
    // 23 de la partida y 6 de las puertas falsas del pasillo (docs/pasillos.md; la historia
    // del caso de Don Efraín agregó el 10-B y el 11-A), más las 4 de la escena de la intro.
    expect(GUION).toHaveLength(33);
    expect(lineasDe('escena_intro', 'porteria')).toHaveLength(4);
    expect(lineasDe('puerta_falsa', 'porteria')).toHaveLength(6);
    for (const sala of SALAS) {
      expect(lineasDe('entrar_sala', sala).map((l) => l.id)).toContain(
        `voz-s${SALAS.indexOf(sala) + 1}-entrar`,
      );
    }
    expect(
      lineasDe('final')
        .map((l) => l.final)
        .sort(),
    ).toEqual([...FINALES_GUION].sort());
  });

  it('las líneas del diseño están escritas tal cual en docs/salas-y-puzzles.md', () => {
    const diseno = leer('docs/salas-y-puzzles.md');
    // Desde la historia B, el diseño trae también las líneas del caso de Don Efraín.
    const delDiseno = GUION.filter(
      (l) =>
        (l.origen === 'salas-y-puzzles' || l.origen === 'historia') &&
        l.momento !== 'escena_intro',
    );
    expect(delDiseno).toHaveLength(27);
    for (const l of delDiseno) expect(diseno, l.id).toContain(`«${l.texto}»`);
  });

  it('las líneas de la escena de la intro son las del guion de docs/escenas.md', () => {
    const escenas = leer('docs/escenas.md');
    for (const l of lineasDe('escena_intro', 'porteria')) {
      expect(escenas, l.id).toContain(`«${l.texto}»`);
    }
  });

  it('las grabaciones dicen lo mismo que el cuaderno', () => {
    for (const g of GRABACIONES_ESCONDIDAS) {
      expect(lineaPorId(g.id)).toMatchObject({
        sala: g.sala,
        momento: 'grabacion',
        texto: g.texto,
      });
    }
  });

  it('usa las mismas salas y finales que el juego', () => {
    expect([...SALAS_GUION.slice(0, -1)]).toEqual([...LUGARES]);
    expect([...SALAS_CON_MAQUINA]).toEqual([...SALAS]);
    expect([...FINALES_GUION].sort()).toEqual([...FINALES].sort());
  });

  it('no nombra el ICFES ni el Saber 11', () => {
    for (const l of GUION) expect(l.texto).not.toMatch(/icfes|saber\s*11/i);
  });
});

describe('reglas de una línea', () => {
  it('acepta una línea bien hecha', () => {
    expect(problemasDeLinea(base)).toEqual([]);
  });

  it('rechaza una línea de más de 6 segundos o de muchas palabras', () => {
    const larga =
      'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete';
    const p = problemasDeLinea({ ...base, texto: larga, duracion_s: 7 });
    expect(p.some((m) => m.includes('palabras'))).toBe(true);
    expect(p.some((m) => m.includes('el máximo es 6 s'))).toBe(true);
  });

  it('avisa si la duración no cuadra con el texto', () => {
    expect(problemasDeLinea({ ...base, duracion_s: 6 })[0]).toContain('actualiza duracion_s');
  });

  it('ata cada grabación a su sala y cada momento a su lugar', () => {
    const grab = {
      ...base,
      id: 'grab-2',
      momento: 'grabacion' as const,
      sala: 's2-laboratorio' as const,
    };
    expect(problemasDeLinea(grab)[0]).toContain('s3-gimnasio');
    expect(problemasDeLinea({ ...base, momento: 'grabacion' })[0]).toContain('grab-1 a grab-3');
    expect(problemasDeLinea({ ...base, momento: 'puerta_cerrada' })[0]).toContain('portería');
    expect(problemasDeLinea({ ...base, sala: 'porteria' })[0]).toContain('cinco salas');
    expect(problemasDeLinea({ ...base, momento: 'fallo' })[0]).toContain('cualquier sala');
    expect(problemasDeLinea({ ...base, sala: 'porteria', momento: 'final' })[0]).toContain(
      '«final»',
    );
  });

  it('detecta ids repetidos y momentos que faltan', () => {
    const p = problemasDelGuion([base, base]);
    expect(p).toContain('el id «voz-prueba» está repetido');
    expect(p).toContain('falta la línea del sello de s1-cooperativa');
    expect(p).toContain('falta la grabación «grab-3»');
    expect(p).toContain('falta la línea del final «el_legado»');
  });

  it('el esquema rechaza ids, salas y duraciones raras', () => {
    expect(esquemaLineaGuion.safeParse({ ...base, id: 'Voz 1' }).success).toBe(false);
    expect(esquemaLineaGuion.safeParse({ ...base, id: 'grab-4' }).success).toBe(false);
    expect(esquemaLineaGuion.safeParse({ ...base, sala: 's6-azotea' }).success).toBe(false);
    expect(esquemaLineaGuion.safeParse({ ...base, duracion_s: 2.3 }).success).toBe(false);
    expect(esquemaLineaGuion.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
});

describe('duración estimada', () => {
  it('cuenta palabras sin contar la puntuación suelta', () => {
    expect(contarPalabras('A las 00:40 algo se borra. Tú decides — si te importa.')).toBe(11);
  });

  it('redondea hacia arriba a medio segundo', () => {
    // 14 palabras / 2,8 = 5 s, más medio de aire.
    expect(
      duracionEstimada('Un ángulo y una distancia. Con eso se mide lo que no se alcanza.'),
    ).toBe(5.5);
    expect(duracionEstimada('Hola.')).toBe(1);
  });
});

describe('lineaPorId y lineasDe', () => {
  it('encuentra una línea por id y no inventa ninguna', () => {
    expect(lineaPorId('voz-intro-1')?.momento).toBe('puerta_cerrada');
    expect(lineaPorId('<script>')).toBeNull();
  });

  it('las líneas de espera y fallo valen en cualquier sala', () => {
    expect(lineasDe('fallo', 's3-gimnasio').map((l) => l.id)).toEqual(['voz-fallo']);
    expect(lineasDe('sello', 's3-gimnasio').map((l) => l.id)).toEqual(['voz-s3-sello']);
  });
});

describe('exportar-guion', () => {
  it('el CSV de docs/ está al día con guion.json', () => {
    const enDisco = leer(CSV_POR_DEFECTO).replace(/\r\n/g, '\n');
    expect(enDisco).toBe(guionACsv(GUION));
  });

  it('pone todo entre comillas y dobla las comillas internas', () => {
    const csv = guionACsv([{ ...base, texto: 'Dijo "hola", y se fue.' }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [cabecera, fila] = csv.slice(1).trim().split('\n');
    expect(cabecera).toBe(
      'id,quien,sala,momento,final,texto,palabras,duracion_s,origen,archivo_audio',
    );
    expect(fila).toContain('"Dijo ""hola"", y se fue."');
    expect(fila).toContain('"2,5"');
  });

  it('el audio de cada línea queda en la carpeta de su sala', () => {
    expect(archivoAudio(linea('voz-s2-sello'))).toBe(
      'public/assets/audio/es-CO/s2-laboratorio/voz-s2-sello.m4a',
    );
    expect(archivoAudio(linea('voz-espera'))).toBe(
      'public/assets/audio/es-CO/comun/voz-espera.m4a',
    );
  });
});
