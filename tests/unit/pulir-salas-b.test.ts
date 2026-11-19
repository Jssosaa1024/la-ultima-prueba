import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Raycaster, Vector3 } from 'three';
import type { Mesh, MeshLambertMaterial, Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { animacionDeSala } from '../../src/engine/mecanismos';
import {
  CARCASA_FOCOS,
  LIBROS_MAXIMOS,
  carrito,
  carritoConLibros,
  librosVisibles,
  mostrarLibros,
  pulirBiblioteca,
} from '../../src/engine/mecanismos/biblioteca-piezas';
import { Piezas } from '../../src/engine/mecanismos/piezas-por-codigo';
import {
  MANIJA_JALADA,
  MANIJA_REPOSO,
  URNA_BASE,
  pulirRectoria,
} from '../../src/engine/mecanismos/rectoria-piezas';
import {
  alturaDeLaMano,
  anguloManija,
  DURACION_MANO,
  posicionDeFicha,
} from '../../src/engine/mecanismos/urna';
import { construirSala } from '../../src/engine/salas/construir';
import { interactivoDe } from '../../src/engine/interaccion/interaccion';
import { reiniciarMecanismo } from '../../src/signals/mecanismo';
import { reiniciarPartida } from '../../src/signals/partida';
import { carasAlReves, normalesSanas } from './geometria-sana';

// Pulir salas (sesión B): la biblioteca y la rectoría ganan detalle por código sin draw calls nuevas, sin
// cambiar ids ni choques, y dentro del presupuesto de AGENTS.md.

const MAX_TRIANGULOS_SALA = 90_000;
const MAX_TRIANGULOS_INTERACTIVO = 6_000;
/** Triángulos de los GLB de la biblioteca (docs/arte-cc0.md, T19n). */
const TRIANGULOS_GLB_BIBLIOTECA = 17_748;
/** Triángulos de los GLB de la rectoría (docs/arte-cc0.md, T19o). */
const TRIANGULOS_GLB_RECTORIA = 3_832;

afterEach(() => {
  reiniciarMecanismo();
  reiniciarPartida();
});

function mallas(raiz: Object3D): Mesh[] {
  const lista: Mesh[] = [];
  raiz.traverse((o) => {
    if ((o as Mesh).isMesh) lista.push(o as Mesh);
  });
  return lista;
}

/** Triángulos que dibuja una malla (con su rango de dibujo). */
const triangulos = (m: Mesh): number =>
  Math.min(
    m.geometry.index?.count ?? m.geometry.getAttribute('position').count,
    m.geometry.drawRange.count,
  ) / 3;
const total = (raiz: Object3D): number => mallas(raiz).reduce((s, m) => s + triangulos(m), 0);
/** Mallas que se dibujan: sin las cajas invisibles de las piezas que se tocan. */
const dibujadas = (raiz: Object3D): number =>
  mallas(raiz).filter((m) => (m.material as MeshLambertMaterial).visible !== false).length;

/** Medidas de una malla en su propio espacio (sin su posición ni su giro). */
function caja(o: Object3D | undefined): Box3 {
  const g = (o as Mesh).geometry;
  g.computeBoundingBox();
  return g.boundingBox ?? new Box3();
}

const interactivos = (raiz: Object3D): Map<string, unknown> => {
  const m = new Map<string, unknown>();
  raiz.traverse((o) => {
    if (o.userData['interactivo']) m.set(o.name, o.userData['interactivo']);
  });
  return m;
};

describe('biblioteca pulida', () => {
  const armar = () => construirSala(salaPorId('s4-biblioteca'));

  it('suma solo la carcasa de los focos y pulirla otra vez no repite nada', () => {
    const sala = armar();
    const antes = mallas(sala.raiz).length;
    pulirBiblioteca(sala.raiz);
    expect(mallas(sala.raiz)).toHaveLength(antes + 1);
    expect(sala.raiz.getObjectByName('s4-lamparas')?.getObjectByName(CARCASA_FOCOS)).toBeDefined();
    const tris = total(sala.raiz);
    // Pulirla otra vez (la sala vuelve de la caché) no repite nada.
    pulirBiblioteca(sala.raiz);
    expect(mallas(sala.raiz)).toHaveLength(antes + 1);
    expect(total(sala.raiz)).toBe(tris);
  });

  it('con la animación, la sala dibuja menos mallas que antes del pulido', () => {
    const sala = armar();
    const animacion = animacionDeSala('s4-biblioteca', sala.raiz);
    const dibujadas = mallas(sala.raiz).filter(
      (m) => (m.material as MeshLambertMaterial).visible !== false,
    );
    // Antes del pulido eran 34 (los cinco montones eran mallas aparte).
    expect(dibujadas.length).toBeLessThanOrEqual(30);
    animacion?.liberar();
  });

  it('con 20 libros repartidos como sea, la sala y los carritos caben en el presupuesto', () => {
    const sala = armar();
    const animacion = animacionDeSala('s4-biblioteca', sala.raiz);
    const grupo = sala.raiz.getObjectByName('s4-carritos');
    const carritos = (grupo?.children ?? []) as Mesh[];
    // El peor caso del puzzle: los 20 libros en un mismo carrito y la pila llena.
    carritos.forEach((m, i) => mostrarLibros(m, i === 0 ? LIBROS_MAXIMOS : 0));
    const grupoTris = carritos.reduce((s, m) => s + triangulos(m), 0);
    expect(grupoTris).toBeLessThan(MAX_TRIANGULOS_INTERACTIVO);
    expect(total(sala.raiz) + TRIANGULOS_GLB_BIBLIOTECA).toBeLessThan(MAX_TRIANGULOS_SALA);
    animacion?.liberar();
  });

  it('las caras miran hacia afuera y las normales están sanas', () => {
    const sala = armar();
    animacionDeSala('s4-biblioteca', sala.raiz)?.liberar();
    const revisar = [
      sala.raiz.getObjectByName('s4-pila-libros') as Mesh,
      ...((sala.raiz.getObjectByName('s4-carritos')?.children ?? []) as Mesh[]),
      ...((sala.raiz.getObjectByName('s4-lamparas')?.children ?? []) as Mesh[]),
    ];
    for (const m of revisar) {
      // Las caras de toda la columna, aunque solo se dibuje una parte.
      m.geometry.setDrawRange(0, Infinity);
      expect(m.geometry.index, m.name).toBeNull();
      expect(carasAlReves(m.geometry), m.name).toBe(0);
      expect(normalesSanas(m.geometry), m.name).toBe(true);
    }
  });

  it('lo que se toca sigue con su id, su acción y sus choques, y cabe en su caja', () => {
    const sala = armar();
    const antes = interactivos(sala.raiz);
    const choques = JSON.stringify(sala.cajas);
    animacionDeSala('s4-biblioteca', sala.raiz)?.liberar();
    expect(interactivos(sala.raiz)).toEqual(antes);
    // El juego choca con las cajas que se calculan al armar la sala (motor.ts usa
    // `cargador.actual.cajas`), con las primitivas y antes de pulir: pulir y animar no las cambia.
    expect(JSON.stringify(sala.cajas)).toBe(choques);

    const carritos = sala.raiz.getObjectByName('s4-carritos');
    for (const carro of (carritos?.children ?? []) as Mesh[]) {
      expect((carro.material as MeshLambertMaterial).vertexColors).toBe(true);
    }
    // El carrito (sin su montón, que va encima como antes) cabe en su caja de 0,5 × 0,7 × 0,4 m.
    const solo = new Piezas();
    carrito(solo);
    {
      const b = solo.geometria().boundingBox ?? new Box3();
      expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
      expect(b.max.y).toBeLessThanOrEqual(0.701);
      expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(0.251);
      expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(0.201);
    }
    const pila = sala.raiz.getObjectByName('s4-pila-libros') as Mesh;
    const b = caja(pila);
    expect(b.max.y).toBeLessThanOrEqual(0.601);
    expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(0.2);
    expect(Math.max(-b.min.z, b.max.z)).toBeLessThanOrEqual(0.15);
    expect(triangulos(pila)).toBeLessThan(MAX_TRIANGULOS_INTERACTIVO);
  });

  it('un montón dibuja tantos libros como tiene, y cada libro tiene la misma forma', () => {
    const p = new Piezas();
    const cortes = carritoConLibros(p, 0);
    const geometria = p.geometria();
    expect(cortes).toHaveLength(LIBROS_MAXIMOS + 1);
    const pasos = cortes.slice(1).map((c, i) => c - (cortes[i] ?? 0));
    expect(new Set(pasos).size).toBe(1);
    expect(cortes.at(-1)).toBe(geometria.getAttribute('position').count);
    // Los libros de al lado no son del mismo color.
    const color = geometria.getAttribute('color');
    const tapa = (k: number) => color.getX(cortes[k] ?? 0) + color.getY(cortes[k] ?? 0);
    expect(tapa(0)).not.toBeCloseTo(tapa(1));
  });

  it('la pila vacía deja su tarima, que se sigue tocando', () => {
    const sala = armar();
    pulirBiblioteca(sala.raiz);
    sala.raiz.updateMatrixWorld(true);
    const pila = sala.raiz.getObjectByName('s4-pila-libros') as Mesh;
    const rayo = new Raycaster(new Vector3(-0.6, 2, 1), new Vector3(0, -1, 0));
    const altura = () => rayo.intersectObject(pila, false)[0]?.point.y ?? -1;
    expect(librosVisibles(pila)).toBe(LIBROS_MAXIMOS);
    expect(altura()).toBeGreaterThan(0.55);
    mostrarLibros(pila, 0);
    expect(altura()).toBeGreaterThan(0.03);
    expect(altura()).toBeLessThan(0.08);
  });

  it('tocar la carcasa de un foco es tocar el resumen semanal', () => {
    const sala = armar();
    animacionDeSala('s4-biblioteca', sala.raiz)?.liberar();
    sala.raiz.updateMatrixWorld(true);
    // Desde el centro de la sala hacia el centro de cada foco (x del tablero ± 0,29 y ± 0,88).
    for (const dx of [-0.8775, -0.2925, 0.2925, 0.8775]) {
      const desde = new Vector3(-1.5, 1.6, -1.5);
      const hacia = new Vector3(-1.5 + dx, 1.87, -3.95).sub(desde).normalize();
      const choque = new Raycaster(desde, hacia).intersectObject(sala.raiz, true)[0];
      expect(interactivoDe(choque?.object ?? null)?.name, `foco en ${dx}`).toBe('s4-lamparas');
    }
  });

  it('el resumen semanal es una lámina con los cuatro rótulos de los focos', () => {
    const o = salaPorId('s4-biblioteca').objetos.find((x) => x.id === 's4-lamparas');
    expect(o?.lamina?.tipo).toBe('tablero');
    expect(o?.lamina?.lineas).toEqual(['MEDIA', 'MEDIANA', 'MODA', 'RANGO']);
  });
});

describe('rectoría pulida', () => {
  const armar = () => construirSala(salaPorId('s5-rectoria'));

  /** Triángulos que dibuja un objeto con todos sus hijos. */
  const conHijos = (o: Object3D): number => {
    let n = 0;
    o.traverse((x) => {
      const m = x as Mesh;
      if (m.isMesh && m.visible && (m.material as MeshLambertMaterial).visible !== false) {
        n += triangulos(m);
      }
    });
    return n;
  };

  it('suma solo la base de la urna, la carcasa va en lo fijo y pulirla otra vez no repite nada', () => {
    const sala = armar();
    const antes = mallas(sala.raiz).length;
    const trisFija = triangulos(sala.raiz.getObjectByName('fija') as Mesh);
    pulirRectoria(sala.raiz);
    expect(mallas(sala.raiz)).toHaveLength(antes + 1);
    expect(sala.raiz.getObjectByName('s5-urna')?.getObjectByName(URNA_BASE)).toBeDefined();
    expect(triangulos(sala.raiz.getObjectByName('fija') as Mesh)).toBeGreaterThan(trisFija);
    const tris = total(sala.raiz);
    pulirRectoria(sala.raiz);
    expect(mallas(sala.raiz)).toHaveLength(antes + 1);
    expect(total(sala.raiz)).toBe(tris);
  });

  it('con la animación dibuja menos mallas que antes y cabe en el presupuesto', () => {
    const sala = armar();
    const animacion = animacionDeSala('s5-rectoria', sala.raiz);
    // Antes del pulido eran 35 (con la urna, la mano y la caja fuerte).
    expect(dibujadas(sala.raiz)).toBeLessThanOrEqual(34);
    expect(total(sala.raiz) + TRIANGULOS_GLB_RECTORIA).toBeLessThan(MAX_TRIANGULOS_SALA);
    // Cada objeto que se toca, con sus hijos (puerta y llave, base y manija), bajo 6.000.
    sala.raiz.traverse((o) => {
      if (o.userData['interactivo']) {
        expect(conHijos(o), o.name).toBeLessThan(MAX_TRIANGULOS_INTERACTIVO);
      }
    });
    animacion?.liberar();
  });

  it('las caras miran hacia afuera y las normales están sanas', () => {
    const sala = armar();
    const animacion = animacionDeSala('s5-rectoria', sala.raiz);
    const revisar = [
      'fija',
      's5-urna',
      URNA_BASE,
      's5-caja-fuerte',
      'caja-fuerte-puerta',
      'caja-fuerte-llave',
      'urna-manija',
      'fichas-azules',
      'fichas-amarillas',
    ].map((n) => sala.raiz.getObjectByName(n) as Mesh);
    const mano = sala.raiz.getObjectByName('mano-mecanica');
    revisar.push(...((mano?.children.slice(0, 2) ?? []) as Mesh[]));
    for (const m of revisar) {
      expect(m, 'falta una malla').toBeDefined();
      expect(carasAlReves(m.geometry), m.name).toBe(0);
      expect(normalesSanas(m.geometry), m.name).toBe(true);
    }
    animacion?.liberar();
  });

  it('lo que se toca sigue con su id y su acción, y la urna y la caja caben en su caja', () => {
    const sala = armar();
    const antes = interactivos(sala.raiz);
    const choques = JSON.stringify(sala.cajas);
    animacionDeSala('s5-rectoria', sala.raiz)?.liberar();
    expect(interactivos(sala.raiz)).toEqual(antes);
    expect(JSON.stringify(sala.cajas)).toBe(choques);
    const urna = sala.raiz.getObjectByName('s5-urna') as Mesh;
    const u = caja(urna);
    expect(Math.max(-u.min.x, u.max.x, -u.min.z, u.max.z)).toBeLessThanOrEqual(0.176);
    expect(u.max.y).toBeLessThanOrEqual(0.451);
    const fuerte = sala.raiz.getObjectByName('s5-caja-fuerte') as Mesh;
    const f = caja(fuerte);
    expect(f.max.x).toBeLessThanOrEqual(0.351);
    expect(f.max.y).toBeLessThanOrEqual(0.901);
    expect(f.max.z).toBeLessThanOrEqual(0.301);
    for (const m of [urna, fuerte]) {
      expect((m.material as MeshLambertMaterial).vertexColors).toBe(true);
    }
  });

  it('el pie, el aro, las varillas y la manija de la urna se tocan como la urna', () => {
    const sala = armar();
    const animacion = animacionDeSala('s5-rectoria', sala.raiz);
    sala.raiz.updateMatrixWorld(true);
    // Desde la puerta (donde empiezan las e2e) y desde un lado de la mesa.
    for (const desde of [new Vector3(0, 1.6, 1.9), new Vector3(0.8, 1.5, 0.6)]) {
      for (const punto of [
        [-0.6, 0.98, -0.5], // el centro, que tocan caja-fuerte.spec.ts y partida.spec.ts
        [-0.6, 0.78, -0.31], // el pie
        [-0.6, 1.186, -0.32], // el aro de latón
        [-0.48, 1.0, -0.38], // una varilla
        [-0.372, 0.96, -0.56], // el pomo de la manija (en reposo, inclinada hacia atrás)
      ] as const) {
        const hacia = new Vector3(...punto).sub(desde).normalize();
        const choque = new Raycaster(desde, hacia)
          .intersectObject(sala.raiz, true)
          .find((i) => i.object.visible);
        expect(interactivoDe(choque?.object ?? null)?.name, `${punto.join(', ')}`).toBe('s5-urna');
      }
    }
    animacion?.liberar();
  });

  it('la manija se jala cuando la mano baja y vuelve cuando sube', () => {
    expect(anguloManija(null)).toBe(MANIJA_REPOSO);
    expect(anguloManija(0.3)).toBeCloseTo(MANIJA_JALADA);
    expect(anguloManija(0.75)).toBeGreaterThan(MANIJA_REPOSO);
    expect(anguloManija(DURACION_MANO)).toBe(MANIJA_REPOSO);
  });

  it('la pinza baja hasta justo encima de las fichas y el brazo no sale de su carcasa', () => {
    const sala = armar();
    const animacion = animacionDeSala('s5-rectoria', sala.raiz);
    const grupo = sala.raiz.getObjectByName('urna-animacion');
    const pinza = (sala.raiz.getObjectByName('mano-mecanica')?.children[1] ?? null) as Mesh | null;
    const brazo = (sala.raiz.getObjectByName('mano-mecanica')?.children[0] ?? null) as Mesh | null;
    const yGrupo = grupo?.position.y ?? 0;
    const bajo = alturaDeLaMano(0.5);
    // Lo más bajo de la pinza queda sobre el montón más alto (20 fichas, 5 pisos).
    const tope = posicionDeFicha(19).y + 0.006;
    expect(bajo + caja(pinza ?? undefined).min.y).toBeGreaterThan(tope);
    expect(bajo + caja(pinza ?? undefined).min.y).toBeLessThan(tope + 0.03);
    // La punta del brazo, con la mano abajo, sigue dentro de la carcasa del techo (boca en 2,3).
    expect(yGrupo + bajo + caja(brazo ?? undefined).max.y).toBeGreaterThan(2.35);
    animacion?.liberar();
  });

  it('la carta es una lámina de papel y el parlante, los dispensadores y el botón son piezas', () => {
    const objetos = salaPorId('s5-rectoria').objetos;
    const de = (id: string) => objetos.find((o) => o.id === id);
    expect(de('s5-carta')?.lamina?.tipo).toBe('papel');
    expect(de('s5-dispensadores')?.pieza).toBe('dispensadores');
    expect(de('s5-ver-parejas')?.pieza).toBe('boton-parejas');
    expect(de('s5-parlante')?.pieza).toBe('parlante');
  });
});
