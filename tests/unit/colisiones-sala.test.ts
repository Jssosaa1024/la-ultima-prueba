import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { moverConColision, CAPSULA_JUGADOR } from '../../src/engine/jugador/colision';
import { cajasDeColision, marcarSolido } from '../../src/engine/salas/colisiones';
import { crearEscenaProvisional } from '../../src/engine/salas/provisional';

describe('cajas de colisión generadas por código', () => {
  it('toma solo las mallas sólidas, en coordenadas del mundo', () => {
    const sala = new Group();
    sala.position.set(10, 0, 0);
    const mesa = marcarSolido(new Mesh(new BoxGeometry(2, 1, 1), new MeshBasicMaterial()));
    mesa.position.set(0, 0.5, -3);
    const adorno = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    sala.add(mesa, adorno);

    const cajas = cajasDeColision(sala);
    expect(cajas).toHaveLength(1);
    expect(cajas[0]).toEqual({ minX: 9, maxX: 11, minY: 0, maxY: 1, minZ: -3.5, maxZ: -2.5 });
  });

  it('un grupo sólido cubre todo lo que tiene adentro', () => {
    const estante = marcarSolido(new Group());
    const a = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const b = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    b.position.x = 2;
    estante.add(a, b);
    expect(cajasDeColision(estante)).toEqual([
      { minX: -0.5, maxX: 2.5, minY: -0.5, maxY: 0.5, minZ: -0.5, maxZ: 0.5 },
    ]);
  });

  it('en la escena provisional el jugador no sale del salón ni atraviesa la mesa', () => {
    const cajas = cajasDeColision(crearEscenaProvisional());
    // 4 paredes, la mesa y 2 cajas.
    expect(cajas).toHaveLength(7);

    // Caminar de frente desde el punto de partida: se detiene contra la mesa.
    const frente = moverConColision(0, 2.2, 0, -10, 0, cajas);
    expect(frente.z).toBeCloseTo(-1.1 + CAPSULA_JUGADOR.radio);

    // Caminar hacia la derecha: se detiene contra la pared (x = 4).
    const lado = moverConColision(0, 0, 20, 0, 0, cajas);
    expect(lado.x).toBeCloseTo(4 - CAPSULA_JUGADOR.radio);
  });
});
