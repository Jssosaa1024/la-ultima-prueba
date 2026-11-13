import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, PerspectiveCamera } from 'three';
import { crearInteraccion, marcarInteractivo } from '../../src/engine/interaccion/interaccion';
import { enfocado } from '../../src/signals/interfaz';
import { inventario } from '../../src/signals/partida';

/** Sala con una cámara en el origen mirando hacia −Z y objetos a distintas distancias. */
function montar() {
  const camara = new PerspectiveCamera(70, 1, 0.05, 50);
  camara.updateMatrixWorld();
  const sala = new Group();
  const compartido = new MeshLambertMaterial({ color: 0x336699 });
  const libro = marcarInteractivo(new Mesh(new BoxGeometry(0.4, 0.4, 0.4), compartido), {
    id: 'libro',
    nombre: 'Libro',
    accion: 'recoger',
  });
  libro.position.set(0, 0, -2);
  const otro = new Mesh(new BoxGeometry(1, 1, 1), compartido);
  otro.position.set(3, 0, -2);
  sala.add(libro, otro);
  sala.updateMatrixWorld(true);
  return { camara, sala, libro, otro, compartido };
}

afterEach(() => {
  enfocado.value = null;
  inventario.value = [];
});

describe('interacción con objetos', () => {
  it('tocar un objeto interactivo lo enfoca y lo resalta solo a él', () => {
    const { camara, sala, libro, otro, compartido } = montar();
    const interaccion = crearInteraccion(camara, sala);
    interaccion.tocar(0, 0);

    expect(enfocado.value).toEqual({ id: 'libro', nombre: 'Libro', accion: 'recoger' });
    expect(interaccion.seleccionado).toBe('libro');
    const materialLibro = libro.material as MeshLambertMaterial;
    expect(materialLibro.emissive.getHex()).not.toBe(0);
    // El material del otro objeto era el mismo, pero no se contagia.
    expect((otro.material as MeshLambertMaterial).emissive.getHex()).toBe(0);
    expect(compartido.emissive.getHex()).toBe(0);
    interaccion.liberar();
  });

  it('tocar el vacío suelta el objeto y apaga el resaltado', () => {
    const { camara, sala, libro } = montar();
    const interaccion = crearInteraccion(camara, sala);
    interaccion.tocar(0, 0);
    interaccion.tocar(0, 0.95);
    expect(enfocado.value).toBeNull();
    expect((libro.material as MeshLambertMaterial).emissive.getHex()).toBe(0);
    interaccion.liberar();
  });

  it('no alcanza objetos a más de 3 m', () => {
    const { camara, sala, libro } = montar();
    libro.position.z = -4;
    sala.updateMatrixWorld(true);
    const interaccion = crearInteraccion(camara, sala);
    interaccion.tocar(0, 0);
    expect(enfocado.value).toBeNull();
    interaccion.liberar();
  });

  it('una pared delante tapa el objeto', () => {
    const { camara, sala } = montar();
    const pared = new Mesh(new BoxGeometry(2, 2, 0.1), new MeshLambertMaterial());
    pared.position.z = -1;
    sala.add(pared);
    sala.updateMatrixWorld(true);
    const interaccion = crearInteraccion(camara, sala);
    interaccion.tocar(0, 0);
    expect(enfocado.value).toBeNull();
    interaccion.liberar();
  });

  it('al alejarse, el objeto deja de estar enfocado', () => {
    const { camara, sala } = montar();
    const interaccion = crearInteraccion(camara, sala);
    interaccion.tocar(0, 0);
    camara.position.z = 5;
    interaccion.actualizar();
    expect(enfocado.value).toBeNull();
    interaccion.liberar();
  });

  it('si la lógica vacía `enfocado`, se apaga el resaltado', () => {
    const { camara, sala, libro } = montar();
    const interaccion = crearInteraccion(camara, sala);
    interaccion.tocar(0, 0);
    enfocado.value = null;
    expect((libro.material as MeshLambertMaterial).emissive.getHex()).toBe(0);
    expect(interaccion.seleccionado).toBeNull();
    interaccion.liberar();
  });

  it('lo que entra al inventario desaparece y ya no se puede tocar', () => {
    const { camara, sala, libro } = montar();
    const interaccion = crearInteraccion(camara, sala);
    inventario.value = [{ id: 'libro', nombre: 'Libro' }];
    expect(libro.visible).toBe(false);
    interaccion.tocar(0, 0);
    expect(enfocado.value).toBeNull();
    interaccion.liberar();
  });
});
