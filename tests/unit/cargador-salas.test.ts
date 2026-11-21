import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene } from 'three';
import type { Camera, Light, Mesh, Object3D } from 'three';
import { salaPorId } from '../../src/content/salas';
import { adelante } from '../../src/engine/jugador/camara';
import { crearCargadorSalas } from '../../src/engine/salas/cargador';
import { construirSala } from '../../src/engine/salas/construir';
import { puntoDeEntrada, siguienteSala } from '../../src/engine/salas/recorrido';
import { carga } from '../../src/signals/interfaz';

/** Tipos de las luces visibles en `raices`, ordenados (como las junta three para dibujar). */
function lucesVisibles(...raices: Object3D[]): string[] {
  const tipos: string[] = [];
  for (const raiz of raices) {
    raiz.traverseVisible((o) => {
      if ((o as Light).isLight) tipos.push(o.type);
    });
  }
  return tipos.sort();
}

/** Renderer falso: cada compilación queda pendiente hasta que la prueba la suelte. */
function rendererFalso() {
  const pendientes: (() => void)[] = [];
  return {
    compilados: 0,
    automatico: true,
    /**
     * Las luces con que se compiló cada sala, juntadas como `WebGLRenderer.compile` de three
     * r187: las visibles de la escena destino y, si es otro objeto, las de lo que se compila.
     */
    lucesCompiladas: [] as string[][],
    compileAsync(objeto: Object3D, _camara: Camera, escena?: Scene | null): Promise<void> {
      const destino = escena ?? objeto;
      this.lucesCompiladas.push(
        destino === objeto ? lucesVisibles(destino) : lucesVisibles(destino, objeto),
      );
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

  it('compila cada sala solo con sus luces: una hemisférica y una direccional (T20d)', async () => {
    const { renderer, escena, cargador } = montar();
    const UNA_DE_CADA = ['DirectionalLight', 'HemisphereLight'];
    const recorrido = [
      'porteria',
      's1-cooperativa',
      'porteria',
      's2-laboratorio',
      'porteria',
      's3-gimnasio',
      'porteria',
      's4-biblioteca',
      'porteria',
      's5-rectoria',
    ] as const;
    for (const lugar of recorrido) {
      await cargador.entrar(lugar);
      // La compilación vio las mismas luces que el primer cuadro: three no recompila al dibujar.
      expect(renderer.lucesCompiladas.at(-1), lugar).toEqual(UNA_DE_CADA);
      expect(lucesVisibles(escena), lugar).toEqual(UNA_DE_CADA);
    }
    expect(renderer.lucesCompiladas).toHaveLength(recorrido.length);
  });

  it('mientras la sala nueva compila, la actual se sigue dibujando con sus luces', async () => {
    const { renderer, escena, cargador } = montar();
    const porteria = await cargador.entrar('porteria');
    renderer.automatico = false;
    const entrando = cargador.entrar('s1-cooperativa');
    // compileAsync ya se llamó (sin `vestir` no hay nada que esperar antes).
    expect(renderer.lucesCompiladas.at(-1)).toEqual(['DirectionalLight', 'HemisphereLight']);
    // Un cuadro dibujado mientras tanto todavía muestra la portería con sus dos luces.
    expect(escena.children).toEqual([porteria?.raiz]);
    expect(lucesVisibles(escena)).toEqual(['DirectionalLight', 'HemisphereLight']);
    renderer.soltarTodo();
    expect((await entrando)?.id).toBe('s1-cooperativa');
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

  it('al volver a la portería se aparece en el pasillo frente a la puerta de la sala', () => {
    const porteria = salaPorId('porteria');
    // La puerta 2 está en la pared este del tramo 1 (x = −3,42, docs/pasillos.md): se aparece
    // 1 m hacia el oeste, en medio del pasillo, mirando al oeste.
    const p = puntoDeEntrada(porteria, 's2-laboratorio');
    expect(p.x).toBeCloseTo(-4.42);
    expect(p.z).toBeCloseTo(-8.4);
    expect(adelante(p.yaw).x).toBeCloseTo(-1);

    // La puerta 5 cierra el pasillo por el sur (z = 1,18): se aparece hacia el norte.
    const q = puntoDeEntrada(porteria, 's5-rectoria');
    expect(q.x).toBeCloseTo(-14.6);
    expect(q.z).toBeCloseTo(0.18);
    expect(adelante(q.yaw).z).toBeCloseTo(-1);
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
