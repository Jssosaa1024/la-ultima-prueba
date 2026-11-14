import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene } from 'three';
import type { Mesh, Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { adelante } from '../../src/engine/jugador/camara';
import { crearCargadorSalas } from '../../src/engine/salas/cargador';
import { construirSala } from '../../src/engine/salas/construir';
import { puntoDeEntrada, siguienteSala } from '../../src/engine/salas/recorrido';
import { carga } from '../../src/signals/interfaz';

/** Renderer falso: cada compilación queda pendiente hasta que la prueba la suelte. */
function rendererFalso() {
  const pendientes: (() => void)[] = [];
  return {
    compilados: 0,
    automatico: true,
    compileAsync(): Promise<void> {
      this.compilados++;
      if (this.automatico) return Promise.resolve();
      return new Promise<void>((r) => pendientes.push(r));
    },
    soltarTodo() {
      pendientes.splice(0).forEach((r) => r());
    },
  };
}

function montar() {
  const renderer = rendererFalso();
  const escena = new Scene();
  const cargador = crearCargadorSalas({
    renderer,
    escena,
    camara: new PerspectiveCamera(),
    distribucion: salaPorId,
    construir: construirSala,
  });
  return { renderer, escena, cargador };
}

/** Cuenta las geometrías liberadas con `dispose()` dentro de `raiz`. */
function contarLiberadas(raiz: Object3D): { total: number; liberadas: () => number } {
  let liberadas = 0;
  let total = 0;
  raiz.traverse((o) => {
    const malla = o as Mesh;
    if (!malla.isMesh) return;
    total++;
    malla.geometry.addEventListener('dispose', () => liberadas++);
  });
  return { total, liberadas: () => liberadas };
}

afterEach(() => {
  carga.value = { estado: 'inactiva', progreso: 0 };
});

describe('cargador de salas', () => {
  it('compila antes de mostrar y avisa la carga por el signal', async () => {
    const { renderer, escena, cargador } = montar();
    renderer.automatico = false;
    const entrando = cargador.entrar('porteria');
    expect(carga.value.estado).toBe('cargando');
    expect(escena.children).toHaveLength(0);
    renderer.soltarTodo();
    const sala = await entrando;
    expect(sala?.id).toBe('porteria');
    expect(escena.children).toEqual([sala?.raiz]);
    expect(renderer.compilados).toBe(1);
    expect(carga.value).toEqual({ estado: 'lista', progreso: 1 });
  });

  it('en la GPU solo quedan la portería y la sala actual: las demás se liberan', async () => {
    const { escena, cargador } = montar();
    const porteria = await cargador.entrar('porteria');
    const s1 = await cargador.entrar('s1-cooperativa');
    if (!porteria || !s1) throw new Error('no cargó');
    // La portería salió de la escena, pero queda en espera, sin liberar.
    expect(escena.children).toEqual([s1.raiz]);
    expect(cargador.enEspera).toEqual(['porteria']);

    const vigiladaS1 = contarLiberadas(s1.raiz);
    const vigiladaPorteria = contarLiberadas(porteria.raiz);
    const deVuelta = await cargador.entrar('porteria');
    // Se reutiliza la misma portería, y la sala 1 se liberó completa.
    expect(deVuelta?.raiz).toBe(porteria.raiz);
    expect(vigiladaS1.liberadas()).toBe(vigiladaS1.total);
    expect(vigiladaPorteria.liberadas()).toBe(0);
  });

  it('la sala precargada se arma una vez y se usa al entrar', async () => {
    const { escena, cargador } = montar();
    await cargador.entrar('porteria');
    cargador.precargar('s2-laboratorio');
    expect(cargador.enEspera).toEqual(['s2-laboratorio']);
    // No está en la escena: no se dibuja ni sube a la GPU hasta entrar.
    expect(escena.children).toHaveLength(1);

    const s2 = await cargador.entrar('s2-laboratorio');
    expect(s2?.id).toBe('s2-laboratorio');
    expect(cargador.enEspera).toEqual(['porteria']);
  });

  it('solo hay una sala precargada a la vez además de la portería', async () => {
    const { cargador } = montar();
    await cargador.entrar('porteria');
    cargador.precargar('s1-cooperativa');
    cargador.precargar('s2-laboratorio');
    expect(cargador.enEspera).toEqual(['s2-laboratorio']);
  });

  it('si se pide otra sala mientras compila, gana la última', async () => {
    const { renderer, escena, cargador } = montar();
    renderer.automatico = false;
    const primera = cargador.entrar('s1-cooperativa');
    const segunda = cargador.entrar('s3-gimnasio');
    renderer.soltarTodo();
    expect(await primera).toBeNull();
    expect((await segunda)?.id).toBe('s3-gimnasio');
    expect(escena.children).toHaveLength(1);
    expect(cargador.actual?.id).toBe('s3-gimnasio');
  });

  it('liberar suelta todo', async () => {
    const { escena, cargador } = montar();
    await cargador.entrar('porteria');
    await cargador.entrar('s5-rectoria');
    cargador.liberar();
    expect(escena.children).toHaveLength(0);
    expect(cargador.enEspera).toEqual([]);
    expect(cargador.actual).toBeNull();
  });
});

describe('recorrido', () => {
  it('la siguiente sala es la primera sin sello', () => {
    expect(siguienteSala('porteria', [])).toBe('s1-cooperativa');
    expect(siguienteSala('s1-cooperativa', [])).toBe('s2-laboratorio');
    expect(siguienteSala('porteria', ['s1-cooperativa', 's2-laboratorio'])).toBe('s3-gimnasio');
    expect(
      siguienteSala('porteria', [
        's1-cooperativa',
        's2-laboratorio',
        's3-gimnasio',
        's4-biblioteca',
        's5-rectoria',
      ]),
    ).toBeNull();
  });

  it('al volver a la portería se aparece frente a la puerta de la sala, mirando al pasillo', () => {
    const porteria = salaPorId('porteria');
    // La puerta 2 está en la pared este (x = 2,98): se aparece 1 m hacia el oeste, mirando al oeste.
    const p = puntoDeEntrada(porteria, 's2-laboratorio');
    expect(p.x).toBeCloseTo(1.98);
    expect(p.z).toBeCloseTo(1.55);
    expect(adelante(p.yaw).x).toBeCloseTo(-1);

    // La puerta 1 está en la pared oeste: se aparece hacia el este, mirando al este.
    const q = puntoDeEntrada(porteria, 's1-cooperativa');
    expect(q.x).toBeCloseTo(-1.98);
    expect(adelante(q.yaw).x).toBeCloseTo(1);
  });

  it('al entrar a una sala se aparece frente a su puerta; sin origen, en el punto de inicio', () => {
    // La puerta de la sala 1 está en la pared sur (z = 2,48): se aparece 1 m adentro, mirando al norte.
    const p = puntoDeEntrada(salaPorId('s1-cooperativa'), 'porteria');
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(1.48);
    expect(adelante(p.yaw).z).toBeCloseTo(-1);

    expect(puntoDeEntrada(salaPorId('porteria'), null)).toEqual({ x: 0, z: 4.2, yaw: 0 });
  });
});
