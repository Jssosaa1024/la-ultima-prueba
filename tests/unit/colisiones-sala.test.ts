import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { moverConColision, CAPSULA_JUGADOR } from '../../src/engine/jugador/colision';
import { cajasDeColision, marcarSolido } from '../../src/engine/salas/colisiones';
import { salaPorId } from '../../src/content/salas';
import { construirSala } from '../../src/engine/salas/construir';

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

  it('en la portería el jugador no sale del pasillo ni atraviesa el escritorio', () => {
    const { cajas } = construirSala(salaPorId('porteria'));
    // 4 paredes, el casillero, el escritorio y la silla.
    expect(cajas).toHaveLength(7);

    // Caminar de frente desde la entrada: se detiene contra la pared del fondo (z = −5).
    const frente = moverConColision(0, 4.2, 0, -20, 0, cajas);
    expect(frente.z).toBeCloseTo(-5 + CAPSULA_JUGADOR.radio);

    // Caminar hacia la derecha a la altura del escritorio: se detiene contra él (x = 1,6).
    const lado = moverConColision(0, 3.4, 20, 0, 0, cajas);
    expect(lado.x).toBeCloseTo(1.6 - CAPSULA_JUGADOR.radio);
  });
});
