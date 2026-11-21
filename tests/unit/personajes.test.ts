import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import type { Mesh, Object3D, SkinnedMesh } from 'three';
import { crearModeloDePrueba } from '../../src/engine/coop/personaje-prueba';
import { crearPersonajes } from '../../src/engine/coop/personajes';

// T83c: los compañeros son personajes animados con el uniforme del color de su jugador.

/** Cámara en (0, 1,6, 0) mirando hacia −Z, como el jugador al empezar. */
function camara(): PerspectiveCamera {
  const c = new PerspectiveCamera(70, 16 / 9, 0.05, 50);
  c.position.set(0, 1.6, 0);
  c.updateMatrixWorld();
  return c;
}

/** Draw calls de lo que se ve: una por material de cada malla visible. */
function llamadas(raiz: Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    const m = o as Mesh;
    let visible = true;
    for (let p: Object3D | null = o; p; p = p.parent) visible &&= p.visible;
    if (m.isMesh && visible) n += Array.isArray(m.material) ? m.material.length : 1;
  });
  return n;
}

const mallas = (raiz: Object3D): SkinnedMesh[] => {
  const lista: SkinnedMesh[] = [];
  raiz.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) lista.push(o as SkinnedMesh);
  });
  return lista;
};

afterEach(() => vi.unstubAllGlobals());

describe('personaje de prueba hecho por código (T83c)', () => {
  it('cuatro estudiantes distintos, con esqueleto y menos de 2.000 triángulos cada uno', () => {
    const modelo = crearModeloDePrueba();
    expect(modelo.variantes).toHaveLength(4);
    for (const v of modelo.variantes) {
      const [cuerpo, ...otras] = mallas(v);
      expect(otras).toHaveLength(0);
      if (!cuerpo) throw new Error('sin malla');
      const triangulos = cuerpo.geometry.getAttribute('position').count / 3;
      expect(triangulos).toBeLessThan(2000);
      // La camiseta y las mangas van pintadas del color del jugador.
      const tinte = cuerpo.geometry.getAttribute('tinte');
      const marcados = Array.from(tinte.array).filter((t) => t === 1).length;
      expect(marcados).toBeGreaterThan(0);
      expect(marcados).toBeLessThan(tinte.count);
    }
    expect(Object.keys(modelo.clips)).toEqual(['quieto', 'caminar', 'saludar']);
    modelo.liberar();
  });
});

describe('personajes del cooperativo (T83c)', () => {
  it('cada compañero es una draw call y el mismo jugador sigue siendo el mismo personaje', () => {
    const p = crearPersonajes(crearModeloDePrueba());
    const c = camara();
    p.poner('j_a', 'coral', -1, 0, -4, 0, 0);
    p.poner('j_b', 'turquesa', 0, 0, -4, 0, 0);
    p.poner('j_c', 'violeta', 1, 0, -4, 0, 0);
    p.terminar(0, c);
    expect(llamadas(p.grupo)).toBe(3);
    expect(p.animados).toBe(3);
    // Colores distintos: personajes (raíces) distintos.
    const nombres = p.grupo.children.map((r) => r.children[0]?.name);
    expect(new Set(nombres).size).toBe(3);
    const antes = p.grupo.children.find((r) => r.name === 'personaje-coral');
    p.poner('j_a', 'coral', -1.1, 0, -4, 0, 16);
    p.terminar(16, c);
    expect(p.grupo.children.find((r) => r.name === 'personaje-coral')).toBe(antes);
    p.liberar();
  });

  it('solo se anima a los que están a la vista; los demás se ocultan', () => {
    const p = crearPersonajes(crearModeloDePrueba());
    const c = camara();
    p.poner('j_a', 'coral', 0, 0, -4, 0, 0); // al frente
    p.poner('j_b', 'ambar', 0, 0, 6, 0, 0); // a la espalda
    p.terminar(0, c);
    expect(p.animados).toBe(1);
    expect(p.estado('j_a')?.enVista).toBe(true);
    expect(p.estado('j_b')?.enVista).toBe(false);
    // Uno que no se puso en este cuadro (otra sala) tampoco se ve.
    p.poner('j_b', 'ambar', 0, 0, -3, 0, 16);
    p.terminar(16, c);
    expect(p.estado('j_a')?.enVista).toBe(false);
    expect(p.estado('j_b')?.enVista).toBe(true);
    expect(llamadas(p.grupo)).toBe(1);
    p.liberar();
  });

  it('camina mientras se mueve y vuelve a quieto al detenerse', () => {
    const p = crearPersonajes(crearModeloDePrueba());
    const c = camara();
    let t = 0;
    for (; t < 1200; t += 16) {
      p.poner('j_a', 'coral', (t / 1000) * 1.5, 0, -5, 0, t);
      p.terminar(t, c);
    }
    expect(p.estado('j_a')?.paso).toBe('caminar');
    for (const fin = t + 1500; t < fin; t += 16) {
      p.poner('j_a', 'coral', 1.8, 0, -5, 0, t);
      p.terminar(t, c);
    }
    expect(p.estado('j_a')?.paso).toBe('quieto');
    p.liberar();
  });

  it('saluda una vez si está a la vista, y no con prefers-reduced-motion', () => {
    const p = crearPersonajes(crearModeloDePrueba());
    const c = camara();
    p.poner('j_a', 'coral', 0, 0, -4, 0, 0);
    p.poner('j_b', 'ambar', 0, 0, 6, 0, 0);
    p.terminar(0, c);
    expect(p.saludar('j_b')).toBe(false);
    expect(p.saludar('j_a')).toBe(true);
    expect(p.estado('j_a')?.saluda).toBe(true);
    // El saludo dura 1,6 s y termina solo.
    for (let t = 16; t < 2000; t += 16) {
      p.poner('j_a', 'coral', 0, 0, -4, 0, t);
      p.terminar(t, c);
    }
    expect(p.estado('j_a')?.saluda).toBe(false);

    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(p.saludar('j_a')).toBe(false);
    p.liberar();
  });

  it('cambiar al modelo del paquete libera el anterior y recrea a los compañeros', () => {
    const prueba = crearModeloDePrueba();
    const liberar = vi.spyOn(prueba, 'liberar');
    const p = crearPersonajes(prueba);
    const c = camara();
    p.poner('j_a', 'coral', 0, 0, -4, 0, 0);
    p.terminar(0, c);
    const otro = { ...crearModeloDePrueba(), nombre: 'otro' };
    p.cambiarModelo(otro);
    expect(liberar).toHaveBeenCalledOnce();
    expect(p.modelo).toBe('otro');
    expect(p.grupo.children).toHaveLength(0);
    p.poner('j_a', 'coral', 0, 0, -4, 0, 16);
    p.terminar(16, c);
    expect(llamadas(p.grupo)).toBe(1);
    p.liberar();
  });
});
