import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BALONES,
  esObjetoSuelto,
  GRABACIONES_ESCONDIDAS,
  grabacionDeObjeto,
  grabacionDeSala,
  grabacionPorId,
  OBJETO_LINTERNA,
} from '../../src/content/grabaciones';
import { SALAS_3D } from '../../src/content/salas';
import { PUZZLES } from '../../src/content/puzzles';
import { cargar, guardar, VERSION_GUARDADO, type Almacen } from '../../src/game/guardado';
import {
  crearPartida,
  GRABACION_EN_SALA,
  GRABACIONES,
  SALAS,
  type GrabacionId,
  type SalaId,
} from '../../src/game/partida';
import { iniciarControlador } from '../../src/signals/controlador';
import { reiniciarCuaderno } from '../../src/signals/cuaderno';
import { enfocado, panel, reiniciarInterfaz } from '../../src/signals/interfaz';
import { reiniciarMecanismo } from '../../src/signals/mecanismo';
import { grabaciones, opcionesFinal, reiniciarPartida, sala } from '../../src/signals/partida';
import { enviar } from '../../src/signals/puente';
import { textoAvance, tituloGrabacion } from '../../src/ui/grabaciones/textos';

// T75: las tres grabaciones escondidas en las salas 2, 3 y 4.

const objeto = (id: string) => SALAS_3D.flatMap((s) => s.objetos).find((o) => o.id === id);

describe('contenido de las grabaciones', () => {
  it('hay una por cada grabación de las reglas, en su sala', () => {
    expect(GRABACIONES_ESCONDIDAS.map((g) => g.id)).toEqual([...GRABACIONES]);
    for (const g of GRABACIONES_ESCONDIDAS) {
      expect(g.sala, g.id).toBe(GRABACION_EN_SALA[g.id]);
      expect(grabacionDeSala(g.sala)).toBe(g);
      expect(grabacionPorId(g.id)).toBe(g);
    }
    expect(GRABACIONES_ESCONDIDAS.map((g) => g.numero)).toEqual([1, 2, 3]);
    expect(grabacionDeSala('porteria')).toBeNull();
    expect(grabacionPorId('grab-9')).toBeNull();
  });

  it('cada escondite es un objeto de su sala que se puede usar', () => {
    for (const g of GRABACIONES_ESCONDIDAS) {
      const dueña = SALAS_3D.find((s) => s.objetos.some((o) => o.id === g.objeto));
      expect(dueña?.id, g.objeto).toBe(g.sala);
      expect(objeto(g.objeto)?.accion, g.objeto).toBe('usar');
      expect(grabacionDeObjeto(g.objeto)).toBe(g);
    }
    expect(grabacionDeObjeto('s2-palanca')).toBeNull();
  });

  it('las transcripciones son las del documento de diseño', () => {
    const diseno = readFileSync('docs/salas-y-puzzles.md', 'utf8');
    for (const g of GRABACIONES_ESCONDIDAS) {
      expect(diseno, g.id).toContain(`«${g.texto}»`);
      // Menos de 20 segundos: unas 25 palabras como mucho.
      expect(g.texto.split(/\s+/).length, g.id).toBeLessThanOrEqual(25);
    }
  });

  it('el carro tiene cuatro balones con nombres distintos y solo uno esconde una grabación', () => {
    expect(BALONES).toHaveLength(4);
    const nombres = BALONES.map((id) => objeto(id)?.nombre);
    expect(new Set(nombres).size).toBe(4);
    for (const id of BALONES) {
      expect(objeto(id)?.forma, id).toBe('esfera');
      expect(objeto(id)?.accion, id).toBe('usar');
      expect(esObjetoSuelto(id), id).toBe(true);
    }
    expect(BALONES.filter((id) => grabacionDeObjeto(id) !== null)).toEqual(['s3-balon-3']);
    // El nombre no delata cuál es.
    expect(objeto('s3-balon-3')?.nombre).not.toMatch(/desinfl|grabaci/i);
  });

  it('los objetos de las máquinas no son objetos sueltos', () => {
    for (const id of ['s1-etiquetadora', 's2-panel', 's2-palanca', 's3-polea', 's4-carritos']) {
      expect(objeto(id), id).toBeDefined();
      expect(esObjetoSuelto(id), id).toBe(false);
    }
    expect(esObjetoSuelto('s2-gabinete')).toBe(true);
    expect(esObjetoSuelto('s4-libro-m')).toBe(true);
  });

  it('la linterna existe en la portería y se recoge', () => {
    expect(objeto(OBJETO_LINTERNA)?.accion).toBe('recoger');
  });

  it('el estante M y el carro ya no abren ninguna máquina: se usa lo que tienen', () => {
    expect(objeto('s4-estante-m')?.accion).toBeUndefined();
    expect(objeto('s3-carro-balones')?.accion).toBeUndefined();
  });
});

describe('textos de las grabaciones', () => {
  it('numera cada grabación y dice cuántas faltan', () => {
    expect(tituloGrabacion(2)).toBe('Grabación 2 de 3');
    expect(textoAvance(1)).toBe('Llevas 1 de 3 grabaciones. Faltan 2, en otras salas.');
    expect(textoAvance(2)).toBe('Llevas 2 de 3 grabaciones. Falta una, en otras salas.');
    expect(textoAvance(3)).toContain('Ya tienes las tres grabaciones');
  });
});

describe('controlador: recoger las grabaciones', () => {
  let detener: (() => void) | undefined;

  /** Empieza la partida dentro de `lugar`, con las salas anteriores resueltas. */
  function continuarEn(lugar: SalaId, tenidas: GrabacionId[] = []): Almacen {
    const datos = new Map<string, string>();
    const almacen: Almacen = {
      getItem: (k) => datos.get(k) ?? null,
      setItem: (k, v) => void datos.set(k, v),
      removeItem: (k) => void datos.delete(k),
    };
    const base = crearPartida();
    const numero = SALAS.indexOf(lugar);
    guardar(almacen, {
      v: VERSION_GUARDADO,
      partida: {
        ...base,
        lugar,
        etapas: Object.fromEntries(SALAS.map((s, i) => [s, i < numero ? 3 : 0])) as Record<
          SalaId,
          number
        >,
        grabaciones: tenidas,
      },
      restanteMs: 20 * 60 * 1000,
      pistas: {},
      mecanismos: {},
      resueltas: {},
      notas: [],
      datos: [],
      inventario: [],
    });
    detener = iniciarControlador({ documento: null, almacen });
    enviar({ t: 'continuar' });
    expect(sala.value).toBe(lugar);
    return almacen;
  }

  function usar(id: string): void {
    enfocado.value = { id, nombre: objeto(id)?.nombre ?? id, accion: 'usar' };
    enviar({ t: 'accion', objeto: id, accion: 'usar' });
  }

  afterEach(() => {
    detener?.();
    detener = undefined;
    reiniciarPartida();
    reiniciarInterfaz();
    reiniciarCuaderno();
    reiniciarMecanismo();
  });

  it('usar el gabinete del laboratorio entrega la grabación 1 y la muestra', () => {
    continuarEn('s2-laboratorio');
    expect(grabaciones.value).toEqual([]);
    usar('s2-gabinete');
    expect(grabaciones.value).toEqual(['grab-1']);
    expect(panel.value).toBe('grabacion');
    // El gabinete sigue enfocado: al cerrar el panel se puede volver a él.
    expect(enfocado.value?.id).toBe('s2-gabinete');
  });

  it('usarlo otra vez la muestra de nuevo sin repetirla', () => {
    continuarEn('s2-laboratorio');
    usar('s2-gabinete');
    panel.value = null;
    usar('s2-gabinete');
    expect(grabaciones.value).toEqual(['grab-1']);
    expect(panel.value).toBe('grabacion');
  });

  it('en el gimnasio, solo el balón que no rebota entrega la grabación 2', () => {
    continuarEn('s3-gimnasio');
    for (const balon of ['s3-balon-1', 's3-balon-2', 's3-balon-4']) {
      usar(balon);
      expect(grabaciones.value, balon).toEqual([]);
      // Un balón que rebota no abre ningún panel, tampoco el de la máquina.
      expect(panel.value, balon).toBeNull();
      expect(enfocado.value?.id).toBe(balon);
    }
    usar('s3-balon-3');
    expect(grabaciones.value).toEqual(['grab-2']);
    expect(panel.value).toBe('grabacion');
  });

  it('el libro del estante M entrega la grabación 3', () => {
    continuarEn('s4-biblioteca', ['grab-1', 'grab-2']);
    usar('s4-libro-m');
    expect(grabaciones.value).toEqual(['grab-1', 'grab-2', 'grab-3']);
    expect(panel.value).toBe('grabacion');
    // Con las tres ya no falta ninguna para «Restaurar archivo».
    expect(opcionesFinal.value.faltanGrabaciones).toBe(0);
  });

  it('los objetos de la máquina siguen abriendo su panel', () => {
    continuarEn('s2-laboratorio');
    usar('s2-panel');
    expect(panel.value).toBe('mecanismo');
    expect(grabaciones.value).toEqual([]);
  });

  it('las grabaciones recogidas quedan en la partida guardada', () => {
    const almacen = continuarEn('s2-laboratorio');
    usar('s2-gabinete');
    expect(cargar(almacen, PUZZLES)?.partida.grabaciones).toEqual(['grab-1']);
  });
});
