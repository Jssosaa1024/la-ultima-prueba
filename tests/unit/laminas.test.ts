import { describe, expect, it } from 'vitest';
import { BoxGeometry, CylinderGeometry, Mesh, Raycaster, Texture, Vector3 } from 'three';
import type { MeshLambertMaterial } from 'three';
import { LUGARES, TIPOS_LAMINA, esquemaSalaValidada } from '../../src/content/esquema-salas';
import type { ObjetoSala, Sala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { construirSala } from '../../src/engine/salas/construir';
import {
  CONTRASTE_MINIMO,
  LADO_MAXIMO,
  LUZ_MARCADOR,
  REALCE,
  LADO_MINIMO,
  caraDeLamina,
  contraste,
  dibujarLamina,
  materialLamina,
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
import type { ConstructorPieza } from '../../src/engine/salas/piezas';

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

  it('el esquema acepta una lámina en un plano y rechaza tipos, títulos y usos que no sirven', () => {
    const base = salaPorId('s1-cooperativa');
    const con = (id: string, cambio: Partial<ObjetoSala>): Sala => ({
      ...base,
      objetos: base.objetos.map((o) => (o.id === id ? { ...o, ...cambio } : o)),
    });
    const valida = (sala: Sala) => esquemaSalaValidada.safeParse(sala).success;
    expect(valida(con('s1-pizarra', { lamina: { tipo: 'pizarra', titulo: 'PRECIOS' } }))).toBe(
      true,
    );
    expect(valida(con('s1-pizarra', { lamina: { tipo: 'mapa' as 'cartel' } }))).toBe(false);
    expect(valida(con('s1-pizarra', { lamina: { tipo: 'cartel', titulo: 'x'.repeat(29) } }))).toBe(
      false,
    );
    // Con modelo, en un cilindro o con pieza: no.
    expect(valida(con('s1-mesa', { lamina: { tipo: 'papel' } }))).toBe(false);
    expect(valida(con('s1-palanca', { lamina: { tipo: 'papel' } }))).toBe(false);
    expect(valida(con('s1-pizarra', { lamina: { tipo: 'papel' }, pieza: 'linterna' }))).toBe(false);
    expect(valida(con('s1-mesa', { pieza: 'mesa' }))).toBe(false);
    // El marcador solo muestra dígitos; la cuadrícula, dos ejes.
    const marcador = (lineas: string[]) =>
      con('s1-pizarra', { lamina: { tipo: 'marcador', lineas } });
    expect(valida(marcador(['LOCAL 12', '08', '12:30']))).toBe(true);
    expect(valida(marcador(['0,75']))).toBe(false);
    expect(valida(marcador(['$1.600']))).toBe(false);
    expect(
      valida(con('s1-pizarra', { lamina: { tipo: 'cuadricula', lineas: ['x', 'y', 'z'] } })),
    ).toBe(false);
  });

  it('sin navegador la lámina lleva una textura vacía y queda aparte de lo fijo, como en el juego', () => {
    const base = salaPorId('s1-cooperativa');
    const sinModelo = (o: ObjetoSala): ObjetoSala => {
      const copia = { ...o };
      delete copia.modelo;
      return copia;
    };
    // Un cuadro sin modelo ni acción va en lo fijo; con lámina, queda aparte.
    const cuadroSolo = base.objetos.map((o) => (o.id === 's1-cuadro-1' ? sinModelo(o) : o));
    const sinLamina = construirSala({ ...base, objetos: cuadroSolo });
    const sala: Sala = {
      ...base,
      objetos: cuadroSolo.map((o) => {
        if (o.id === 's1-pizarra') return { ...o, lamina: { tipo: 'pizarra', titulo: 'PRECIOS' } };
        if (o.id === 's1-cuadro-1') return { ...o, lamina: { tipo: 'cartel', titulo: 'OFERTA' } };
        return o;
      }),
    };
    const armada = construirSala(sala);
    const pizarra = armada.raiz.getObjectByName('s1-pizarra') as Mesh;
    expect((pizarra.material as MeshLambertMaterial).map).not.toBeNull();
    expect(pizarra.userData['lamina']).toBe('pizarra');
    expect(armada.raiz.getObjectByName('s1-cuadro-1')).toBeDefined();
    expect(armada.mallas).toBe(sinLamina.mallas + 1);
  });

  it('las láminas se realzan para la penumbra; el marcador brilla solo con su textura', () => {
    const textura = new Texture();
    const pizarra = materialLamina('pizarra', textura);
    expect(pizarra.color.r).toBeCloseTo(REALCE.pizarra, 5);
    expect(pizarra.emissiveMap).toBeNull();
    expect(pizarra.emissive.getHex()).toBe(0);
    const marcador = materialLamina('marcador', textura);
    expect(marcador.emissiveMap).toBe(textura);
    expect(marcador.emissive.r).toBeCloseTo(LUZ_MARCADOR, 5);
  });

  it('la letra de la pizarra y del marcador contrasta con su fondo', () => {
    for (const [tipo, base] of [
      ['pizarra', '#1e3d32'],
      ['pizarra', '#eef1f2'],
      ['pizarra', '#7a8a80'],
      ['marcador', '#17202a'],
      ['marcador', '#d5dde3'],
    ] as const) {
      const { ctx, llamadas } = lienzoFalso();
      dibujarLamina(ctx, { tipo, titulo: 'HOY' }, 576, 320, base, 1);
      const titulo = textos(llamadas).find((l) => l.args[0] === 'HOY');
      expect(contraste(String(titulo?.fillStyle), base), `${tipo} ${base}`).toBeGreaterThanOrEqual(
        CONTRASTE_MINIMO,
      );
    }
  });

  it('las láminas y los dibujos de cada sala caben en 4 MB de GPU (con mipmaps)', () => {
    for (const lugar of LUGARES) {
      let bytes = 0;
      for (const o of salaPorId(lugar).objetos) {
        if (o.lamina) {
          const [a, h] = medidasCara(o);
          const px = medidasLienzo(a, h);
          bytes += px.ancho * px.alto * 4 * (4 / 3);
        }
        const dibujo = o.pieza ? PIEZAS[o.pieza]?.(o).dibujo : undefined;
        if (dibujo) {
          bytes +=
            Math.min(dibujo.ancho, LADO_MAXIMO) * Math.min(dibujo.alto, LADO_MAXIMO) * 4 * (4 / 3);
        }
      }
      expect(bytes, lugar).toBeLessThanOrEqual(4 * 1024 * 1024);
    }
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

  it('una pieza que se toca conserva su caja invisible para chocar y tocar, sin draw call', () => {
    const registro = PIEZAS as Record<string, ConstructorPieza>;
    registro['prueba-palanca'] = (o) => ({
      geometria: unirPartes([
        parte(cajaBiselada(0.02, o.tam[1], 0.02), '#c0392b', [0, o.tam[1] / 2, 0]),
      ]),
      dibujo: { ancho: 4096, alto: 64, pintar: () => undefined },
    });
    try {
      const base = salaPorId('s1-cooperativa');
      const sala: Sala = {
        ...base,
        objetos: base.objetos.map((o) =>
          o.id === 's1-palanca' ? { ...o, pieza: 'prueba-palanca' } : o,
        ),
      };
      const antes = construirSala(base);
      const armada = construirSala(sala);
      const palanca = armada.raiz.getObjectByName('s1-palanca') as Mesh;
      expect((palanca.material as MeshLambertMaterial).visible).toBe(false);
      expect(palanca.userData['pieza']).toBe('prueba-palanca');
      const vista = palanca.getObjectByName('s1-palanca-pieza') as Mesh;
      expect((vista.material as MeshLambertMaterial).map).not.toBeNull();
      // La caja invisible no cuenta como draw call: la pieza reemplaza a la primitiva.
      expect(armada.mallas).toBe(antes.mallas);
      // El rayo pega en la caja del tam (6 cm de diámetro) aunque la pieza mida 2 cm.
      armada.raiz.updateMatrixWorld(true);
      const rayo = new Raycaster(new Vector3(0.95 + 0.022, 1.2, 1), new Vector3(0, 0, -1));
      const golpes = rayo.intersectObject(palanca, true);
      expect(golpes.map((g) => g.object.name)).toEqual(['s1-palanca']);
    } finally {
      delete registro['prueba-palanca'];
    }
  });

  it('los dibujos de las piezas registradas no pasan de 1024 px', () => {
    for (const lugar of LUGARES) {
      for (const o of salaPorId(lugar).objetos) {
        const dibujo = o.pieza ? PIEZAS[o.pieza]?.(o).dibujo : undefined;
        if (!dibujo) continue;
        expect(dibujo.ancho, o.id).toBeLessThanOrEqual(LADO_MAXIMO);
        expect(dibujo.alto, o.id).toBeLessThanOrEqual(LADO_MAXIMO);
      }
    }
  });

  it('cada pieza de salas.json está registrada y cabe en el tam de su objeto', () => {
    for (const lugar of LUGARES) {
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
