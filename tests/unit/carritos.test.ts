import { afterEach, describe, expect, it } from 'vitest';
import type { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import type { EstadoDe, PuzzleDe } from '../../src/content/esquema';
import { PUZZLES } from '../../src/content/puzzles';
import { salaPorId } from '../../src/content/salas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import { GROSOR_LIBRO, LAMPARAS as LAMPARAS_3D } from '../../src/engine/mecanismos/carritos';
import { construirSala } from '../../src/engine/salas/construir';
import {
  esEstadoCarritos,
  evaluar,
  librosEn,
  librosEnPila,
  moverLibro,
  vaciarCarritos,
} from '../../src/game/puzzles';
import { condiciones, etapa, mecanismo, reiniciarMecanismo } from '../../src/signals/mecanismo';
import { reiniciarPartida, sellos } from '../../src/signals/partida';
import {
  dia,
  diaCorto,
  etiquetaLugar,
  LAMPARAS,
  libros,
  nombreLugar,
  numero,
  textoInstruccion,
  textoMovimiento,
} from '../../src/ui/mecanismos/carritos/textos';

/**
 * T64 · Sala 4, los carritos: mover libros de a uno (reglas), lo que dice el panel (textos) y
 * lo que se ve en la biblioteca (animación).
 */

const puzzle = PUZZLES.find((p) => p.mecanismo === 'carritos') as PuzzleDe<'carritos'>;
type Estado = EstadoDe<'carritos'>;
const datos = (n: number) => {
  const e = puzzle.etapas[n];
  if (!e) throw new Error(`falta la etapa ${n}`);
  return e;
};
const con = (...carritos: number[]): Estado => ({ carritos });

describe('carritos: mover libros de a uno (T64)', () => {
  const e = datos(0);

  it('de la pila a un carrito, de un carrito a otro y de vuelta a la pila', () => {
    const vacio = con(0, 0, 0, 0, 0);
    expect(librosEnPila(e, vacio)).toBe(20);
    const uno = moverLibro(e, vacio, 'pila', 0);
    expect(uno).toEqual(con(1, 0, 0, 0, 0));
    const otro = uno && moverLibro(e, uno, 0, 4);
    expect(otro).toEqual(con(0, 0, 0, 0, 1));
    expect(otro && moverLibro(e, otro, 4, 'pila')).toEqual(vacio);
    // El estado que se recibe no se toca.
    expect(vacio).toEqual(con(0, 0, 0, 0, 0));
  });

  it('pasar un libro de un día a otro no cambia el total: la media sigue encendida', () => {
    const parejo = con(4, 4, 4, 4, 4);
    expect(evaluar(puzzle, 0, parejo)?.condiciones).toEqual({ media: true });
    const movido = moverLibro(e, parejo, 0, 4);
    expect(movido).toEqual(con(3, 4, 4, 4, 5));
    expect(movido && librosEnPila(e, movido)).toBe(0);
    expect(evaluar(puzzle, 0, movido)?.condiciones).toEqual({ media: true });
  });

  it('no se puede sacar de un lugar vacío, ni mover al mismo lugar, ni a un carrito que no existe', () => {
    const estado = con(20, 0, 0, 0, 0);
    expect(moverLibro(e, estado, 'pila', 1)).toBeNull();
    expect(moverLibro(e, estado, 1, 2)).toBeNull();
    expect(moverLibro(e, estado, 0, 0)).toBeNull();
    expect(moverLibro(e, estado, 'pila', 'pila')).toBeNull();
    expect(moverLibro(e, estado, 0, 5)).toBeNull();
    expect(moverLibro(e, estado, -1, 0)).toBeNull();
    expect(moverLibro(e, estado, 0.5, 1)).toBeNull();
    expect(librosEn(e, estado, 7)).toBe(0);
    expect(librosEn(e, estado, 0)).toBe(20);
  });

  it('todo movimiento posible deja un estado válido para la etapa', () => {
    const lugares = ['pila', 0, 1, 2, 3, 4] as const;
    let estado = con(0, 0, 0, 0, 0);
    // Un recorrido fijo, sin azar: reparte, mueve entre carritos y devuelve.
    for (let paso = 0; paso < 200; paso++) {
      const de = lugares[(paso * 7) % lugares.length] ?? 'pila';
      const a = lugares[(paso * 5 + 1) % lugares.length] ?? 'pila';
      const nuevo = moverLibro(e, estado, de, a);
      if (!nuevo) continue;
      expect(esEstadoCarritos(e, nuevo)).toBe(true);
      expect(nuevo.carritos.reduce((s, x) => s + x, 0) + librosEnPila(e, nuevo)).toBe(20);
      estado = nuevo;
    }
  });

  it('devolver todo deja los 20 libros en la pila', () => {
    const vacio = vaciarCarritos(con(2, 2, 3, 4, 9));
    expect(vacio).toEqual(con(0, 0, 0, 0, 0));
    expect(librosEnPila(e, vacio)).toBe(20);
  });

  it('las tres soluciones de ejemplo se arman moviendo libros de a uno', () => {
    for (const [n, etapaN] of puzzle.etapas.entries()) {
      let estado = structuredClone(etapaN.estado_inicial) as Estado;
      const meta = etapaN.solucion.carritos;
      let movimientos = 0;
      // Primero se devuelve lo que sobra en cada carrito y luego se reparte lo que falta.
      meta.forEach((quiere, i) => {
        while ((estado.carritos[i] ?? 0) > quiere) {
          estado = moverLibro(etapaN, estado, i, 'pila') ?? estado;
          movimientos++;
        }
      });
      meta.forEach((quiere, i) => {
        while ((estado.carritos[i] ?? 0) < quiere) {
          estado = moverLibro(etapaN, estado, 'pila', i) ?? estado;
          movimientos++;
        }
      });
      expect(estado.carritos, `etapa ${n}`).toEqual(meta);
      expect(evaluar(puzzle, n, estado)?.resuelta, `etapa ${n}`).toBe(true);
      expect(movimientos).toBeLessThanOrEqual(2 * etapaN.controles.libros);
    }
  });
});

describe('carritos: textos del panel (T64)', () => {
  it('los días y las cantidades se dicen en español', () => {
    expect([0, 1, 2, 3, 4].map(dia)).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes']);
    expect([0, 1, 2, 3, 4].map(diaCorto)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);
    expect(dia(9)).toBe('día 10');
    expect(libros(0)).toBe('ningún libro');
    expect(libros(1)).toBe('1 libro');
    expect(libros(11)).toBe('11 libros');
    expect(nombreLugar('pila')).toBe('la pila');
    expect(nombreLugar(2)).toBe('el carrito del miércoles');
    expect(numero(3.5)).toBe('3,5');
    expect(numero(4)).toBe('4');
  });

  it('la instrucción dice qué hará el siguiente toque', () => {
    expect(textoInstruccion(null, true)).toBe(
      'Toca de dónde quieres sacar un libro: la pila o un carrito.',
    );
    expect(textoInstruccion('pila', true)).toBe(
      'Estás sacando libros de la pila. Toca un carrito para dejar uno.',
    );
    expect(textoInstruccion(4, true)).toBe(
      'Estás sacando libros del carrito del viernes. Toca otro carrito o la pila para dejar uno.',
    );
    expect(textoMovimiento('pila', 0)).toBe('Pasaste un libro de la pila al carrito del lunes.');
    expect(textoMovimiento(0, 4)).toBe(
      'Pasaste un libro del carrito del lunes al carrito del viernes.',
    );
    expect(textoMovimiento(3, 'pila')).toBe('Pasaste un libro del carrito del jueves a la pila.');
  });

  it('cada botón dice cuántos libros tiene y qué pasa al tocarlo', () => {
    expect(etiquetaLugar('pila', 20, null)).toBe('Pila: 20 libros. Sacar libros de aquí.');
    expect(etiquetaLugar(0, 0, null)).toBe('Carrito del lunes: ningún libro.');
    expect(etiquetaLugar('pila', 12, 'pila')).toBe(
      'Pila: 12 libros. Dejar de sacar libros de aquí.',
    );
    expect(etiquetaLugar(1, 3, 'pila')).toBe(
      'Carrito del martes: 3 libros. Dejar aquí un libro de la pila.',
    );
    expect(etiquetaLugar('pila', 0, 2)).toBe(
      'Pila: ningún libro. Dejar aquí un libro del carrito del miércoles.',
    );
  });

  it('las lámparas van en el orden de la pared y con los rótulos del diseño', () => {
    expect(LAMPARAS.map((l) => l.rotulo)).toEqual(['MEDIA', 'MEDIANA', 'MODA', 'RANGO']);
    expect(LAMPARAS.map((l) => l.id)).toEqual([...LAMPARAS_3D]);
    expect(Object.keys(datos(2).exito.lamparas).sort()).toEqual(
      LAMPARAS.map((l) => l.id as string).sort(),
    );
  });

  it('ningún texto explica qué mira una lámpara ni califica el reparto', () => {
    const textos = [
      textoInstruccion(null, true),
      textoInstruccion(null, false),
      textoInstruccion('pila', true),
      textoInstruccion(2, true),
      textoMovimiento('pila', 1),
      textoMovimiento(1, 2),
      etiquetaLugar(0, 4, null),
      etiquetaLugar(0, 4, 0),
      etiquetaLugar(0, 4, 'pila'),
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/incorrect|error|\bmal\b|promedio|del medio|se repite|suma|divid/i);
    }
  });
});

describe('carritos: animación en la biblioteca (T64)', () => {
  afterEach(() => {
    reiniciarMecanismo();
    reiniciarPartida();
  });

  function contarMallas(raiz: Object3D): number {
    let n = 0;
    raiz.traverse((o) => {
      if ((o as Mesh).isMesh) n++;
    });
    return n;
  }

  function montar() {
    const sala = construirSala(salaPorId('s4-biblioteca'));
    const antes = contarMallas(sala.raiz);
    const animacion = animacionDeSala('s4-biblioteca', sala.raiz);
    if (!animacion) throw new Error('la biblioteca no tiene animación');
    const asentar = (): void => {
      for (let i = 0; i < 240; i++) animacion.actualizar(1 / 30);
    };
    const grupo = sala.raiz.getObjectByName('s4-carritos');
    const pila = sala.raiz.getObjectByName('s4-pila-libros');
    const pared = sala.raiz.getObjectByName('s4-lamparas');
    if (!grupo || !pila || !pared) throw new Error('faltan piezas de la biblioteca');
    // Los cinco carritos son las primeras piezas del grupo; los montones se agregan después.
    const montones = grupo.children.slice(5) as Mesh[];
    const lamparas = pared.children as Mesh<BufferGeometry, MeshBasicMaterial>[];
    const colores = (): number[] => lamparas.map((l) => l.material.color.getHex());
    return { sala, animacion, asentar, pila, montones, colores, antes };
  }

  function poner(n: number, estado: Estado): void {
    etapa.value = { sala: 's4-biblioteca', puzzle: puzzle.id, etapa: n };
    mecanismo.value = estado;
    condiciones.value = evaluar(puzzle, n, estado)?.condiciones ?? {};
  }

  it('la sala no pasa de 40 mallas con las nueve de la animación', () => {
    const { sala, antes, montones } = montar();
    expect(montones).toHaveLength(5);
    expect(contarMallas(sala.raiz) - antes).toBe(9);
    expect(contarMallas(sala.raiz)).toBeLessThanOrEqual(40);
  });

  it('cada carrito muestra un montón tan alto como sus libros, y la pila baja', () => {
    const { asentar, montones, pila, animacion } = montar();
    poner(1, con(1, 2, 3, 3, 11));
    asentar();
    expect(montones.map((m) => Math.round(m.scale.y / GROSOR_LIBRO))).toEqual([1, 2, 3, 3, 11]);
    expect(montones.every((m) => m.visible)).toBe(true);
    // Sin libros en la pila queda solo su base.
    expect(pila.scale.y).toBeCloseTo(0.08, 2);
    expect(animacion.estado).toBe('lamparas-2');

    poner(0, con(0, 0, 0, 0, 0));
    asentar();
    expect(montones.some((m) => m.visible)).toBe(false);
    expect(pila.scale.y).toBeCloseTo(1, 2);
    expect(animacion.estado).toBe('lamparas-0');
  });

  it('las lámparas: apagada si está tapada, tenue si cuenta y verde si se cumple', () => {
    const { asentar, colores } = montar();
    // Etapa 2 (torcer): cuentan MEDIA y MEDIANA. Con 4, 4, 4, 4, 4 solo se cumple la media.
    poner(1, con(4, 4, 4, 4, 4));
    asentar();
    const [media, mediana, moda, rango] = colores();
    expect(media).not.toBe(mediana);
    expect(moda).toBe(rango);
    expect(new Set([media, mediana, moda]).size).toBe(3);

    poner(2, con(2, 2, 3, 4, 9));
    asentar();
    expect(new Set(colores())).toEqual(new Set([media]));
  });

  it('con el sello, los carritos quedan como en la solución y las cuatro lámparas en verde', () => {
    const { asentar, montones, colores, animacion } = montar();
    sellos.value = ['s4-biblioteca'];
    reiniciarMecanismo();
    asentar();
    expect(montones.map((m) => Math.round(m.scale.y / GROSOR_LIBRO))).toEqual(
      datos(2).solucion.carritos,
    );
    expect(new Set(colores()).size).toBe(1);
    expect(animacion.estado).toBe('lamparas-4');
  });

  it('al liberarse deja de seguir los signals, y sus mallas no reciben toques', () => {
    const { animacion, asentar, montones } = montar();
    poner(0, con(4, 4, 4, 4, 4));
    asentar();
    const alto = montones[0]?.scale.y;
    animacion.liberar();
    poner(0, con(0, 4, 4, 4, 4));
    asentar();
    expect(montones[0]?.scale.y).toBe(alto);
    for (const m of montones) expect(m.raycast.toString()).not.toContain('intersect');
  });
});
