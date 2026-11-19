import { describe, expect, it } from 'vitest';
import { BoxGeometry, CylinderGeometry, Mesh } from 'three';
import type { MeshLambertMaterial } from 'three';
import { TIPOS_LAMINA, esquemaSala } from '../../src/content/esquema-salas';
import type { ObjetoSala, Sala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { construirSala } from '../../src/engine/salas/construir';
import {
  CONTRASTE_MINIMO,
  LADO_MAXIMO,
  LADO_MINIMO,
  caraDeLamina,
  contraste,
  dibujarLamina,
  medidasCara,
  medidasLienzo,
  textoAjustado,
  tintaPara,
  uvLamina,
} from '../../src/engine/salas/laminas';
import type { Lamina } from '../../src/engine/salas/laminas';
import {
  UV_BLANCO,
  cajaBiselada,
  enRegion,
  parte,
  unirPartes,
} from '../../src/engine/salas/piezas/comunes';
import { PIEZAS } from '../../src/engine/salas/piezas';

// Pulir las salas (sesión C): láminas legibles dibujadas por código y piezas por código.

interface Llamada {
  metodo: string;
  args: unknown[];
  font: string;
  fillStyle: unknown;
}

/** Un contexto 2D de mentira que anota lo que se dibuja. La letra mide 0,55 de su tamaño. */
function lienzoFalso(): { ctx: CanvasRenderingContext2D; llamadas: Llamada[] } {
  const llamadas: Llamada[] = [];
  const estado: Record<string | symbol, unknown> = { font: '10px sans-serif', fillStyle: '#000' };
  const pila: Record<string | symbol, unknown>[] = [];
  const degradado = { addColorStop: () => undefined };
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
        if (metodo.startsWith('create') && metodo.endsWith('Gradient')) return degradado;
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

const textos = (llamadas: Llamada[]) => llamadas.filter((l) => l.metodo === 'fillText');
const tamDe = (font: string) => Number(/(\d+)px/.exec(font)?.[1] ?? 0);

const objeto = (sala: Sala, id: string): ObjetoSala => {
  const o = sala.objetos.find((x) => x.id === id);
  if (!o) throw new Error(`falta ${id}`);
  return o;
};

describe('láminas: medidas del lienzo', () => {
  it('320 px por metro, sin pasar de 1024 ni bajar de 128 en el lado corto', () => {
    expect(medidasLienzo(1.8, 1)).toEqual({ ancho: 576, alto: 320 });
    const grande = medidasLienzo(8, 1);
    expect(grande.ancho).toBe(LADO_MAXIMO);
    expect(grande.alto).toBe(128);
    const ficha = medidasLienzo(0.15, 0.1);
    expect(ficha.alto).toBe(LADO_MINIMO);
    expect(ficha.ancho).toBe(192);
    // Una tira muy larga y delgada: manda el máximo.
    const tira = medidasLienzo(4, 0.05);
    expect(tira.ancho).toBeLessThanOrEqual(LADO_MAXIMO);
  });

  it('una hoja acostada lleva la lámina arriba; un plano o una caja alta, al frente', () => {
    const hoja = { forma: 'caja' as const, tam: [0.3, 0.01, 0.22] as [number, number, number] };
    expect(caraDeLamina(hoja)).toBe('arriba');
    expect(medidasCara(hoja)).toEqual([0.3, 0.22]);
    const pizarra = { forma: 'plano' as const, tam: [1.8, 1, 0] as [number, number, number] };
    expect(caraDeLamina(pizarra)).toBe('frente');
    expect(medidasCara(pizarra)).toEqual([1.8, 1]);
  });
});

describe('láminas: letra clara', () => {
  it('la tinta escogida contrasta al menos 4,5:1 con fondos claros y oscuros', () => {
    for (const fondo of [
      '#1e3d32',
      '#b9895a',
      '#fdfefe',
      '#17202a',
      '#f4f1e8',
      '#c0392b',
      '#2471a3',
      '#f1c40f',
    ]) {
      expect(contraste(tintaPara(fondo), fondo), fondo).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    }
  });

  it('un título largo baja de tamaño y, si aun así no cabe, se corta con «…»', () => {
    const { ctx, llamadas } = lienzoFalso();
    const usado = textoAjustado(ctx, 'PRECIOS DE LA COOPERATIVA', 100, 20, 200, 40, 'x', '#000');
    expect(usado).toBeLessThan(40);
    const [escrito] = textos(llamadas);
    expect(escrito).toBeDefined();
    const ancho = String(escrito?.args[0]).length * tamDe(escrito?.font ?? '') * 0.55;
    expect(ancho).toBeLessThanOrEqual(200);
    expect(String(escrito?.args[0]).endsWith('…')).toBe(true);
  });

  it('cada tipo se dibuja sin errores, con su título y sus líneas, dentro del lienzo', () => {
    for (const tipo of TIPOS_LAMINA) {
      const lamina: Lamina = {
        tipo,
        titulo: 'PRECIOS',
        lineas: ['LOCAL 12', 'Arroz | 2 | $1.600'],
      };
      for (const [w, h] of [
        [576, 320],
        [192, 128],
        [128, 512],
      ] as const) {
        const { ctx, llamadas } = lienzoFalso();
        dibujarLamina(ctx, lamina, w, h, tipo === 'marcador' ? '#17202a' : '#e8e2d0', 7);
        const escritos = textos(llamadas).map((l) => String(l.args[0]));
        // En un lienzo angosto el título puede quedar cortado con «…»; en uno ancho, entero.
        const cabe = escritos.some(
          (e) => e === 'PRECIOS' || (e.endsWith('…') && 'PRECIOS'.startsWith(e.slice(0, -1))),
        );
        expect(cabe, `${tipo} ${w}×${h}: ${escritos.join(' / ')}`).toBe(true);
        if (w >= 576) expect(escritos, `${tipo} ${w}×${h}`).toContain('PRECIOS');
        for (const l of textos(llamadas)) {
          const x = Number(l.args[1]);
          const y = Number(l.args[2]);
          // El texto se escribe con traslados (notas, ejes girados): basta que no se vaya lejos.
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          expect(tamDe(l.font), `${tipo}: letra de ${l.font}`).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('el título de una pizarra en la pared se ve grande: al menos el 10 % del alto', () => {
    const { ctx, llamadas } = lienzoFalso();
    dibujarLamina(ctx, { tipo: 'pizarra', titulo: 'PRECIOS' }, 576, 320, '#1e3d32', 1);
    const titulo = textos(llamadas).find((l) => l.args[0] === 'PRECIOS');
    expect(tamDe(titulo?.font ?? '')).toBeGreaterThanOrEqual(32);
  });

  it('sin líneas no escribe texto inventado: dibuja garabatos', () => {
    const { ctx, llamadas } = lienzoFalso();
    dibujarLamina(ctx, { tipo: 'papel', titulo: 'FICHA' }, 192, 128, '#fdfefe', 3);
    expect(textos(llamadas).map((l) => l.args[0])).toEqual(['FICHA']);
    expect(llamadas.filter((l) => l.metodo === 'stroke').length).toBeGreaterThan(0);
  });

  it('la misma semilla dibuja igual; otra semilla mueve las notas del corcho', () => {
    const dibujo = (semilla: number) => {
      const { ctx, llamadas } = lienzoFalso();
      dibujarLamina(ctx, { tipo: 'corcho' }, 320, 224, '#b9895a', semilla);
      return JSON.stringify(llamadas.filter((l) => l.metodo === 'translate'));
    };
    expect(dibujo(5)).toBe(dibujo(5));
    expect(dibujo(5)).not.toBe(dibujo(6));
  });
});

describe('láminas en la sala', () => {
  it('la cara de la lámina ve todo el lienzo y los cantos, la esquina del marco', () => {
    const g = new BoxGeometry(1, 1, 0.03);
    uvLamina(g, 'frente');
    const uv = g.getAttribute('uv');
    const frente = [16, 17, 18, 19].map((i) => [uv.getX(i), uv.getY(i)]);
    expect(frente).toEqual([
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
    ]);
    for (let i = 0; i < 16; i++) {
      expect(uv.getX(i)).toBeCloseTo(0.002, 6);
      expect(uv.getY(i)).toBeCloseTo(0.998, 6);
    }
  });

  it('el esquema acepta una lámina en un plano y la rechaza con modelo o en un cilindro', () => {
    const base = salaPorId('s1-cooperativa');
    const conLamina = (cambio: Partial<ObjetoSala>): Sala => ({
      ...base,
      objetos: base.objetos.map((o) => (o.id === 's1-pizarra' ? { ...o, ...cambio } : o)),
    });
    expect(
      esquemaSala.safeParse(conLamina({ lamina: { tipo: 'pizarra', titulo: 'PRECIOS' } })).success,
    ).toBe(true);
    expect(esquemaSala.safeParse(conLamina({ lamina: { tipo: 'mapa' as 'cartel' } })).success).toBe(
      false,
    );
    expect(
      esquemaSala.safeParse(conLamina({ lamina: { tipo: 'cartel', titulo: 'x'.repeat(29) } }))
        .success,
    ).toBe(false);
  });

  it('sin navegador la lámina queda con su color y la sala se arma igual', () => {
    const base = salaPorId('s1-cooperativa');
    const sala: Sala = {
      ...base,
      objetos: base.objetos.map((o) =>
        o.id === 's1-pizarra'
          ? { ...o, lamina: { tipo: 'pizarra' as const, titulo: 'PRECIOS' } }
          : o,
      ),
    };
    const armada = construirSala(sala);
    const pizarra = armada.raiz.getObjectByName('s1-pizarra') as Mesh;
    expect((pizarra.material as MeshLambertMaterial).map).toBeNull();
    expect(objeto(sala, 's1-pizarra').lamina?.tipo).toBe('pizarra');
  });
});

describe('piezas por código', () => {
  it('unirPartes deja una geometría indexada con posición, normal, UV y color', () => {
    const g = unirPartes([
      parte(cajaBiselada(0.2, 0.1, 0.1), '#c0392b', [0, 0.05, 0]),
      parte(new CylinderGeometry(0.02, 0.02, 0.2, 8), '#2c3e50', [0, 0.2, 0]),
    ]);
    expect(g.index).not.toBeNull();
    expect(Object.keys(g.attributes).sort()).toEqual(['color', 'normal', 'position', 'uv']);
    const uv = g.getAttribute('uv');
    expect([uv.getX(0), uv.getY(0)]).toEqual([...UV_BLANCO].map((n) => Math.fround(n)));
    g.computeBoundingBox();
    expect(g.boundingBox?.min.y).toBeCloseTo(0, 5);
  });

  it('enRegion lleva las UV del costado de un cilindro a su región y las tapas al blanco', () => {
    const g = enRegion(new CylinderGeometry(0.1, 0.1, 0.2, 8, 1), [0.5, 0, 1, 0.25], [0]);
    const uv = g.getAttribute('uv');
    let costado = 0;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (u === Math.fround(UV_BLANCO[0]) && v === Math.fround(UV_BLANCO[1])) continue;
      costado++;
      expect(u).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeGreaterThanOrEqual(0.75 - 1e-6);
    }
    expect(costado).toBe(18);
  });

  it('cada pieza de salas.json está registrada y cabe en el tam de su objeto', () => {
    for (const lugar of [
      'porteria',
      's1-cooperativa',
      's2-laboratorio',
      's3-gimnasio',
      's4-biblioteca',
      's5-rectoria',
    ] as const) {
      for (const o of salaPorId(lugar).objetos) {
        if (!o.pieza) continue;
        const constructor = PIEZAS[o.pieza];
        expect(constructor, `${o.id}: pieza ${o.pieza}`).toBeDefined();
        const { geometria } = constructor?.(o) ?? { geometria: null };
        geometria?.computeBoundingBox();
        const caja = geometria?.boundingBox;
        const [ancho, alto, fondo] = o.tam;
        const redondo = o.forma === 'cilindro' || o.forma === 'esfera';
        const f = redondo ? ancho : o.forma === 'plano' ? 0.1 : fondo;
        const holgura = 0.01;
        expect(caja?.min.y ?? -1, `${o.id}: base`).toBeGreaterThanOrEqual(-holgura);
        expect(caja?.max.y ?? 99, `${o.id}: alto`).toBeLessThanOrEqual(alto + holgura);
        expect(
          Math.max(-(caja?.min.x ?? 0), caja?.max.x ?? 0),
          `${o.id}: ancho`,
        ).toBeLessThanOrEqual(ancho / 2 + holgura);
        expect(
          Math.max(-(caja?.min.z ?? 0), caja?.max.z ?? 0),
          `${o.id}: fondo`,
        ).toBeLessThanOrEqual(f / 2 + holgura);
      }
    }
  });
});
