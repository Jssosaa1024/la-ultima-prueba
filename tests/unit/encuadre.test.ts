import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { salaPorId } from '../../src/content/salas';
import {
  cajaDe,
  crearEncuadre,
  DURACION_ENCUADRE_S,
  FRACCION_LIBRE,
  grupoDeMaquina,
  MAQUINAS,
  poseDeEncuadre,
} from '../../src/engine/jugador/encuadre';
import { construirSala } from '../../src/engine/salas/construir';

// Corrección del 25 de noviembre: con el panel de una máquina abierto, la cámara se acerca y la
// deja en los dos tercios izquierdos; al cerrarlo, vuelve. Con movimiento reducido, corte directo.

const DT = 1 / 60;

function camaraJugador(): PerspectiveCamera {
  const c = new PerspectiveCamera(70, 16 / 9, 0.05, 50);
  c.position.set(0, 1.6, 2);
  c.updateMatrixWorld();
  return c;
}

describe('grupoDeMaquina', () => {
  it('encuadra el grupo del objeto que se usó, o el primero', () => {
    expect(grupoDeMaquina('s3-gimnasio', 's3-polea')).toContain('s3-polea');
    expect(grupoDeMaquina('s3-gimnasio', 's3-reflector')).toContain('s3-postes');
    expect(grupoDeMaquina('s3-gimnasio', null)).toContain('s3-postes');
    expect(grupoDeMaquina('porteria', 'porteria-salida')).toBeNull();
  });

  it('cada pieza nombrada existe en su sala', () => {
    for (const [lugar, grupos] of Object.entries(MAQUINAS)) {
      const ids = new Set(salaPorId(lugar as never).objetos.map((o) => o.id));
      for (const id of (grupos ?? []).flat()) expect(ids.has(id), `${lugar}: ${id}`).toBe(true);
    }
  });

  it('la caja de la etiquetadora sale de la sala armada', () => {
    const { raiz } = construirSala(salaPorId('s1-cooperativa'));
    raiz.updateMatrixWorld(true);
    const grupo = grupoDeMaquina('s1-cooperativa', 's1-palanca');
    const caja = grupo ? cajaDe(raiz, grupo) : null;
    expect(caja).not.toBeNull();
    expect(caja?.containsPoint(new Vector3(0.55, 1.1, -0.6))).toBe(true);
  });
});

describe('poseDeEncuadre', () => {
  const caja = new Box3(new Vector3(-0.3, 0.9, -1.2), new Vector3(0.3, 1.3, -0.8));

  it('se acerca desde el lado del jugador y mira el centro de la máquina', () => {
    const ojo = new Vector3(0, 1.6, 3);
    const { posicion, mira } = poseDeEncuadre(ojo, caja, 70, 16 / 9, FRACCION_LIBRE);
    expect(mira.toArray()).toEqual([0, 1.1, -1]);
    expect(posicion.distanceTo(mira)).toBeLessThan(ojo.distanceTo(mira));
    // Del mismo lado (+Z) y un poco por encima.
    expect(posicion.z).toBeGreaterThan(mira.z);
    expect(posicion.y).toBeGreaterThan(mira.y);
  });

  it('la máquina cabe en la parte libre de la pantalla', () => {
    const ojo = new Vector3(0, 1.6, 6);
    const { posicion, mira } = poseDeEncuadre(ojo, caja, 70, 16 / 9, FRACCION_LIBRE);
    const radio = caja.getSize(new Vector3()).length() / 2;
    const medioH = Math.atan(Math.tan((35 * Math.PI) / 180) * (16 / 9) * FRACCION_LIBRE);
    expect(Math.asin(radio / posicion.distanceTo(mira))).toBeLessThan(medioH);
  });

  it('nunca se aleja: si el jugador ya está cerca, se queda a esa distancia', () => {
    const ojo = new Vector3(0, 1.3, -0.55);
    const { posicion, mira } = poseDeEncuadre(ojo, caja, 70, 16 / 9, FRACCION_LIBRE);
    expect(posicion.distanceTo(mira)).toBeCloseTo(ojo.distanceTo(mira), 5);
  });
});

describe('crearEncuadre', () => {
  const objetivo = { posicion: new Vector3(0, 1.4, 0.2), mira: new Vector3(0, 1.1, -1) };

  it('se acerca suave, se queda encuadrada y vuelve a la cámara del jugador', () => {
    const jugador = camaraJugador();
    const e = crearEncuadre(() => false);
    expect(e.actualizar(DT, jugador)).toBe(jugador);
    expect(e.estado).toBe('libre');

    e.acercar(objetivo, FRACCION_LIBRE);
    const enCamino = e.actualizar(DURACION_ENCUADRE_S / 2, jugador);
    expect(e.estado).toBe('acercando');
    expect(enCamino).not.toBe(jugador);
    // A medio camino, entre el jugador y el destino.
    expect(enCamino.position.z).toBeLessThan(2);
    expect(enCamino.position.z).toBeGreaterThan(0.2);

    const llego = e.actualizar(DURACION_ENCUADRE_S, jugador);
    expect(e.estado).toBe('encuadrada');
    expect(llego.position.distanceTo(objetivo.posicion)).toBeLessThan(1e-6);
    // La máquina queda corrida a la izquierda: el cuadro se mueve a la derecha.
    for (let i = 0; i < 60; i++) e.actualizar(DT, jugador);
    expect(llego.view?.enabled).toBe(true);
    expect(llego.view?.offsetX).toBeCloseTo((1 - FRACCION_LIBRE) / 2, 2);
    // La cámara del jugador no se movió.
    expect(jugador.position.toArray()).toEqual([0, 1.6, 2]);

    e.volver();
    e.actualizar(DURACION_ENCUADRE_S / 2, jugador);
    expect(e.estado).toBe('volviendo');
    expect(e.actualizar(DURACION_ENCUADRE_S, jugador)).toBe(jugador);
    expect(e.estado).toBe('libre');
  });

  it('con movimiento reducido, corte directo al abrir y al cerrar', () => {
    const jugador = camaraJugador();
    const e = crearEncuadre(() => true);
    e.acercar(objetivo, FRACCION_LIBRE);
    expect(e.estado).toBe('encuadrada');
    const vista = e.actualizar(DT, jugador);
    expect(vista.position.distanceTo(objetivo.posicion)).toBeLessThan(1e-6);
    e.volver();
    expect(e.estado).toBe('libre');
    expect(e.actualizar(DT, jugador)).toBe(jugador);
  });
});
