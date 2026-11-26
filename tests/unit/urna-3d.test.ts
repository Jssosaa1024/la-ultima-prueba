import { afterEach, describe, expect, it } from 'vitest';
import { CylinderGeometry, Group, InstancedMesh, Mesh, MeshLambertMaterial } from 'three';
import type { Object3D } from 'three';
import { animacionDeSala } from '../../src/engine/mecanismos';
import {
  alturaDeLaMano,
  animarUrna,
  DURACION_MANO,
  fichasDe,
  posicionDeFicha,
  sacarPareja,
} from '../../src/engine/mecanismos/urna';
import { panel, panelRecogido, reiniciarInterfaz } from '../../src/signals/interfaz';
import {
  etapa,
  maquinaResuelta,
  mecanismo,
  reiniciarMecanismo,
  resultado,
  type ResultadoMecanismo,
} from '../../src/signals/mecanismo';

// T70: las fichas dentro de la urna y la mano mecánica de la sala 5.

/** La rectoría, reducida a lo que usa la animación: el objeto `s5-urna`. */
function sala(): { raiz: Group; urna: Mesh } {
  const raiz = new Group();
  const urna = new Mesh(new CylinderGeometry(0.175, 0.175, 0.45), new MeshLambertMaterial());
  urna.name = 's5-urna';
  urna.position.set(-0.6, 0.75, -0.5);
  raiz.add(urna);
  return { raiz, urna };
}

const instancias = (raiz: Object3D, nombre: string): InstancedMesh =>
  raiz.getObjectByName(nombre) as InstancedMesh;

function enLaUrna(azules: number, amarillas: number, numero = 0): void {
  etapa.value = { sala: 's5-rectoria', puzzle: 's5-urna', etapa: numero };
  mecanismo.value = { azules, amarillas };
}

function tirarDeLaManija(n: number, azules: number, amarillas: number, resuelta = false): void {
  const r: ResultadoMecanismo = {
    n,
    sala: 's5-rectoria',
    puzzle: 's5-urna',
    etapa: 0,
    estado: { azules, amarillas },
    condiciones: { fichas: resuelta, juego: resuelta },
    resuelta,
    sello: false,
  };
  resultado.value = r;
}

afterEach(() => {
  reiniciarMecanismo();
  reiniciarInterfaz();
});

describe('fichas en la urna', () => {
  it('cada ficha tiene su sitio, sin encimarse, dentro de la urna', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const p = posicionDeFicha(i);
      vistos.add(`${p.x},${p.y.toFixed(4)},${p.z}`);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(0.175 - 0.035);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(0.45);
    }
    expect(vistos.size).toBe(20);
  });

  it('solo acepta ajustes con la forma de la urna', () => {
    expect(fichasDe({ azules: 3, amarillas: 1 })).toEqual({ azules: 3, amarillas: 1 });
    expect(fichasDe(null)).toEqual({ azules: 0, amarillas: 0 });
    expect(fichasDe({ azules: 99, amarillas: -1 })).toEqual({ azules: 0, amarillas: 0 });
    expect(fichasDe({ azules: '3', amarillas: 1.5 })).toEqual({ azules: 0, amarillas: 0 });
    expect(fichasDe({ carritos: [1, 2] })).toEqual({ azules: 0, amarillas: 0 });
  });

  it('muestra las fichas de los ajustes y sigue cada cambio', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz);
    expect(animacion.fichas).toEqual({ azules: 0, amarillas: 0 });
    expect(animacion.estado).toBe('0,0');

    enLaUrna(3, 1);
    expect(animacion.fichas).toEqual({ azules: 3, amarillas: 1 });
    // Lo que el motor escribe en `data-maquina` para las pruebas e2e.
    expect(animacion.estado).toBe('3,1');
    expect(instancias(raiz, 'fichas-azules').count).toBe(3);
    expect(instancias(raiz, 'fichas-amarillas').count).toBe(1);

    enLaUrna(6, 3);
    expect(instancias(raiz, 'fichas-azules').count).toBe(6);
    expect(instancias(raiz, 'fichas-amarillas').count).toBe(3);
    animacion.liberar();
  });

  it('no muestra los ajustes de la máquina de otra sala', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz);
    etapa.value = { sala: 's4-biblioteca', puzzle: 's4-carritos', etapa: 0 };
    mecanismo.value = { azules: 4, amarillas: 4 };
    expect(animacion?.fichas).toEqual({ azules: 0, amarillas: 0 });
    animacion?.liberar();
  });

  it('con la sala resuelta, quedan las fichas con las que se abrió la caja', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz);
    enLaUrna(6, 3, 2);
    tirarDeLaManija(5, 6, 3, true);
    etapa.value = null;
    mecanismo.value = null;
    expect(animacion?.fichas).toEqual({ azules: 6, amarillas: 3 });
    animacion?.liberar();
  });

  it('al volver a la sala ya resuelta, la urna tiene las fichas con las que quedó (T76)', () => {
    const { raiz } = sala();
    // Sin resultado en esta sesión (se continuó una partida guardada): vale lo conservado.
    etapa.value = null;
    mecanismo.value = null;
    maquinaResuelta.value = { azules: 6, amarillas: 3 };
    const animacion = animarUrna(raiz);
    expect(animacion.fichas).toEqual({ azules: 6, amarillas: 3 });
    expect(animacion.estado).toBe('6,3');
    // La mano no juega sola al entrar.
    expect(animacion.manoActiva).toBe(false);
    animacion.liberar();
  });

  it('la urna queda translúcida, para ver las fichas', () => {
    const { raiz, urna } = sala();
    animarUrna(raiz)?.liberar();
    const material = urna.material as MeshLambertMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(1);
  });

  it('sin el objeto de la urna no agrega ni anima nada', () => {
    const raiz = new Group();
    const animacion = animarUrna(raiz);
    enLaUrna(3, 1);
    animacion.actualizar(1);
    expect(raiz.children).toHaveLength(0);
    expect(animacion.fichas).toEqual({ azules: 0, amarillas: 0 });
    animacion.liberar();
  });

  it('el motor la crea para la rectoría, y en una portería sin mural no anima nada', () => {
    const { raiz } = sala();
    const animacion = animacionDeSala('s5-rectoria', raiz);
    expect(animacion?.estado).toBe('0,0');
    animacion?.liberar();
    // La portería tiene animación (el mural, hito 1 punto 16), pero sin su mural no hace nada.
    expect(animacionDeSala('porteria', new Group())?.estado).toBe('sin-piezas');
  });
});

describe('mano mecánica', () => {
  it('saca dos fichas sin devolver la primera', () => {
    expect(sacarPareja({ azules: 1, amarillas: 0 })).toBeNull();
    expect(sacarPareja({ azules: 3, amarillas: 0 })).toEqual([true, true]);
    expect(sacarPareja({ azules: 1, amarillas: 1 }, () => 0.1)).toEqual([true, false]);
    expect(sacarPareja({ azules: 1, amarillas: 1 }, () => 0.9)).toEqual([false, true]);
  });

  it('baja hasta la urna, sube y vuelve a su sitio', () => {
    const reposo = alturaDeLaMano(0);
    expect(alturaDeLaMano(0.25)).toBeLessThan(reposo);
    expect(alturaDeLaMano(0.5)).toBeLessThan(alturaDeLaMano(0.25));
    expect(alturaDeLaMano(0.75)).toBeGreaterThan(alturaDeLaMano(0.5));
    expect(alturaDeLaMano(1.2)).toBe(reposo);
    expect(alturaDeLaMano(DURACION_MANO)).toBe(reposo);
  });

  it('con el panel recogido en su pestaña, la mano juega a la vista (correcciones del 25 nov)', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz, () => 0.1);
    enLaUrna(3, 1);
    panel.value = 'mecanismo';
    tirarDeLaManija(1, 3, 1);
    expect(animacion.manoActiva).toBe(false);
    panelRecogido.value = true;
    expect(animacion.manoActiva).toBe(true);
    animacion.liberar();
  });

  it('juega cuando se tira de la manija, pero espera a que se cierre el panel', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz, () => 0.1);
    enLaUrna(3, 1);
    panel.value = 'mecanismo';
    tirarDeLaManija(1, 3, 1);
    animacion.actualizar(0.1);
    expect(animacion.manoActiva).toBe(false);

    panel.value = null;
    expect(animacion.manoActiva).toBe(true);
    const mano = raiz.getObjectByName('mano-mecanica');
    const reposo = mano?.position.y ?? 0;
    animacion.actualizar(0.5);
    expect(mano?.position.y).toBeLessThan(reposo);
    // Con las fichas en la pinza: dos azules (el azar fijo saca siempre azul).
    animacion.actualizar(0.6);
    const visibles = mano?.children.filter((o) => o.visible).length ?? 0;
    expect(visibles).toBe(4); // brazo, pinza y dos fichas
    animacion.actualizar(DURACION_MANO);
    expect(animacion.manoActiva).toBe(false);
    expect(mano?.position.y).toBe(reposo);
    expect(mano?.children.filter((o) => o.visible)).toHaveLength(2);
    animacion.liberar();
  });

  it('un resultado anterior a entrar a la sala no se vuelve a animar', () => {
    tirarDeLaManija(7, 3, 0);
    const { raiz } = sala();
    const animacion = animarUrna(raiz);
    expect(animacion?.manoActiva).toBe(false);
    animacion?.liberar();
  });

  it('el resultado de la máquina de otra sala no mueve la mano', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz);
    resultado.value = {
      n: 3,
      sala: 's1-cooperativa',
      puzzle: 's1-etiquetadora',
      etapa: 0,
      estado: { producto: 'jugo', precio: 2000, rodillos: [] },
      condiciones: { precio: false },
      resuelta: false,
      sello: false,
    };
    expect(animacion?.manoActiva).toBe(false);
    animacion?.liberar();
  });

  it('al liberar se quita de la sala y deja de seguir los signals', () => {
    const { raiz } = sala();
    const animacion = animarUrna(raiz);
    animacion?.liberar();
    expect(raiz.getObjectByName('urna-animacion')).toBeUndefined();
    enLaUrna(5, 5);
    expect(animacion?.fichas).toEqual({ azules: 0, amarillas: 0 });
  });
});
