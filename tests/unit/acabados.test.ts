import { describe, expect, it } from 'vitest';
import { AdditiveBlending, Raycaster, Vector3 } from 'three';
import type { Mesh, MeshBasicMaterial, Object3D } from 'three';
import { LUGARES, esquemaSala } from '../../src/content/esquema-salas';
import type { Sala } from '../../src/content/esquema-salas';
import { salaPorId } from '../../src/content/salas';
import { LIMITES_PANEL } from '../../src/debug/metricas';
import {
  crearAcabados,
  esPuerta,
  esTablero,
  lamparasDe,
  oclusionDe,
} from '../../src/engine/salas/acabados';
import { construirSala } from '../../src/engine/salas/construir';
import { CON_ARTE } from './sin-arte';

// T19j: acabados por código (zócalo, rodapié, cornisa, marcos, lámparas y rincones oscuros).

const sinAcabados = (sala: Sala): Sala => {
  const copia = { ...sala };
  delete copia.acabados;
  return copia;
};

const objeto = (sala: Sala, id: string) => {
  const o = sala.objetos.find((x) => x.id === id);
  if (!o) throw new Error(`falta ${id}`);
  return o;
};

const nombrada = (raiz: Object3D, nombre: string): Mesh => {
  const m = raiz.getObjectByName(nombre) as Mesh | undefined;
  if (!m) throw new Error(`falta ${nombre}`);
  return m;
};

describe('acabados de sala (T19j)', () => {
  it('las salas con arte los tienen, y el esquema rechaza un color raro', () => {
    for (const l of CON_ARTE) {
      expect(salaPorId(l).acabados).toBeDefined();
    }
    const s1 = salaPorId('s1-cooperativa');
    const malo = { ...s1, acabados: { zocalo: 'azul', franja: '#ffffff', marcos: '#000000' } };
    expect(esquemaSala.safeParse(malo).success).toBe(false);
    const incompleto = { ...s1, acabados: { zocalo: '#123456' } };
    expect(esquemaSala.safeParse(incompleto).success).toBe(false);
  });

  it('una sala sin acabados se arma igual que antes', () => {
    const { raiz } = construirSala(sinAcabados(salaPorId('s2-laboratorio')));
    expect(raiz.getObjectByName('difusores')).toBeUndefined();
    expect(raiz.getObjectByName('brillos')).toBeUndefined();
  });

  it.each(LUGARES)('%s: con acabados suma a lo sumo tres mallas', (l) => {
    const sala = salaPorId(l);
    const acabados = { zocalo: '#35618c', franja: '#e8b84a', marcos: '#4a3626' };
    const sin = construirSala(sinAcabados(sala));
    const con = construirSala({ ...sala, acabados });
    // Las dos de las lámparas, más la malla fija si la sala no tenía nada fijo de color plano
    // (en la portería y la sala 1 todo lo fijo lleva textura o modelo).
    const fija = sin.raiz.getObjectByName('fija') ? 0 : 1;
    expect(con.mallas).toBe(sin.mallas + 2 + fija);
    // Las cajas que chocan no cambian: nada de los acabados es sólido.
    expect(con.cajas).toEqual(sin.cajas);
    expect(con.triangulos - sin.triangulos).toBeLessThan(2_000);
    // Los 5 del cooperativo con 4 jugadores (T83b).
    expect(con.mallas + 5).toBeLessThanOrEqual(LIMITES_PANEL.drawCalls);
  });

  it('reparte las lámparas a lo largo del lado largo de la sala', () => {
    const porteria = lamparasDe(salaPorId('porteria'));
    expect(porteria.map((l) => l.x)).toEqual([0, 0, 0]);
    expect(porteria.map((l) => Number(l.z.toFixed(2)))).toEqual([-3.33, 0, 3.33]);
    const s1 = lamparasDe(salaPorId('s1-cooperativa'));
    expect(s1.map((l) => l.x)).toEqual([-1.75, 1.75]);
    expect(lamparasDe({ ancho: 2, fondo: 2 })).toHaveLength(1);
  });

  it('enmarca las puertas y los tableros grandes, no los modelos ni lo pequeño', () => {
    const porteria = salaPorId('porteria');
    const s1 = salaPorId('s1-cooperativa');
    expect(esPuerta(objeto(porteria, 'porteria-puerta-1'))).toBe(true);
    expect(esPuerta(objeto(porteria, 'porteria-salida'))).toBe(true);
    expect(esPuerta(objeto(s1, 's1-puerta'))).toBe(true);
    expect(esTablero(objeto(s1, 's1-pizarra'))).toBe(true);
    expect(esTablero(objeto(s1, 's1-corcho'))).toBe(true);
    expect(esTablero(objeto(porteria, 'porteria-mural'))).toBe(true);
    // El reloj y el intercomunicador son pequeños; los cuadros ya traen su marco en el modelo.
    expect(esTablero(objeto(porteria, 'porteria-reloj'))).toBe(false);
    expect(esTablero(objeto(porteria, 'porteria-intercomunicador'))).toBe(false);
    expect(esTablero(objeto(s1, 's1-cuadro-1'))).toBe(false);
    expect(esPuerta(objeto(s1, 's1-mostrador'))).toBe(false);
  });

  it('lo de color plano queda dentro de la sala, pegado a las paredes', () => {
    for (const l of CON_ARTE) {
      const sala = salaPorId(l);
      const { fijas } = crearAcabados(
        sala,
        sala.acabados ?? { zocalo: '', franja: '', marcos: '' },
      );
      // T19k: las ventanas y los difusores de las lámparas apagadas, si la sala los tiene.
      const extra = [
        ...(sala.acabados?.ventanas?.length ? ['ventanas'] : []),
        ...(sala.acabados?.lamparas?.includes('apagada') ? ['difusores-apagados'] : []),
      ];
      expect(fijas.map((m) => m.name)).toEqual([
        'zocalo',
        'franja',
        'marcos',
        'cornisa',
        'carcasas',
        ...extra,
      ]);
      for (const m of fijas) {
        m.geometry.computeBoundingBox();
        const caja = m.geometry.boundingBox;
        if (!caja) throw new Error('sin caja');
        // Los marcos de las puertas entran un poco en la pared (6 cm), nunca más que su grosor.
        expect(caja.min.x).toBeGreaterThanOrEqual(-sala.ancho / 2 - 0.1);
        expect(caja.max.x).toBeLessThanOrEqual(sala.ancho / 2 + 0.1);
        expect(caja.min.z).toBeGreaterThanOrEqual(-sala.fondo / 2 - 0.1);
        expect(caja.max.z).toBeLessThanOrEqual(sala.fondo / 2 + 0.1);
        expect(caja.min.y).toBeGreaterThan(-1e-6);
        expect(caja.max.y).toBeLessThanOrEqual(sala.alto + 1e-6);
      }
    }
  });

  it('la oclusión falsa mira hacia adentro de la sala', () => {
    const sala = salaPorId('porteria');
    const cuadros = oclusionDe(sala);
    // Por pared: piso, techo y sus dos esquinas.
    expect(cuadros).toHaveLength(16);
    const centro = new Vector3(0, sala.alto / 2, 0);
    for (const c of cuadros) {
      const [a, b, d] = c.esquinas.map(([x, y, z]) => new Vector3(x, y, z));
      if (!a || !b || !d) throw new Error('cuadro incompleto');
      const normal = b.clone().sub(a).cross(d.clone().sub(a));
      const medio = c.esquinas
        .reduce((s, [x, y, z]) => s.add(new Vector3(x, y, z)), new Vector3())
        .divideScalar(4);
      expect(normal.dot(centro.clone().sub(medio))).toBeGreaterThan(0);
      // El borde junto a la pared es el oscuro; el de adentro se desvanece.
      expect(c.uvs.map(([, v]) => v).filter((v) => v === 0)).toHaveLength(2);
      const lejania = (oscuros: boolean): number => {
        const lado = c.esquinas.filter((_, i) => (c.uvs[i]?.[1] ?? 0) > 0 === oscuros);
        expect(lado).toHaveLength(2);
        return lado.reduce((s, [x, , z]) => s + Math.hypot(x, z), 0) / lado.length;
      };
      expect(lejania(true)).toBeGreaterThan(lejania(false));
    }
  });

  it('las lámparas brillan sin luz propia y no reciben toques', () => {
    const { raiz } = construirSala(salaPorId('porteria'));
    const difusores = nombrada(raiz, 'difusores');
    const brillos = nombrada(raiz, 'brillos');
    expect((difusores.material as MeshBasicMaterial).toneMapped).toBe(false);
    const material = brillos.material as MeshBasicMaterial;
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    // Un rayo hacia el techo, justo debajo de una lámpara encendida (desde T19k la del medio
    // está apagada; la de la entrada, no), las atraviesa.
    const encendida = lamparasDe(salaPorId('porteria'))[2];
    if (!encendida) throw new Error('falta la lámpara de la entrada');
    const rayo = new Raycaster(new Vector3(encendida.x, 1.6, encendida.z), new Vector3(0, 1, 0));
    expect(rayo.intersectObjects([difusores])).toHaveLength(0);
    expect(rayo.intersectObjects([brillos])).toHaveLength(0);
    // Y uno hacia el cielo de una ventana (T19k), que también va en los difusores.
    const ventana = new Raycaster(new Vector3(-1.95, 2.55, 0), new Vector3(0, 0, -1));
    expect(ventana.intersectObjects([difusores, brillos])).toHaveLength(0);
    difusores.geometry.computeBoundingBox();
    expect(difusores.geometry.boundingBox?.min.z).toBeLessThan(-4.9);
    // Las sombras de contacto llevan también los 16 cuadros de la oclusión (4 vértices c/u).
    const sombras = nombrada(raiz, 'sombras');
    const conSombra = construirSala(sinAcabados(salaPorId('porteria'))).raiz;
    const antes = nombrada(conSombra, 'sombras').geometry.getAttribute('position').count;
    expect(sombras.geometry.getAttribute('position').count).toBe(antes + 16 * 4);
  });
});
