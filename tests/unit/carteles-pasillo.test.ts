import { afterEach, describe, expect, it } from 'vitest';
import type { Mesh, MeshLambertMaterial, Object3D, Texture } from 'three';
import { esquemaSalaValidada } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import {
  animarCartelesDeSalas,
  idCartelDeSala,
} from '../../src/engine/mecanismos/carteles-pasillo';
import { construirSala } from '../../src/engine/salas/construir';
import {
  dibujarLamina,
  marcarLamina,
  marcasDeLamina,
  medidasLienzo,
  SELLOS_DE_SALA,
  texturaLamina,
} from '../../src/engine/salas/laminas';
import type { Lamina } from '../../src/engine/salas/laminas';
import { sellos } from '../../src/signals/partida';

// Pasillos (sesión C): flechas dibujadas y el sello de cada sala en su cartel.

interface Llamada {
  metodo: string;
  args: unknown[];
  font: string;
  fillStyle: unknown;
}

/** Contexto 2D de mentira que anota lo que se dibuja (la letra mide 0,55 de su tamaño). */
function lienzoFalso(): { ctx: CanvasRenderingContext2D; llamadas: Llamada[] } {
  const llamadas: Llamada[] = [];
  const estado: Record<string | symbol, unknown> = { font: '10px sans-serif', fillStyle: '#000' };
  const pila: Record<string | symbol, unknown>[] = [];
  const ctx = new Proxy(estado, {
    get(objetivo, clave) {
      if (clave in objetivo) return objetivo[clave];
      return (...args: unknown[]) => {
        const metodo = String(clave);
        llamadas.push({ metodo, args, font: String(objetivo.font), fillStyle: objetivo.fillStyle });
        if (metodo === 'save') pila.push({ ...objetivo });
        if (metodo === 'restore') Object.assign(objetivo, pila.pop());
        if (metodo === 'measureText') {
          const tam = Number(/(\d+(?:\.\d+)?)px/.exec(String(objetivo.font))?.[1] ?? 10);
          return { width: String(args[0]).length * tam * 0.55 };
        }
        return undefined;
      };
    },
    set(objetivo, clave, valor) {
      objetivo[clave] = valor;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, llamadas };
}

const CARTEL: Lamina = { tipo: 'cartel', titulo: 'SALA 1', lineas: ['COOPERATIVA'] };
const { ancho: W, alto: H } = medidasLienzo(1, 0.34);

/** Dónde quedó escrito cada texto (x de su centro). */
function textos(llamadas: Llamada[]): Map<string, number> {
  return new Map(
    llamadas
      .filter((l) => l.metodo === 'fillText')
      .map((l) => [String(l.args[0]), Number(l.args[1])]),
  );
}

function contarMallas(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((x) => {
    if ((x as Mesh).isMesh) n++;
  });
  return n;
}

afterEach(() => {
  sellos.value = [];
});

describe('carteles del pasillo: flechas', () => {
  it('la flecha se dibuja como figura a su lado y el texto se corre al otro', () => {
    const lamina: Lamina = { tipo: 'cartel', titulo: 'SALAS 3 A 5', flecha: 'izquierda' };
    const { ancho, alto } = medidasLienzo(1.2, 0.5);
    const sin = lienzoFalso();
    dibujarLamina(sin.ctx, { tipo: 'cartel', titulo: 'SALAS 3 A 5' }, ancho, alto, '#2f4a6b', 1);
    const con = lienzoFalso();
    dibujarLamina(con.ctx, lamina, ancho, alto, '#2f4a6b', 1);
    expect(textos(con.llamadas).get('SALAS 3 A 5')).toBeGreaterThan(
      textos(sin.llamadas).get('SALAS 3 A 5') ?? Infinity,
    );
    // La punta es el punto más a la izquierda de la figura.
    const puntos = con.llamadas
      .filter((l) => l.metodo === 'moveTo' || l.metodo === 'lineTo')
      .map((l) => Number(l.args[0]));
    expect(Math.min(...puntos)).toBeLessThan(ancho * 0.2);
    // Ningún texto con «←»: la letra del juego no lo trae.
    for (const t of textos(con.llamadas).keys()) expect(t).not.toContain('←');
  });

  it('el esquema solo deja poner flecha en un cartel', () => {
    const porteria = salaPorId('porteria');
    const valida = (lamina: Lamina) =>
      esquemaSalaValidada.safeParse({
        ...porteria,
        objetos: porteria.objetos.map((o) => (o.id === 'pasillo-flecha-2' ? { ...o, lamina } : o)),
      }).success;
    expect(valida({ tipo: 'cartel', titulo: 'SALAS', flecha: 'derecha' })).toBe(true);
    expect(valida({ tipo: 'papel', titulo: 'SALAS', flecha: 'derecha' })).toBe(false);
  });
});

describe('carteles del pasillo: el sello', () => {
  it('sin sello no se estampa nada; con sello, su figura y el texto se corre a la izquierda', () => {
    const sin = lienzoFalso();
    dibujarLamina(sin.ctx, CARTEL, W, H, '#2f4a6b', 3);
    const con = lienzoFalso();
    dibujarLamina(con.ctx, CARTEL, W, H, '#2f4a6b', 3, { sello: 1 });
    const colores = (l: Llamada[]) => l.map((x) => x.fillStyle);
    expect(colores(sin.llamadas)).not.toContain(SELLOS_DE_SALA[0]?.color);
    expect(colores(con.llamadas)).toContain(SELLOS_DE_SALA[0]?.color);
    for (const t of ['SALA 1', 'COOPERATIVA']) {
      expect(textos(con.llamadas).get(t)).toBeLessThan(textos(sin.llamadas).get(t) ?? 0);
    }
    // Ningún texto se mete debajo del sello: termina antes de su borde izquierdo.
    const traslado = con.llamadas.find((l) => l.metodo === 'translate');
    const [xSello = 0] = (traslado?.args ?? []).map(Number);
    const radio = Math.min(H * 0.92, W * 0.4) / 2;
    for (const l of con.llamadas.filter((x) => x.metodo === 'fillText')) {
      const tam = Number(/(\d+(?:\.\d+)?)px/.exec(l.font)?.[1] ?? 0);
      const derecha = Number(l.args[1]) + (String(l.args[0]).length * tam * 0.55) / 2;
      expect(derecha, String(l.args[0])).toBeLessThan(xSello - radio);
    }
  });

  it('cada sala tiene su figura y su color, y el sello queda dentro del cartel', () => {
    expect(SELLOS_DE_SALA).toHaveLength(5);
    expect(new Set(SELLOS_DE_SALA.map((s) => s.figura)).size).toBe(5);
    for (let n = 1; n <= 5; n++) {
      const { ctx, llamadas } = lienzoFalso();
      dibujarLamina(ctx, CARTEL, W, H, '#2f4a6b', n, { sello: n });
      expect(llamadas.map((l) => l.fillStyle)).toContain(SELLOS_DE_SALA[n - 1]?.color);
      const traslado = llamadas.find((l) => l.metodo === 'translate');
      const [x = NaN, y = NaN] = (traslado?.args ?? []).map(Number);
      expect(x).toBeGreaterThan(W / 2);
      expect(x).toBeLessThan(W);
      expect(y).toBe(H / 2);
    }
  });

  it('marcar la lámina cambia sus marcas solo si son otras', () => {
    const cartel = salaPorId('porteria').objetos.find((o) => o.id === idCartelDeSala(2));
    if (!cartel) throw new Error('falta el cartel de la sala 2');
    const textura = texturaLamina(cartel);
    if (!textura) throw new Error('el cartel no tiene lámina');
    expect(marcasDeLamina(textura)).toEqual({});
    expect(marcarLamina(textura, { sello: 2 })).toBe(true);
    expect(marcarLamina(textura, { sello: 2 })).toBe(false);
    expect(marcasDeLamina(textura)).toEqual({ sello: 2 });
    expect(marcarLamina(textura, {})).toBe(true);
    expect(marcasDeLamina(textura)).toEqual({});
  });
});

describe('carteles del pasillo en la portería armada', () => {
  const texturaDe = (raiz: Object3D, n: number): Texture => {
    const malla = raiz.getObjectByName(idCartelDeSala(n)) as Mesh;
    return (malla.material as MeshLambertMaterial).map as Texture;
  };

  it('cada sala con sello lo lleva en su cartel, sin mallas nuevas; una partida nueva lo quita', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    const mallas = contarMallas(raiz);
    const carteles = animarCartelesDeSalas(raiz);
    expect(carteles.estado).toBe('carteles-0');

    sellos.value = ['s1-cooperativa', 's3-gimnasio'];
    expect(carteles.estado).toBe('carteles-2');
    expect(marcasDeLamina(texturaDe(raiz, 1))).toEqual({ sello: 1 });
    expect(marcasDeLamina(texturaDe(raiz, 2))).toEqual({});
    expect(marcasDeLamina(texturaDe(raiz, 3))).toEqual({ sello: 3 });
    expect(contarMallas(raiz)).toBe(mallas);

    sellos.value = [];
    expect(carteles.estado).toBe('carteles-0');
    expect(marcasDeLamina(texturaDe(raiz, 1))).toEqual({});

    carteles.liberar();
    sellos.value = ['s1-cooperativa'];
    expect(marcasDeLamina(texturaDe(raiz, 1))).toEqual({});
  });
});
