import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import type { Object3D } from 'three';
import datos from '../../src/content/salas.json';
import { PUZZLES } from '../../src/content/puzzles';
import {
  LUGARES,
  esquemaSala,
  esquemaSalas,
  problemasDeSala,
  problemasDeSalas,
} from '../../src/content/esquema-salas';
import type { Sala } from '../../src/content/esquema-salas';
import { SALAS_3D, destinoDePuerta, nombreDeObjeto, salaPorId } from '../../src/content/salas';
import { CAPSULA_JUGADOR, resolverSolapes } from '../../src/engine/jugador/colision';
import { construirSala } from '../../src/engine/salas/construir';

/** Presupuesto por sala (AGENTS.md): 90.000 triángulos y 40 draw calls. */
const MAX_TRIANGULOS = 90_000;
const MAX_MALLAS = 40;

const copia = (): Sala[] => structuredClone(datos) as unknown as Sala[];

describe('distribución de las salas (salas.json)', () => {
  it('cumple el esquema y las reglas cruzadas', () => {
    const r = esquemaSalas.safeParse(datos);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual(
      [],
    );
    expect(problemasDeSalas(SALAS_3D)).toEqual([]);
  });

  it('tiene la portería y las cinco salas, con las medidas del documento de diseño', () => {
    expect(SALAS_3D.map((s) => s.id)).toEqual([...LUGARES]);
    const medidas = Object.fromEntries(SALAS_3D.map((s) => [s.id, [s.ancho, s.fondo]]));
    expect(medidas).toMatchObject({
      porteria: [6, 10],
      's1-cooperativa': [7, 5],
      's2-laboratorio': [9, 6],
      's3-gimnasio': [20, 12],
      's4-biblioteca': [10, 8],
      's5-rectoria': [6, 5],
    });
    expect(salaPorId('s3-gimnasio').alto).toBe(9);
  });

  it('cada objeto que nombra un puzzle existe en su sala y se puede tocar', () => {
    for (const puzzle of PUZZLES) {
      const sala = SALAS_3D.find((s) => s.id.startsWith(`s${puzzle.sala}-`));
      for (const { objeto } of Object.values(puzzle.pista_por_jugador)) {
        const o = sala?.objetos.find((x) => x.id === objeto);
        expect(o, `${objeto} (puzzle ${puzzle.id})`).toBeDefined();
        expect(o?.accion, `${objeto} debe tener acción`).toBeDefined();
      }
    }
  });

  it('las puertas llevan de la portería a cada sala y de vuelta', () => {
    expect(destinoDePuerta('porteria-puerta-1')).toBe('s1-cooperativa');
    expect(destinoDePuerta('porteria-puerta-5')).toBe('s5-rectoria');
    expect(destinoDePuerta('s3-puerta')).toBe('porteria');
    expect(destinoDePuerta('s1-palanca')).toBeNull();
    expect(destinoDePuerta('no-existe')).toBeNull();
    expect(nombreDeObjeto('porteria-linterna')).toBe('Linterna');
  });

  it('detecta errores típicos de edición', () => {
    const malas = copia();
    const s1 = malas[1];
    if (!s1) throw new Error('falta s1');
    s1.objetos.push(
      { id: 's1-mostrador', forma: 'caja', tam: [1, 1, 1], pos: [0, 0, 0], color: '#000000' },
      { id: 's2-intruso', forma: 'caja', tam: [1, 1, 1], pos: [0, 0, 0], color: '#000000' },
      {
        id: 's1-afuera',
        nombre: 'Afuera',
        forma: 'caja',
        tam: [1, 1, 1],
        pos: [10, 0, 0],
        color: '#000000',
        accion: 'usar',
      },
      {
        id: 's1-sin-nombre',
        forma: 'caja',
        tam: [1, 1, 1],
        pos: [0, 0, 0],
        color: '#000000',
        accion: 'usar',
      },
    );
    const mensajes = problemasDeSala(s1).map((p) => p.mensaje);
    expect(mensajes).toEqual(
      expect.arrayContaining([
        's1-mostrador: id repetido',
        expect.stringContaining('s2-intruso: los ids de esta sala empiezan por «s1-»'),
        's1-afuera: queda fuera de la sala',
        's1-sin-nombre: un objeto con acción necesita nombre',
      ]),
    );
    expect(esquemaSala.safeParse({ ...s1, colores: { ...s1.colores, piso: 'rojo' } }).success).toBe(
      false,
    );
  });
});

describe('salas armadas por código', () => {
  for (const sala of SALAS_3D) {
    it(`${sala.id}: cabe en el presupuesto, el jugador aparece libre y se ven sus objetos`, () => {
      const construida = construirSala(sala);
      expect(construida.triangulos).toBeLessThan(MAX_TRIANGULOS);
      expect(construida.mallas).toBeLessThanOrEqual(MAX_MALLAS);

      // El punto de inicio no queda dentro de un mueble ni pegado a una pared.
      const { x, z } = construida.inicio;
      const libre = resolverSolapes(x, z, 0, construida.cajas, CAPSULA_JUGADOR);
      expect(libre.x).toBeCloseTo(x);
      expect(libre.z).toBeCloseTo(z);

      // Cada objeto con acción está en la escena y marcado como interactivo.
      const interactivos = new Set<string>();
      construida.raiz.traverse((o: Object3D) => {
        const datos = o.userData['interactivo'] as { id: string } | undefined;
        if (datos) interactivos.add(datos.id);
      });
      const esperados = sala.objetos.filter((o) => o.accion).map((o) => o.id);
      expect([...interactivos].sort()).toEqual(esperados.sort());

      // Lo fijo quedó unido en una sola malla con colores por vértice.
      const fija = construida.raiz.getObjectByName('fija') as Mesh | undefined;
      expect(fija?.geometry.getAttribute('color')).toBeDefined();
    });
  }

  it('las paredes no dejan salir al jugador', () => {
    const { cajas } = construirSala(salaPorId('s5-rectoria'));
    // Caminar 20 m hacia el este desde el centro: se queda dentro (ancho 6 m).
    let p = { x: 0, z: 1.9 };
    for (let i = 0; i < 100; i++) p = resolverSolapes(p.x + 0.2, p.z, 0, cajas);
    expect(p.x).toBeCloseTo(3 - CAPSULA_JUGADOR.radio);
  });
});
