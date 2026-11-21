import { describe, expect, it } from 'vitest';
import type { Mesh } from 'three';
import { esquemaSala, esquemaSalas, LUGARES, medioTamano } from '../../src/content/esquema-salas';
import type { ObjetoSala, Sala } from '../../src/content/esquema-salas';
import type { LineaGuion } from '../../src/content/esquema-guion';
import guion from '../../src/content/guion.json';
import { FRASES_PUERTAS_FALSAS, frasePuertaFalsa } from '../../src/content/puertas-falsas';
import { esquemaFrasePuertaFalsa } from '../../src/content/esquema-puertas-falsas';
import { SALAS_3D, salaPorId } from '../../src/content/salas';
import { rectangulosDe } from '../../src/content/tramos';
import { PUZZLES } from '../../src/content/puzzles';
import { leerGuardado } from '../../src/game/guardado';
import { aplicar, crearPartida, type Accion } from '../../src/game/partida';
import {
  CAPSULA_JUGADOR,
  moverConColision,
  resolverSolapes,
} from '../../src/engine/jugador/colision';
import { VELOCIDAD } from '../../src/engine/jugador/movimiento';
import { lamparasDeSala, paredesDeSala } from '../../src/engine/salas/acabados';
import { construirSala } from '../../src/engine/salas/construir';
import { esquinasDeAfuera, paredesDeRectangulos } from '../../src/engine/salas/planta';
import { ORDEN_SALAS, puntoDeEntrada } from '../../src/engine/salas/recorrido';
import {
  celdasDe,
  segmentosDeParedes,
  seVe,
  visiblesPorCelda,
} from '../../src/engine/salas/visibilidad';
import { crearVistaPorCeldas } from '../../src/engine/salas/vista-por-celdas';

// El pasillo en U de la portería (docs/pasillos.md).

const porteria = salaPorId('porteria');
const copia = (): Sala[] => JSON.parse(JSON.stringify(SALAS_3D)) as Sala[];
const puertasDelPasillo = (): ObjetoSala[] => porteria.objetos.filter((o) => o.puerta || o.falsa);
const GRADOS = Math.PI / 180;

/** Recorrido del plano: del inicio al vano, el tramo 1 al norte, el 2 al oeste y el 3 al sur. */
const RECORRIDO: [number, number][] = [
  [0, 4.2],
  [0, 0],
  [-4.6, 0],
  [-4.6, -8.4],
  [-14.6, -8.4],
  [-14.6, 0.18],
];

describe('planta con tramos', () => {
  it('un rectángulo solo da sus cuatro paredes, todas con rincones', () => {
    const paredes = paredesDeRectangulos([{ x: [-3, 3], z: [-5, 5] }]);
    expect(paredes).toHaveLength(4);
    expect(paredes.map((p) => p.largo).sort((a, b) => a - b)).toEqual([6, 6, 10, 10]);
    for (const p of paredes) expect(p.rincones).toEqual([true, true]);
    expect(esquinasDeAfuera([{ x: [-3, 3], z: [-5, 5] }], 0.2)).toHaveLength(4);
  });

  it('donde dos rectángulos se tocan no hay pared, y la punta de un vano no es rincón', () => {
    // Una L: un cuarto de 4 × 4 y un brazo de 2 m de ancho hacia el oeste.
    const paredes = paredesDeRectangulos([
      { x: [0, 4], z: [0, 4] },
      { x: [-6, 0], z: [1, 3] },
    ]);
    // Nada cruza la junta (x = 0, de z = 1 a 3).
    const enLaJunta = paredes.filter(
      (p) => Math.abs(p.x) < 1e-9 && p.z - p.largo / 2 < 3 - 1e-9 && p.z + p.largo / 2 > 1 + 1e-9,
    );
    expect(enLaJunta).toEqual([]);
    // El cuarto pierde su pared oeste entera y gana dos tramos (z de 0 a 1 y de 3 a 4).
    const oeste = paredes.filter((p) => Math.abs(p.x) < 1e-9).map((p) => p.largo);
    expect(oeste.sort()).toEqual([1, 1]);
    // Cada tramo corto tiene un rincón (en la esquina del cuarto) y una punta que sobresale.
    for (const p of paredes.filter((q) => Math.abs(q.x) < 1e-9)) {
      expect(p.rincones.filter(Boolean)).toHaveLength(1);
    }
    // Las caras miran hacia adentro: la normal (sen giro, cos giro) apunta al piso.
    for (const p of paredes) {
      const x = p.x + Math.sin(p.giro) * 0.1;
      const z = p.z + Math.cos(p.giro) * 0.1;
      const rects: [number, number, number, number][] = [
        [0, 4, 0, 4],
        [-6, 0, 1, 3],
      ];
      const adentro = rects.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
      expect(adentro).toBe(true);
    }
  });

  it('una sala sin tramos se arma igual que antes', () => {
    const s1 = salaPorId('s1-cooperativa');
    expect(s1.tramos).toBeUndefined();
    expect(paredesDeSala(s1)).toHaveLength(4);
    expect(lamparasDeSala(s1)).toHaveLength(2);
  });
});

describe('el pasillo en los datos', () => {
  it('es parte de la portería: no hay lugar nuevo, y el resto del archivo cumple el esquema', () => {
    expect(LUGARES).not.toContain('pasillo');
    expect(porteria.tramos).toHaveLength(4);
    expect(esquemaSalas.safeParse(SALAS_3D).success).toBe(true);
    // Solo la portería tiene tramos.
    expect(SALAS_3D.filter((s) => s.tramos).map((s) => s.id)).toEqual(['porteria']);
  });

  it('cinco puertas reales en orden y siete falsas, cada una con su frase', () => {
    const reales = porteria.objetos.filter((o) => o.puerta);
    expect(reales.map((o) => o.puerta)).toEqual([...ORDEN_SALAS]);
    expect(reales.map((o) => o.id)).toEqual(ORDEN_SALAS.map((_, i) => `porteria-puerta-${i + 1}`));
    const falsas = porteria.objetos.filter((o) => o.falsa);
    expect(falsas).toHaveLength(7);
    for (const o of falsas) {
      expect(o.id.startsWith('pasillo-puerta-'), o.id).toBe(true);
      expect(o.accion).toBe('usar');
      const frase = frasePuertaFalsa(o.falsa ?? '');
      expect(frase, o.id).not.toBeNull();
      expect(o.nombre).toBe(frase?.rotulo);
    }
    // Cada frase la usa una sola puerta.
    expect(falsas.map((o) => o.falsa).sort()).toEqual(
      FRASES_PUERTAS_FALSAS.map((f) => f.id).sort(),
    );
  });

  it('cada puerta está pegada a una pared del pasillo, mirando hacia adentro, sin chocar con otra', () => {
    const paredes = paredesDeSala(porteria);
    const puertas = puertasDelPasillo();
    for (const o of puertas) {
      const g = (o.giro ?? 0) * GRADOS;
      // Su cara mira hacia (sen g, cos g); la pared queda 2 cm detrás.
      const atras = { x: o.pos[0] - Math.sin(g) * 0.02, z: o.pos[2] - Math.cos(g) * 0.02 };
      const pared = paredes.find(
        (p) =>
          Math.abs(Math.sin(p.giro) - Math.sin(g)) < 1e-6 &&
          Math.abs(Math.cos(p.giro) - Math.cos(g)) < 1e-6 &&
          Math.abs((atras.x - p.x) * Math.sin(g) + (atras.z - p.z) * Math.cos(g)) < 1e-6 &&
          Math.abs((atras.x - p.x) * Math.cos(g) - (atras.z - p.z) * Math.sin(g)) <=
            p.largo / 2 - 0.63,
      );
      expect(pared, `${o.id} no está contra una pared`).toBeDefined();
    }
    // Dos puertas de la misma pared quedan a 1,7 m o más (el marco mide 1,26 m).
    for (const a of puertas) {
      for (const b of puertas) {
        if (a === b || a.giro !== b.giro) continue;
        const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
        if (d < 0.1) throw new Error(`${a.id} y ${b.id} están en el mismo sitio`);
        if (Math.abs(a.pos[0] - b.pos[0]) < 1e-6 || Math.abs(a.pos[2] - b.pos[2]) < 1e-6) {
          expect(d, `${a.id} y ${b.id}`).toBeGreaterThanOrEqual(1.7);
        }
      }
    }
  });

  it('cada puerta tiene su cartel encima y hay tres flechas', () => {
    for (const o of puertasDelPasillo()) {
      const clave = o.puerta ? `s${o.id.slice(-1)}` : o.id.replace('pasillo-puerta-', '');
      const cartel = porteria.objetos.find((x) => x.id === `pasillo-cartel-${clave}`);
      expect(cartel, o.id).toBeDefined();
      expect(cartel?.lamina?.tipo).toBe('cartel');
      expect(cartel?.pos[0]).toBe(o.pos[0]);
      expect(cartel?.pos[2]).toBe(o.pos[2]);
      // Encima del marco (2,28 m) y de la luz de la puerta (hasta 2,40 m).
      expect(cartel?.pos[1]).toBeGreaterThan(2.4);
    }
    const flechas = porteria.objetos.filter((o) => o.id.startsWith('pasillo-flecha-'));
    // La flecha va dibujada como figura (`flecha`), no como «←»: la letra no trae ese signo.
    expect(flechas.map((o) => [o.lamina?.titulo, o.lamina?.flecha])).toEqual([
      ['SALAS 1 A 5', undefined],
      ['SALAS 3 A 5', 'izquierda'],
      ['SALAS 4 Y 5', 'izquierda'],
    ]);
  });

  it('el esquema rechaza tramos que se montan, puertas falsas que llevan a una sala y objetos fuera', () => {
    const base = copia()[0] as Sala;
    const tramos = base.tramos ?? [];
    expect(esquemaSala.safeParse(base).success).toBe(true);
    const montado = { ...base, tramos: [...tramos, { x: [-1, 1], z: [-1, 1] }] };
    expect(esquemaSala.safeParse(montado).success).toBe(true); // el esquema solo ve la forma…
    expect(esquemaSalas.safeParse([montado, ...copia().slice(1)]).success).toBe(false); // …las reglas, el resto
    const alReves = { ...base, tramos: [{ x: [1, -1], z: [0, 1] }] };
    expect(esquemaSala.safeParse(alReves).success).toBe(false);

    const salas = copia();
    const falsa = salas[0]?.objetos.find((o) => o.falsa);
    if (!falsa) throw new Error('sin puertas falsas');
    falsa.puerta = 's1-cooperativa';
    expect(esquemaSalas.safeParse(salas).success).toBe(false);

    const fuera = copia();
    const cartel = fuera[0]?.objetos.find((o) => o.id === 'pasillo-cartel-10a');
    if (!cartel) throw new Error('sin cartel');
    cartel.pos = [-8, 2.44, -3]; // dentro de la U, que no es piso
    expect(esquemaSalas.safeParse(fuera).success).toBe(false);

    const enOtraSala = copia();
    const s1 = enOtraSala[1];
    if (!s1) throw new Error('sin s1');
    s1.tramos = [{ x: [3.5, 5], z: [-1, 1] }];
    expect(esquemaSalas.safeParse(enOtraSala).success).toBe(false);
  });

  it('cuatro frases las dice La Voz, cada una con su línea del guion', () => {
    const conVoz = FRASES_PUERTAS_FALSAS.filter((f) => f.voz);
    expect(conVoz).toHaveLength(4);
    const lineas = (guion as LineaGuion[]).filter((l) => l.momento === 'puerta_falsa');
    expect(conVoz.map((f) => f.voz).sort()).toEqual(lineas.map((l) => l.id).sort());
    for (const l of lineas) expect(l.sala).toBe('porteria');
  });

  it('las frases son cortas, una por puerta, y llevan texto o voz', () => {
    for (const f of FRASES_PUERTAS_FALSAS) {
      expect(esquemaFrasePuertaFalsa.safeParse(f).success, f.id).toBe(true);
    }
    expect(esquemaFrasePuertaFalsa.safeParse({ id: 'x', rotulo: 'X' }).success).toBe(false);
    expect(
      esquemaFrasePuertaFalsa.safeParse({ id: 'x', rotulo: 'X', texto: 'a', voz: 'voz-x' }).success,
    ).toBe(false);
    expect(frasePuertaFalsa('no-existe')).toBeNull();
    expect(frasePuertaFalsa('__proto__')).toBeNull();
  });
});

describe('el pasillo armado', () => {
  const construida = construirSala(porteria);

  it('se camina de la portería a cada puerta sin atravesar paredes', () => {
    let p = { x: RECORRIDO[0]?.[0] ?? 0, z: RECORRIDO[0]?.[1] ?? 0 };
    for (const [x, z] of RECORRIDO.slice(1)) {
      // Pasos cortos hacia el siguiente punto, como el joystick.
      for (let i = 0; i < 400 && Math.hypot(x - p.x, z - p.z) > 0.01; i++) {
        const d = Math.min(0.1, Math.hypot(x - p.x, z - p.z));
        const a = Math.atan2(z - p.z, x - p.x);
        p = moverConColision(p.x, p.z, Math.cos(a) * d, Math.sin(a) * d, 0, construida.cajas);
      }
      expect(p.x, `llega a ${x}, ${z}`).toBeCloseTo(x, 1);
      expect(p.z, `llega a ${x}, ${z}`).toBeCloseTo(z, 1);
    }
    // Al volver de cada sala se aparece libre, en el piso del pasillo.
    for (const sala of ORDEN_SALAS) {
      const e = puntoDeEntrada(porteria, sala);
      const libre = resolverSolapes(e.x, e.z, 0, construida.cajas, CAPSULA_JUGADOR);
      expect(libre.x, sala).toBeCloseTo(e.x);
      expect(libre.z, sala).toBeCloseTo(e.z);
    }
  });

  it('las paredes no dejan salir del pasillo ni entrar a la U', () => {
    // Desde el tramo 1, 20 m hacia el oeste: choca con la pared de la U (x = −5,8).
    const oeste = moverConColision(-4.6, -5, -20, 0, 0, construida.cajas);
    expect(oeste.x).toBeCloseTo(-5.8 + CAPSULA_JUGADOR.radio);
    // Desde el tramo 3, 20 m hacia el sur: choca con la puerta 5 (z = 1,2).
    const sur = moverConColision(-14.6, -2, 0, 20, 0, construida.cajas);
    expect(sur.z).toBeCloseTo(1.2 - CAPSULA_JUGADOR.radio);
  });

  it('de punta a punta se camina en menos de 20 s con el joystick a fondo', () => {
    // Del vano a la puerta 5, más 1,5 s por cada una de las dos esquinas.
    const tramo = RECORRIDO.slice(2);
    let metros = Math.hypot(-4.6 - -3.2, 0);
    for (let i = 1; i < tramo.length; i++) {
      const [ax = 0, az = 0] = tramo[i - 1] ?? [];
      const [bx = 0, bz = 0] = tramo[i] ?? [];
      metros += Math.hypot(bx - ax, bz - az);
    }
    const segundos = metros / VELOCIDAD + 2 * 1.5;
    expect(segundos).toBeGreaterThan(12);
    expect(segundos).toBeLessThan(20);
  });

  it('trece lámparas con su estado: tres titilan en el pasillo y el vano no lleva', () => {
    const lamparas = lamparasDeSala(porteria);
    const estados = porteria.acabados?.lamparas ?? [];
    expect(lamparas).toHaveLength(estados.length);
    expect(lamparas).toHaveLength(3 + 3 + 3 + 2);
    const delPasillo = estados.slice(3);
    expect(delPasillo.filter((e) => e === 'titila')).toHaveLength(3);
    expect(delPasillo.filter((e) => e === 'apagada')).toHaveLength(2);
    // Ninguna lámpara en el vano (x de −3,4 a −3).
    expect(lamparas.filter((l) => l.x > -3.4 && l.x < -3)).toEqual([]);
  });

  it('desde la portería no se ve ninguna puerta del pasillo', () => {
    const rects = rectangulosDe(porteria);
    const paredes = segmentosDeParedes(paredesDeRectangulos(rects));
    const celdas = celdasDe([rects[0] ?? { x: [0, 0], z: [0, 0] }]);
    const puertas = puertasDelPasillo();
    const huellas = puertas.map((o) => {
      const m = medioTamano(o);
      return {
        minX: o.pos[0] - m.x,
        maxX: o.pos[0] + m.x,
        minZ: o.pos[2] - m.z,
        maxZ: o.pos[2] + m.z,
      };
    });
    const vistas = visiblesPorCelda(celdas, huellas, paredes).flat();
    expect(vistas.map((i) => puertas[i]?.id)).toEqual([]);
    // Y por el vano sí se ve el tramo 1.
    expect(seVe(0, 0, -5.5, -1, paredes)).toBe(true);
    expect(seVe(0, 0, -4.6, -6, paredes)).toBe(false);
  });

  it('la vista por celdas deja de dibujar lo que no se ve y lo devuelve al salir', () => {
    const { raiz } = construirSala(porteria);
    const vista = crearVistaPorCeldas(raiz, porteria);
    if (!vista) throw new Error('sin vista');
    const dibujada = (id: string): boolean => {
      let si = false;
      raiz.getObjectByName(id)?.traverse((o) => {
        if ((o as Mesh).isMesh && o.layers.isEnabled(0)) si = true;
      });
      return si;
    };
    vista.actualizar(0, 4.2);
    expect(dibujada('porteria-escritorio')).toBe(true);
    expect(dibujada('porteria-puerta-5')).toBe(false);
    expect(vista.ocultos).toBeGreaterThan(10);
    vista.actualizar(-14.6, 0);
    expect(dibujada('porteria-puerta-5')).toBe(true);
    expect(dibujada('porteria-escritorio')).toBe(false);
    vista.liberar();
    expect(dibujada('porteria-escritorio')).toBe(true);
    // Lo fijo, el piso y las paredes se dibujan siempre.
    vista.actualizar(-14.6, 0);
    expect(dibujada('fija') || dibujada('paredes')).toBe(true);
    // La tabla se calcula una vez y queda con la portería.
    expect(raiz.userData['vistaPorCeldas']).toBeDefined();
    expect(
      crearVistaPorCeldas(
        construirSala(salaPorId('s1-cooperativa')).raiz,
        salaPorId('s1-cooperativa'),
      ),
    ).toBeNull();
  });
});

describe('una partida guardada antes del pasillo', () => {
  it('se sigue leyendo: el lugar es la portería y el jugador aparece en su inicio', () => {
    // El guardado no cambia con el pasillo (sigue siendo el lugar «porteria»): un JSON escrito
    // por la versión anterior, con la sala 1 resuelta y el jugador de vuelta en la portería.
    const partida = [
      { t: 'entrar', sala: 's1-cooperativa' },
      { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 0 },
      { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 1 },
      { t: 'resolver_etapa', sala: 's1-cooperativa', etapa: 2 },
      { t: 'volver_porteria' },
    ].reduce((p, a) => aplicar(p, a as Accion), crearPartida());
    const viejo = JSON.parse(
      JSON.stringify({
        v: 2,
        partida,
        restanteMs: 30 * 60 * 1000,
        pistas: { 's1-cooperativa': { msEnEtapa: 0, intentosEnEtapa: 0, ofrecidas: 0, vistas: 0 } },
        mecanismos: {},
        resueltas: { 's1-cooperativa': { producto: 'combo', precio: 4000, rodillos: [50, -50] } },
        notas: [],
        datos: [],
        inventario: ['porteria-linterna', 'porteria-cuaderno'],
      }),
    ) as unknown;
    const leido = leerGuardado(viejo, PUZZLES);
    expect(leido?.partida.lugar).toBe('porteria');
    // Al reanudar en la portería se aparece en su inicio, dentro del vestíbulo.
    expect(puntoDeEntrada(porteria, null)).toEqual({ x: 0, z: 4.2, yaw: 0 });
  });
});
