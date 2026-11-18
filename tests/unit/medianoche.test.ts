import { describe, expect, it } from 'vitest';
import { Color, DirectionalLight, HemisphereLight } from 'three';
import type { BufferAttribute, Mesh, Object3D } from 'three';
import { esquemaSala, LUGARES } from '../../src/content/esquema-salas';
import type { Sala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { LIMITES_PANEL } from '../../src/debug/metricas';
import { animacionDeSala, conAmbiente } from '../../src/engine/mecanismos';
import type { AnimacionSala } from '../../src/engine/mecanismos';
import { EXPOSICION, exposicionDe } from '../../src/engine/renderer';
import {
  crearAcabados,
  esPuerta,
  esTablero,
  huecoDeVentana,
  paredDeVentana,
  TITILEO,
} from '../../src/engine/salas/acabados';
import type { Titileo } from '../../src/engine/salas/acabados';
import { construirSala, LUZ_INICIAL } from '../../src/engine/salas/construir';
import { animarLamparas, CICLO_TITILEO_S, nivelTitileo } from '../../src/engine/salas/lamparas';
import { alturaCerros } from '../../src/engine/salas/ventanas';
import { CON_ARTE } from './sin-arte';

// T19k: medianoche en las salas con arte (luz por sala, lámparas con estado, ventanas). Desde
// T19l, cada sala que recibe su arte entra en `CON_ARTE` (tests/unit/sin-arte.ts).

const NOCHE = CON_ARTE;

const nombrada = (raiz: Object3D, nombre: string): Mesh => {
  const m = raiz.getObjectByName(nombre) as Mesh | undefined;
  if (!m) throw new Error(`falta ${nombre}`);
  return m;
};

const luces = (raiz: Object3D) => {
  const hemi: HemisphereLight[] = [];
  const dir: DirectionalLight[] = [];
  raiz.traverse((o) => {
    if (o instanceof HemisphereLight) hemi.push(o);
    if (o instanceof DirectionalLight) dir.push(o);
  });
  return { hemi, dir };
};

const hex = (c: Color): string => `#${c.getHexString()}`;

describe('luz por sala (T19k)', () => {
  it('las salas con arte tienen su luz; las demás quedan con la de T19i', () => {
    for (const l of LUGARES) {
      const sala = salaPorId(l);
      const { hemi, dir } = luces(construirSala(sala).raiz);
      // Siempre las mismas dos luces: cambiar de juego recompilaría los shaders.
      expect(hemi).toHaveLength(1);
      expect(dir).toHaveLength(1);
      const luz = sala.luz ?? LUZ_INICIAL;
      expect(hex(hemi[0]?.color ?? new Color())).toBe(luz.cielo);
      expect(hex(hemi[0]?.groundColor ?? new Color())).toBe(luz.suelo);
      expect(hemi[0]?.intensity).toBe(luz.fuerza);
      expect(hex(dir[0]?.color ?? new Color())).toBe(luz.direccional);
      expect(dir[0]?.intensity).toBe(luz.fuerzaDireccional);
      expect(sala.luz !== undefined).toBe((NOCHE as readonly string[]).includes(l));
    }
  });

  it('la luz de T19i no cambió para las salas sin `luz`', () => {
    expect(LUZ_INICIAL).toEqual({
      cielo: '#fff6ea',
      suelo: '#8f8377',
      fuerza: 1.45,
      direccional: '#ffe9cc',
      fuerzaDireccional: 1.7,
      exposicion: EXPOSICION,
    });
  });

  it('la direccional sale de `desde` si la sala lo dice, y apunta al centro', () => {
    const s1 = salaPorId('s1-cooperativa');
    const base = s1.luz ?? LUZ_INICIAL;
    const { dir } = luces(construirSala({ ...s1, luz: { ...base, desde: [-2, 5, -1] } }).raiz);
    expect(dir[0]?.position.toArray()).toEqual([-2, 5, -1]);
    expect(dir[0]?.target.position.toArray()).toEqual([0, 0, 0]);
  });

  it('la exposición es la de la sala por el brillo del jugador', () => {
    expect(exposicionDe({}, 1)).toBe(EXPOSICION);
    expect(exposicionDe({}, 1.2)).toBeCloseTo(EXPOSICION * 1.2);
    const porteria = salaPorId('porteria');
    expect(exposicionDe(porteria, 0.85)).toBeCloseTo((porteria.luz?.exposicion ?? 0) * 0.85);
  });

  it('el esquema rechaza una luz incompleta o con colores raros', () => {
    const s1 = salaPorId('s1-cooperativa');
    const luz = s1.luz ?? LUZ_INICIAL;
    expect(esquemaSala.safeParse({ ...s1, luz: { ...luz, cielo: 'azul' } }).success).toBe(false);
    expect(esquemaSala.safeParse({ ...s1, luz: { cielo: '#ffffff' } }).success).toBe(false);
    expect(esquemaSala.safeParse({ ...s1, luz: { ...luz, fuerza: -1 } }).success).toBe(false);
  });
});

describe('lámparas con estado (T19k)', () => {
  const porteria = salaPorId('porteria');

  it('la portería: la del fondo titila, la del medio está apagada y la de la entrada, encendida', () => {
    expect(porteria.acabados?.lamparas).toEqual(['titila', 'apagada', 'encendida']);
    const { luces: mallas, fijas } = crearAcabados(porteria, porteria.acabados ?? never());
    const brillos = mallas.find((m) => m.name === 'brillos');
    const difusores = mallas.find((m) => m.name === 'difusores');
    if (!brillos || !difusores) throw new Error('faltan las luces');
    // Halo y charco (4 vértices cada uno) solo en las dos que dan luz.
    expect(brillos.geometry.getAttribute('position').count).toBe(2 * 2 * 4);
    // El difusor de la apagada va con lo fijo y toma la luz de la sala.
    const apagados = fijas.find((m) => m.name === 'difusores-apagados');
    expect(apagados?.geometry.getAttribute('position').count).toBe(4);
    // Lo que titila: la primera lámpara, al principio de cada malla.
    expect((brillos.userData[TITILEO] as Titileo).rangos).toEqual([[0, 8]]);
    expect((difusores.userData[TITILEO] as Titileo).rangos).toEqual([[0, 4]]);
  });

  it('sin `lamparas`, todas encendidas y nada titila', () => {
    const s1 = salaPorId('s1-cooperativa');
    expect(s1.acabados?.lamparas).toBeUndefined();
    const { luces: mallas, fijas } = crearAcabados(s1, s1.acabados ?? never());
    for (const m of mallas) expect(m.userData[TITILEO]).toBeUndefined();
    expect(fijas.find((m) => m.name === 'difusores-apagados')).toBeUndefined();
    expect(animarLamparas(construirSala(s1).raiz)).toBeNull();
  });

  it('con todas apagadas y sin ventanas no quedan mallas de luz vacías', () => {
    const s1 = salaPorId('s1-cooperativa');
    const acabados = {
      zocalo: '#123456',
      franja: '#123456',
      marcos: '#123456',
      lamparas: ['apagada', 'apagada'] as Array<'apagada'>,
    };
    const { luces: mallas, fijas } = crearAcabados(s1, acabados);
    expect(mallas).toHaveLength(0);
    expect(fijas.find((m) => m.name === 'difusores-apagados')).toBeDefined();
  });

  it('el titileo nunca llega a negro, casi siempre está encendido y baja de vez en cuando', () => {
    let bajo = 0;
    let minimo = 1;
    for (let t = 0; t < 600; t += 0.01) {
      const n = nivelTitileo(t);
      minimo = Math.min(minimo, n);
      if (n < 1) bajo += 0.01;
    }
    expect(minimo).toBeGreaterThanOrEqual(0.6);
    expect(bajo / 600).toBeLessThan(0.05);
    // En medio minuto siempre hay al menos una racha.
    for (let desde = 0; desde < 570; desde += 10) {
      let alguna = false;
      for (let t = desde; t < desde + 30 && !alguna; t += 0.01) alguna = nivelTitileo(t) < 1;
      expect(alguna).toBe(true);
    }
  });

  it('a lo sumo dos bajadas en cualquier segundo (WCAG 2.3.1 permite tres destellos)', () => {
    const paso = 0.005;
    const inicios: number[] = [];
    let antes = 1;
    for (let t = 0; t < 900; t += paso) {
      const n = nivelTitileo(t);
      if (n < 1 && antes === 1) inicios.push(t);
      antes = n;
    }
    expect(inicios.length).toBeGreaterThan(900 / CICLO_TITILEO_S / 2);
    for (let i = 2; i < inicios.length; i++) {
      expect((inicios[i] ?? 0) - (inicios[i - 2] ?? 0)).toBeGreaterThan(1);
    }
  });

  it('la animación baja solo los vértices de la lámpara que titila y al salir la deja encendida', () => {
    const { raiz } = construirSala(porteria);
    const brillos = nombrada(raiz, 'brillos');
    const color = brillos.geometry.getAttribute('color') as BufferAttribute;
    const antes = Array.from(color.array as Float32Array);
    const animacion = animarLamparas(raiz, false);
    if (!animacion) throw new Error('sin animación');
    // Avanza hasta la primera bajada.
    let t = 0;
    while (nivelTitileo(t) === 1) t += 0.01;
    animacion.actualizar(t);
    const nivel = nivelTitileo(t);
    const ahora = color.array as Float32Array;
    for (let i = 0; i < 8 * 3; i++) expect(ahora[i]).toBeCloseTo((antes[i] ?? 0) * nivel);
    for (let i = 8 * 3; i < antes.length; i++) expect(ahora[i]).toBe(antes[i]);
    expect(animacion.estado).toBe('lampara-baja');
    animacion.liberar();
    expect(Array.from(color.array as Float32Array)).toEqual(antes);
  });

  it('con «reducir movimiento» no titila', () => {
    const { raiz } = construirSala(porteria);
    const color = nombrada(raiz, 'brillos').geometry.getAttribute('color') as BufferAttribute;
    const antes = Array.from(color.array as Float32Array);
    const animacion = animarLamparas(raiz, true);
    if (!animacion) throw new Error('sin animación');
    let t = 0;
    let bajadas = 0;
    for (let i = 0; i < 2000; i++) {
      animacion.actualizar(0.05);
      t += 0.05;
      // Justo donde titilaría, los colores siguen iguales.
      if (nivelTitileo(t) < 1) {
        bajadas++;
        expect(Array.from(color.array as Float32Array)).toEqual(antes);
      }
      expect(animacion.estado).toBe('lampara-llena');
    }
    // El recorrido pasó por bajadas: si no, la prueba no probaría nada.
    expect(bajadas).toBeGreaterThan(0);
  });

  it('la portería sigue diciendo su máquina y su luz a las e2e', () => {
    const { raiz } = construirSala(porteria);
    const animacion = animacionDeSala('porteria', raiz);
    animacion?.actualizar(0.1);
    expect(animacion?.estado).toBe('mural-0');
    expect(animacion?.detalle).toBe('luz-puerta-1');
    animacion?.liberar();
  });

  it('conAmbiente no inventa un detalle que la máquina no tiene', () => {
    const maquina: AnimacionSala = { actualizar: () => undefined, estado: 'm', liberar: () => {} };
    let pasos = 0;
    const ambiente: AnimacionSala = {
      actualizar: () => void pasos++,
      estado: 'a',
      liberar: () => {},
    };
    const junta = conAmbiente(maquina, ambiente);
    junta.actualizar(0.1);
    expect(pasos).toBe(1);
    expect(junta.estado).toBe('m');
    expect('detalle' in junta).toBe(false);
  });
});

describe('ventanas de noche (T19k)', () => {
  it('las salas con arte tienen al menos dos ventanas, con luna en una sola', () => {
    for (const l of NOCHE) {
      const ventanas = salaPorId(l).acabados?.ventanas ?? [];
      expect(ventanas.length, l).toBeGreaterThanOrEqual(2);
      expect(
        ventanas.some((v) => v.pared === 'norte'),
        l,
      ).toBe(true);
      expect(
        ventanas.filter((v) => v.luna),
        l,
      ).toHaveLength(1);
    }
  });

  it('caben en su pared, sobre el zócalo, bajo la cornisa y sin tapar puertas ni tableros', () => {
    for (const l of NOCHE) {
      const sala = salaPorId(l);
      for (const v of sala.acabados?.ventanas ?? []) {
        const h = huecoDeVentana(v);
        const largo = v.pared === 'norte' || v.pared === 'sur' ? sala.ancho : sala.fondo;
        expect(h.desde).toBeGreaterThan(-largo / 2);
        expect(h.hasta).toBeLessThan(largo / 2);
        expect(h.abajo).toBeGreaterThan(1.05);
        // La cornisa ocupa los últimos 7 cm.
        expect(h.arriba).toBeLessThan(sala.alto - 0.07);
        for (const o of sala.objetos) {
          const p = enPared(sala, v.pared, o);
          if (p.distancia > (o.forma === 'plano' ? 0.1 : 0.4)) continue;
          // Puertas y tableros llevan marco a los lados y arriba (8 cm como mucho).
          const marco = o.forma === 'plano' && (esPuerta(o) || esTablero(o)) ? 0.08 : 0;
          if (p.hasta + marco <= h.desde || p.desde - marco >= h.hasta) continue;
          if (o.forma === 'plano') {
            // Puertas, tableros y cuadros pegados a esa pared, con sus marcos.
            const seCruzan = o.pos[1] < h.arriba && o.pos[1] + o.tam[1] + marco > h.abajo;
            expect(seCruzan, `${l}: ventana en ${v.centro} y ${o.id}`).toBe(false);
          } else {
            // Lo que se apoya contra esa pared queda por debajo, o del todo por encima (vigas).
            const debajo = o.pos[1] + o.tam[1] < h.abajo;
            const encima = o.pos[1] >= h.arriba;
            expect(debajo || encima, `${l}: ventana en ${v.centro} y ${o.id}`).toBe(true);
          }
        }
      }
    }
  });

  it('cada lado de la sala lleva la ventana a su pared', () => {
    const sala = { ancho: 6, fondo: 10 };
    expect(paredDeVentana(sala, { pared: 'norte', centro: 1 })).toMatchObject({
      a: 1,
      pared: { z: -5 },
    });
    expect(paredDeVentana(sala, { pared: 'sur', centro: 1 })).toMatchObject({
      a: -1,
      pared: { z: 5 },
    });
    expect(paredDeVentana(sala, { pared: 'oeste', centro: 2 })).toMatchObject({
      a: -2,
      pared: { x: -3 },
    });
    expect(paredDeVentana(sala, { pared: 'este', centro: 2 })).toMatchObject({
      a: 2,
      pared: { x: 3 },
    });
  });

  it('el cielo va con los difusores y el marco con lo fijo: ninguna malla nueva', () => {
    for (const l of NOCHE) {
      const sala = salaPorId(l);
      const sinVentanas: Sala = {
        ...sala,
        acabados: { ...(sala.acabados ?? never()), ventanas: [] },
      };
      const con = construirSala(sala);
      const sin = construirSala(sinVentanas);
      expect(con.mallas).toBe(sin.mallas);
      const ventanas = sala.acabados?.ventanas?.length ?? 0;
      expect(con.triangulos - sin.triangulos).toBeLessThan(200 * ventanas);
      // Los 5 del cooperativo con 4 jugadores (T83b).
      expect(con.mallas + 5).toBeLessThanOrEqual(LIMITES_PANEL.drawCalls);
      // El cielo queda en la pared, un poco adelante, y no recibe toques.
      const difusores = nombrada(con.raiz, 'difusores');
      difusores.geometry.computeBoundingBox();
      expect(difusores.geometry.boundingBox?.min.z).toBeGreaterThan(-sala.fondo / 2);
      expect(difusores.geometry.boundingBox?.max.z).toBeLessThan(sala.fondo / 2);
    }
  });

  it('los cerros quedan entre el 15 y el 42 % del vidrio', () => {
    for (let s = 1; s < 5; s++) {
      for (let x = -1; x <= 1; x += 0.05) {
        const y = alturaCerros(x, 0.75, s);
        expect(y).toBeGreaterThanOrEqual(0.75 * 0.15 - 1e-9);
        expect(y).toBeLessThanOrEqual(0.75 * 0.42 + 1e-9);
      }
    }
  });

  it('el esquema rechaza una ventana en una pared que no existe', () => {
    const s1 = salaPorId('s1-cooperativa');
    const malo = {
      ...s1,
      acabados: {
        ...s1.acabados,
        ventanas: [{ pared: 'arriba', centro: 0, y: 2, ancho: 1, alto: 0.5 }],
      },
    };
    expect(esquemaSala.safeParse(malo).success).toBe(false);
  });
});

/**
 * Dónde queda un objeto respecto a una pared: qué tan lejos está su cara más cercana y qué
 * tramo ocupa a lo largo de ella (x en norte y sur, z en oeste y este), con su giro.
 */
function enPared(
  sala: Pick<Sala, 'ancho' | 'fondo'>,
  pared: 'norte' | 'sur' | 'oeste' | 'este',
  o: Sala['objetos'][number],
): { distancia: number; desde: number; hasta: number } {
  const g = ((o.giro ?? 0) * Math.PI) / 180;
  const ancho = o.tam[0];
  const fondo = o.forma === 'cilindro' || o.forma === 'esfera' ? o.tam[0] : o.tam[2];
  const mx = (Math.abs(Math.cos(g)) * ancho + Math.abs(Math.sin(g)) * fondo) / 2;
  const mz = (Math.abs(Math.sin(g)) * ancho + Math.abs(Math.cos(g)) * fondo) / 2;
  const [x, , z] = o.pos;
  switch (pared) {
    case 'norte':
      return { distancia: z - mz + sala.fondo / 2, desde: x - mx, hasta: x + mx };
    case 'sur':
      return { distancia: sala.fondo / 2 - (z + mz), desde: x - mx, hasta: x + mx };
    case 'oeste':
      return { distancia: x - mx + sala.ancho / 2, desde: z - mz, hasta: z + mz };
    case 'este':
      return { distancia: sala.ancho / 2 - (x + mx), desde: z - mz, hasta: z + mz };
  }
}

function never(): never {
  throw new Error('la sala debía tener acabados');
}
